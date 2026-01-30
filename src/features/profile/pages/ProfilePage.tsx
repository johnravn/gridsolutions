// src/pages/ProfilePage.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Popover,
  Progress,
  Avatar as RadixAvatar,
  Separator,
  Slider,
  Switch,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { Camera } from 'iconoir-react'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import MapEmbed from '@shared/maps/MapEmbed' // <- ensure this path fits your project
import ThemeToggle from '@shared/theme/ThemeToggle'
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'

type ProfileRow = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  phone: string | null
  avatar_url: string | null
  bio: string | null
  preferences: any | null
  primary_address_id: string | null
  // Nested via FK select (see query below)
  addresses?: {
    id: string
    name: string | null
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

type OptionalFields = {
  date_of_birth?: string | null
  drivers_license?: string | null
  licenses?: Array<string> | null
  certificates?: Array<string> | null
  notes?: string | null
  animated_background_intensity?: number | null
}

type AddressForm = {
  id: string | null
  name: string
  address_line: string
  zip_code: string
  city: string
  country: string
}

const FIELD_MAX = 420

export default function ProfilePage() {
  const qc = useQueryClient()
  const { info, success, error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [stylingMenuOpen, setStylingMenuOpen] = React.useState(false)

  // 1) get current user
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    },
  })

  // 2) load profile (+ joined primary address)
  const { data, isLoading, isError, error } = useQuery<ProfileRow | null>({
    queryKey: ['profile', authUser?.id ?? '__none__'],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          first_name,
          last_name,
          display_name,
          phone,
          avatar_url,
          bio,
          preferences,
          primary_address_id,
          addresses:primary_address_id (
            id,
            name,
            address_line,
            zip_code,
            city,
            country
          )
        `,
        )
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ProfileRow
    },
  })

  // 3) local form state
  const [form, setForm] = React.useState({
    // personal
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    avatarPath: '' as string | null,
    // optional (preferences)
    date_of_birth: '',
    drivers_license: '',
    licensesCsv: '',
    certificatesCsv: '',
    notes: '',
    animatedBackground: false,
    backgroundIntensity: 1.0,
    backgroundShapeType: 'circles' as 'circles' | 'triangles' | 'rectangles',
    backgroundSpeed: 1.0,
  })

  const [addr, setAddr] = React.useState<AddressForm>({
    id: null,
    name: '',
    address_line: '',
    zip_code: '',
    city: '',
    country: 'Norway',
  })

  // hydrate from query data
  React.useEffect(() => {
    if (!data) return

    // optional fields moved out of address (address now normalized)
    const prefs: OptionalFields = data.preferences ?? {}
    const licensesCsv = (prefs.licenses ?? []).join(', ')
    const certificatesCsv = (prefs.certificates ?? []).join(', ')

    setForm((s) => ({
      ...s,
      display_name: data.display_name ?? '',
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      phone: data.phone ?? '',
      bio: data.bio ?? '',
      avatarPath: data.avatar_url ?? null,
      date_of_birth: prefs.date_of_birth ?? '',
      drivers_license: prefs.drivers_license ?? '',
      licensesCsv,
      certificatesCsv,
      notes: prefs.notes ?? '',
      animatedBackground:
        (data.preferences as Record<string, any> | null)
          ?.animated_background_enabled ?? false,
      backgroundIntensity:
        (data.preferences as Record<string, any> | null)
          ?.animated_background_intensity ?? 1.0,
      backgroundShapeType:
        (data.preferences as Record<string, any> | null)
          ?.animated_background_shape_type ?? 'circles',
      backgroundSpeed:
        (data.preferences as Record<string, any> | null)
          ?.animated_background_speed ?? 1.0,
    }))

    const a = data.addresses
    setAddr({
      id: a?.id ?? null,
      name: a?.name ?? '',
      address_line: a?.address_line ?? '',
      zip_code: a?.zip_code ?? '',
      city: a?.city ?? '',
      country: a?.country ?? 'Norway',
    })
  }, [data])

  // 4) avatar upload
  const uploadAvatar = async (file: File) => {
    if (!authUser?.id) throw new Error('Not authenticated')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const fileName = `${Date.now()}.${ext}`
    const path = `${authUser.id}/${fileName}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) throw upErr
    return path // storage path
  }

  // 5) save
  const mut = useMutation({
    mutationFn: async () => {
      if (!authUser?.id) throw new Error('Not authenticated')

      // CSV -> arrays
      const licenses = form.licensesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const certificates = form.certificatesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const addressName: string = data?.display_name + '´s home'

      // 5a) Upsert address (normalized)
      // If we have an id, update; else insert a new row
      let addressId = addr.id
      const cleanAddress = {
        name: addressName,
        address_line: addr.address_line,
        zip_code: addr.zip_code,
        city: addr.city,
        country: addr.country,
        is_personal: true,
        company_id: null,
      }

      if (addressId) {
        const { error: updErr } = await supabase
          .from('addresses')
          .update(cleanAddress)
          .eq('id', addressId)
        if (updErr) throw updErr
      } else if (
        addr.address_line &&
        addr.city &&
        addr.zip_code &&
        addr.country
      ) {
        const newAddressId = crypto.randomUUID()
        const { error: insErr } = await supabase
          .from('addresses')
          .insert([{ id: newAddressId, ...cleanAddress }])
        if (insErr) throw insErr
        addressId = newAddressId
        setAddr((s) => ({ ...s, id: newAddressId }))
      }

      // 5b) Set primary_address_id on profile (separate simple update)
      if (addressId) {
        const { error: linkErr } = await supabase
          .from('profiles')
          .update({ primary_address_id: addressId })
          .eq('user_id', authUser.id)
        if (linkErr) throw linkErr
      }

      // 5c) Update profile core + preferences (note: address removed from preferences)
      const preferences = {
        date_of_birth: form.date_of_birth || null,
        drivers_license: form.drivers_license || null,
        licenses: licenses.length ? licenses : null,
        certificates: certificates.length ? certificates : null,
        notes: form.notes || null,
        animated_background_enabled: form.animatedBackground,
        animated_background_intensity: form.backgroundIntensity,
        animated_background_shape_type: form.backgroundShapeType,
        animated_background_speed: form.backgroundSpeed,
      }

      const { error: rpcErr } = await supabase.rpc('update_my_profile', {
        p_display_name: form.display_name || null,
        p_first_name: form.first_name || null,
        p_last_name: form.last_name || null,
        p_phone: form.phone || null,
        p_bio: form.bio || null,
        p_avatar_path: form.avatarPath || null,
        p_preferences: preferences as any,
      })
      if (rpcErr) throw rpcErr
    },
    onSuccess: async () => {
      // Invalidate and refetch profile data
      await qc.invalidateQueries({ queryKey: ['profile', authUser?.id] })
      // Force refetch the background preference query immediately
      await qc.refetchQueries({
        queryKey: ['profile', authUser?.id, 'animated-background-preference'],
        exact: false,
      })
      // Also invalidate any queries that might use this preference
      await qc.invalidateQueries({
        queryKey: ['profile', authUser?.id],
        exact: false,
      })
      success('Saved', 'Your profile has been updated.')
    },
    onError: (e: any) => {
      toastError('Save failed', e?.message ?? 'Please try again.')
    },
  })

  // helper to get public URL for the avatar
  const avatarUrl = React.useMemo(() => {
    if (!form.avatarPath) return null
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(form.avatarPath)
    return urlData.publicUrl
  }, [form.avatarPath])

  const set = <TKey extends keyof typeof form>(
    key: TKey,
    value: (typeof form)[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  const setAddrVal = <TKey extends keyof AddressForm>(
    key: TKey,
    value: AddressForm[TKey],
  ) => setAddr((s) => ({ ...s, [key]: value }))

  // Build a single-line address for the map preview
  const mapQuery = [addr.address_line, addr.zip_code, addr.city, addr.country]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(', ')

  if (isLoading) {
    return (
      <Box p="4">
        <Text>Loading…</Text>
      </Box>
    )
  }
  if (isError || !data) {
    return (
      <Box p="4">
        <Text color="red">
          Failed to load profile. {error ? String((error as any).message) : ''}
        </Text>
      </Box>
    )
  }

  return (
    <Card size="4" style={{ minHeight: 0, overflow: 'auto' }}>
      {/* Header */}
      <Flex align="center" justify="between" wrap="wrap" gap="3">
        <Flex align="center" wrap="wrap" gap="3">
          <Flex align="center" gap="3">
            <Avatar
              src={avatarUrl ?? undefined}
              initials={getInitials(form.display_name || data.email)}
            />
            <Box>
              <Heading size="4">{form.display_name || data.email}</Heading>
              <Text as="div" color="gray" size="2">
                {data.email}
              </Text>
            </Box>
          </Flex>

          <Flex
            direction="column"
            align="end"
            gap="2"
            style={{ minWidth: 180 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploading(true)
                try {
                  const path = await uploadAvatar(file)
                  set('avatarPath', path)
                  info('Photo uploaded', 'Remember to hit Save to apply.')
                } catch (e: any) {
                  toastError(
                    'Upload failed',
                    e?.message ?? 'Try another image.',
                  )
                } finally {
                  setUploading(false)
                  e.currentTarget.value = ''
                }
              }}
            />
            <Button
              size="2"
              variant="soft"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Flex gap="2" align="center">
                <Camera width={16} height={16} />
                {uploading ? 'Uploading…' : 'Change photo'}
              </Flex>
            </Button>

            {uploading && (
              <Box style={{ width: 200 }}>
                <Progress />
              </Box>
            )}
          </Flex>
        </Flex>
        <Flex align="center" gap="4" wrap="wrap">
          <Popover.Root
            open={stylingMenuOpen}
            onOpenChange={setStylingMenuOpen}
          >
            <Popover.Trigger>
              <Button size="2" variant="soft">
                Styling
              </Button>
            </Popover.Trigger>
            <Popover.Content size="2" style={{ maxWidth: 400 }}>
              <Flex direction="column" gap="4">
                <Box>
                  <Text
                    size="2"
                    weight="bold"
                    mb="3"
                    style={{ display: 'block' }}
                  >
                    Theme
                  </Text>
                  <ThemeToggle />
                </Box>

                <Separator />

                <Box>
                  <Text
                    size="2"
                    weight="bold"
                    mb="3"
                    style={{ display: 'block' }}
                  >
                    Background style
                  </Text>
                  <Flex gap="3" align="center" mb="3">
                    <BackgroundOption
                      label="Animated"
                      isAnimated={true}
                      selected={form.animatedBackground}
                      shapeType={form.backgroundShapeType}
                      speed={form.backgroundSpeed}
                      onSelect={async () => {
                        if (mut.isPending) return
                        set('animatedBackground', true)
                        // Save immediately
                        try {
                          await mut.mutateAsync()
                        } catch (error) {
                          // Error is handled by mutation's onError
                          // Revert on error
                          set('animatedBackground', false)
                        }
                      }}
                      disabled={mut.isPending}
                    />
                    <BackgroundOption
                      label="Solid"
                      isAnimated={false}
                      selected={!form.animatedBackground}
                      shapeType={form.backgroundShapeType}
                      speed={form.backgroundSpeed}
                      onSelect={async () => {
                        if (mut.isPending) return
                        set('animatedBackground', false)
                        // Save immediately
                        try {
                          await mut.mutateAsync()
                        } catch (error) {
                          // Error is handled by mutation's onError
                          // Revert on error
                          set('animatedBackground', true)
                        }
                      }}
                      disabled={mut.isPending}
                    />
                  </Flex>
                  <Flex direction="column" gap="2">
                    <Flex align="center" justify="between">
                      <Text size="2" weight="medium">
                        Background intensity
                      </Text>
                      <Button
                        size="1"
                        variant="soft"
                        onClick={async () => {
                          if (mut.isPending || !form.animatedBackground) return
                          set('backgroundIntensity', 0.1)
                          set('backgroundShapeType', 'circles')
                          set('backgroundSpeed', 0.5)
                          try {
                            await mut.mutateAsync()
                          } catch (error) {
                            // Error is handled by mutation's onError
                          }
                        }}
                        disabled={!form.animatedBackground || mut.isPending}
                      >
                        Recommended settings
                      </Button>
                    </Flex>
                    <Flex gap="3" align="center">
                      <Slider
                        value={[form.backgroundIntensity]}
                        onValueChange={([value]) => {
                          set('backgroundIntensity', value)
                        }}
                        onValueCommit={async () => {
                          // Save when user finishes dragging
                          if (!mut.isPending && form.animatedBackground) {
                            try {
                              await mut.mutateAsync()
                            } catch (error) {
                              // Error is handled by mutation's onError
                            }
                          }
                        }}
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={!form.animatedBackground || mut.isPending}
                        style={{ flex: 1 }}
                      />
                      <Text
                        size="2"
                        color={!form.animatedBackground ? 'gray' : undefined}
                        style={{
                          minWidth: 40,
                          textAlign: 'right',
                          opacity: !form.animatedBackground ? 0.5 : 1,
                        }}
                      >
                        {Math.round(form.backgroundIntensity * 100)}%
                      </Text>
                    </Flex>
                  </Flex>

                  <Separator />

                  <Flex direction="column" gap="2">
                    <Text size="2" weight="medium">
                      Shape type
                    </Text>
                    <Flex gap="2" wrap="wrap">
                      {(['circles', 'triangles', 'rectangles'] as const).map(
                        (shape) => (
                          <Button
                            key={shape}
                            size="2"
                            variant={
                              form.backgroundShapeType === shape
                                ? 'solid'
                                : 'soft'
                            }
                            onClick={async () => {
                              if (mut.isPending || !form.animatedBackground)
                                return
                              set('backgroundShapeType', shape)
                              try {
                                await mut.mutateAsync()
                              } catch (error) {
                                // Error is handled by mutation's onError
                              }
                            }}
                            disabled={!form.animatedBackground || mut.isPending}
                            style={{ textTransform: 'capitalize' }}
                          >
                            {shape}
                          </Button>
                        ),
                      )}
                    </Flex>
                  </Flex>

                  <Separator />

                  <Flex direction="column" gap="2">
                    <Text size="2" weight="medium">
                      Animation speed
                    </Text>
                    <Flex gap="3" align="center">
                      <Slider
                        value={[form.backgroundSpeed]}
                        onValueChange={([value]) => {
                          set('backgroundSpeed', value)
                        }}
                        onValueCommit={async () => {
                          // Save when user finishes dragging
                          if (!mut.isPending && form.animatedBackground) {
                            try {
                              await mut.mutateAsync()
                            } catch (error) {
                              // Error is handled by mutation's onError
                            }
                          }
                        }}
                        min={0.1}
                        max={3.0}
                        step={0.1}
                        disabled={!form.animatedBackground || mut.isPending}
                        style={{ flex: 1 }}
                      />
                      <Text
                        size="2"
                        color={!form.animatedBackground ? 'gray' : undefined}
                        style={{
                          minWidth: 50,
                          textAlign: 'right',
                          opacity: !form.animatedBackground ? 0.5 : 1,
                        }}
                      >
                        {form.backgroundSpeed.toFixed(1)}x
                      </Text>
                    </Flex>
                    <Text
                      size="1"
                      color="gray"
                      style={{
                        opacity: !form.animatedBackground ? 0.5 : 1,
                      }}
                    >
                      {form.backgroundSpeed < 1.0
                        ? 'Slower'
                        : form.backgroundSpeed > 1.0
                          ? 'Faster'
                          : 'Normal'}
                    </Text>
                  </Flex>
                </Box>
              </Flex>
            </Popover.Content>
          </Popover.Root>
        </Flex>
      </Flex>

      {/* Three columns: personal (left), address (middle), optional (right) */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Flex direction="column" gap="4" p="4">
          <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="4">
            {/* LEFT: Personal information */}
            <Column title="Personal information">
              <Field label="Display name" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={form.display_name}
                  onChange={(e) => set('display_name', e.target.value)}
                  placeholder="Shown in the app"
                />
              </Field>
              <Field label="Phone" maxWidth={FIELD_MAX}>
                <PhoneInputField
                  value={form.phone || undefined}
                  onChange={(v) => set('phone', v ?? '')}
                  defaultCountry="NO"
                />
              </Field>
              <FieldRow>
                <Field label="First name" maxWidth={FIELD_MAX}>
                  <TextField.Root
                    value={form.first_name}
                    onChange={(e) => set('first_name', e.target.value)}
                  />
                </Field>
                <Field label="Last name" maxWidth={FIELD_MAX}>
                  <TextField.Root
                    value={form.last_name}
                    onChange={(e) => set('last_name', e.target.value)}
                  />
                </Field>
              </FieldRow>
              <Field label="Bio" maxWidth={680}>
                <TextArea
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  placeholder="Short description about you…"
                  rows={5}
                />
              </Field>
            </Column>

            {/* MIDDLE: Address (normalized) */}
            <Column title="Address">
              {/* <Field label="Label (home, office…)" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={addr.name}
                  onChange={(e) => setAddrVal('name', e.target.value)}
                  placeholder="e.g., Home"
                />
              </Field> */}
              <Field label="Address line" maxWidth={520}>
                <TextField.Root
                  value={addr.address_line}
                  onChange={(e) => setAddrVal('address_line', e.target.value)}
                  placeholder="Street and number"
                />
              </Field>
              <FieldRow>
                <Flex gap={'2'} width={'100%'}>
                  <Field label="ZIP" maxWidth={100}>
                    <NorwayZipCodeField
                      value={addr.zip_code}
                      onChange={(val) => setAddrVal('zip_code', val)}
                      autoCompleteCity={(city) => setAddrVal('city', city)}
                    />
                  </Field>
                  <Field label="City" maxWidth={FIELD_MAX}>
                    <TextField.Root
                      value={addr.city}
                      onChange={(e) => setAddrVal('city', e.target.value)}
                      placeholder="e.g., Oslo"
                    />
                  </Field>
                </Flex>
              </FieldRow>
              <Field label="Country" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={addr.country}
                  onChange={(e) => setAddrVal('country', e.target.value)}
                />
              </Field>

              {/* Live map preview (only if we have something to show) */}
              {mapQuery && (
                <Box mt="2" style={{ maxWidth: 520 }}>
                  <MapEmbed query={mapQuery} zoom={15} />
                </Box>
              )}
            </Column>

            {/* RIGHT: Optional info */}
            <Column title="Optional details">
              <Field label="Date of birth" maxWidth={FIELD_MAX}>
                <DateTimePicker
                  value={
                    form.date_of_birth
                      ? new Date(form.date_of_birth + 'T00:00:00').toISOString()
                      : ''
                  }
                  onChange={(iso) => {
                    if (iso) {
                      const d = new Date(iso)
                      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                      set('date_of_birth', dateStr)
                    } else {
                      set('date_of_birth', '')
                    }
                  }}
                  dateOnly
                />
              </Field>
              <Field label="Driver’s license" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={form.drivers_license}
                  onChange={(e) => set('drivers_license', e.target.value)}
                  placeholder="e.g., B, BE"
                />
              </Field>
              <Field label="Other licenses (comma separated)" maxWidth={520}>
                <TextField.Root
                  value={form.licensesCsv}
                  onChange={(e) => set('licensesCsv', e.target.value)}
                  placeholder="e.g., Lift, Forklift"
                />
              </Field>
              <Field label="Certificates (comma separated)" maxWidth={520}>
                <TextField.Root
                  value={form.certificatesCsv}
                  onChange={(e) => set('certificatesCsv', e.target.value)}
                  placeholder="e.g., HSE, First aid"
                />
              </Field>
              <Field label="Other notes" maxWidth={520}>
                <TextArea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={5}
                />
              </Field>
            </Column>
          </Grid>
        </Flex>
      </div>

      {/* <Separator /> */}

      {/* Footer actions */}
      <Flex justify="end" gap="3" p="3">
        <Button
          size="2"
          variant="soft"
          color="gray"
          onClick={() =>
            qc.invalidateQueries({ queryKey: ['profile', authUser?.id] })
          }
          disabled={mut.isPending}
        >
          Reset
        </Button>
        <Button size="2" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </Flex>
    </Card>
  )
}

/* ---------- Small helpers ---------- */

function Column({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Heading size="3" mb="2">
        {title}
      </Heading>
      <Flex direction="column" gap="3">
        {children}
      </Flex>
    </Box>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <Flex wrap="wrap" gap="3" style={{ alignItems: 'start' }}>
      {children}
    </Flex>
  )
}

function Field({
  label,
  children,
  maxWidth = FIELD_MAX,
}: {
  label: string
  children: React.ReactNode
  maxWidth?: number
}) {
  return (
    <Box style={{ maxWidth, width: 'min(100%, ' + maxWidth + 'px)' }}>
      <Text as="div" size="2" color="gray" mb="1">
        {label}
      </Text>
      <Box style={{ width: '100%' }}>{children}</Box>
    </Box>
  )
}

function Avatar({ src, initials }: { src?: string; initials: string }) {
  return (
    <RadixAvatar
      size="5"
      radius="full"
      fallback={initials}
      src={src}
      style={{ border: '1px solid var(--gray-5)' }}
    />
  )
}

// Using shared getInitials from generalFunctions

function BackgroundOption({
  label,
  isAnimated,
  selected,
  onSelect,
  disabled,
  shapeType,
  speed,
}: {
  label: string
  isAnimated: boolean
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  shapeType?: 'circles' | 'triangles' | 'rectangles'
  speed?: number
}) {
  return (
    <Box
      style={{
        position: 'relative',
        width: 120,
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: selected
          ? '2px solid var(--accent-9)'
          : '2px solid var(--gray-6)',
        transition: 'border-color 0.2s',
      }}
      onClick={disabled ? undefined : onSelect}
    >
      {/* Background preview */}
      {isAnimated ? (
        <AnimatedBackgroundPreview
          shapeType={shapeType || 'circles'}
          speed={speed || 1.0}
        />
      ) : (
        <Box
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--gray-1)',
          }}
        />
      )}
      {/* Label overlay */}
      <Box
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '6px 8px',
          backgroundColor: selected ? 'var(--accent-9)' : 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          transition: 'background-color 0.2s',
        }}
      >
        <Text
          size="1"
          weight="medium"
          style={{
            color: selected ? 'var(--accent-contrast)' : 'var(--gray-12)',
            textAlign: 'center',
            display: 'block',
          }}
        >
          {label}
        </Text>
      </Box>
    </Box>
  )
}

function AnimatedBackgroundPreview({
  shapeType = 'circles',
  speed = 1.0,
}: {
  shapeType?: 'circles' | 'triangles' | 'rectangles'
  speed?: number
}) {
  // Calculate durations based on speed (similar to main background)
  const speedMultiplier = Math.max(0.1, Math.min(3.0, speed))
  const baseDurations = [6, 8, 10, 7]
  const durations = baseDurations.map((d) => d / speedMultiplier)

  // Rotation durations - much slower for subtle rotation
  const baseRotationDurations = [15, 21, 18, 19]
  const rotationDurations = baseRotationDurations.map(
    (d) => d / speedMultiplier,
  )

  // Initial rotation angles
  const initialRotations = [15, 30, 45, 60]

  // Calculate rotation amounts (degrees per slide cycle)
  const rotationAmounts = durations.map((slideDur, idx) =>
    Math.round((slideDur / rotationDurations[idx]) * 360),
  )

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'var(--gray-1)',
      }}
    >
      <style>{`
        @keyframes previewSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(calc(120px + 100%)); }
        }
        
        @keyframes previewSlideReverse {
          0% { transform: translateX(calc(120px + 100%)); }
          100% { transform: translateX(-100%); }
        }
        
        @keyframes previewSlideWithRotate1 {
          0% { transform: translateX(-100%) rotate(${initialRotations[0]}deg); }
          100% { transform: translateX(calc(120px + 100%)) rotate(${initialRotations[0] + rotationAmounts[0]}deg); }
        }
        
        @keyframes previewSlideReverseWithRotate2 {
          0% { transform: translateX(calc(120px + 100%)) rotate(${initialRotations[1]}deg); }
          100% { transform: translateX(-100%) rotate(${initialRotations[1] - rotationAmounts[1]}deg); }
        }
        
        @keyframes previewSlideWithRotate3 {
          0% { transform: translateX(-100%) rotate(${initialRotations[2]}deg); }
          100% { transform: translateX(calc(120px + 100%)) rotate(${initialRotations[2] + rotationAmounts[2]}deg); }
        }
        
        @keyframes previewSlideReverseWithRotate4 {
          0% { transform: translateX(calc(120px + 100%)) rotate(${initialRotations[3]}deg); }
          100% { transform: translateX(-100%) rotate(${initialRotations[3] - rotationAmounts[3]}deg); }
        }
        
        .preview-shape {
          position: absolute;
          opacity: 0.4;
        }
        
        .preview-shape-1 {
          width: 70px;
          height: 70px;
          background: var(--accent-a3);
          top: -15px;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `previewSlideWithRotate1 ${durations[0]}s linear infinite`
              : `previewSlide ${durations[0]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 8px;' : ''}
        }
        
        .preview-shape-2 {
          width: 55px;
          height: 55px;
          background: var(--accent-a2);
          top: 15px;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `previewSlideReverseWithRotate2 ${durations[1]}s linear infinite`
              : `previewSlideReverse ${durations[1]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 10px;' : ''}
        }
        
        .preview-shape-3 {
          width: 65px;
          height: 65px;
          background: var(--accent-a3);
          bottom: -10px;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `previewSlideWithRotate3 ${durations[2]}s linear infinite`
              : `previewSlide ${durations[2]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 8px;' : ''}
        }
        
        .preview-shape-4 {
          width: 45px;
          height: 45px;
          background: var(--accent-a2);
          top: 50%;
          left: 0;
          margin-top: -22.5px;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `previewSlideReverseWithRotate4 ${durations[3]}s linear infinite`
              : `previewSlideReverse ${durations[3]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 12px;' : ''}
        }
      `}</style>
      <div className="preview-shape preview-shape-1" />
      <div className="preview-shape preview-shape-2" />
      <div className="preview-shape preview-shape-3" />
      <div className="preview-shape preview-shape-4" />
    </Box>
  )
}
