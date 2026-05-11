// src/pages/ProfilePage.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Progress,
  Avatar as RadixAvatar,
  Tabs,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { Camera, Lock } from 'iconoir-react'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import MapEmbed from '@shared/maps/MapEmbed' // <- ensure this path fits your project
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'
import ChangePasswordDialog from '@features/profile/components/ChangePasswordDialog'
import ProfileMatterEmailSettings from '@features/profile/components/ProfileMatterEmailSettings'
import ProfilePersonalizationTab from '@features/profile/components/ProfilePersonalizationTab'
import type { ProfilePersonalizationFormSlice } from '@features/profile/components/ProfilePersonalizationTab'

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
  daily_inspiration_type?: 'quote' | 'bibleverse' | null
}

type AddressForm = {
  id: string | null
  name: string
  address_line: string
  zip_code: string
  city: string
  country: string
}

export default function ProfilePage() {
  const qc = useQueryClient()
  const { info, success, error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false)

  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // 1) get current user
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      return authData.user
    },
  })

  // 2) load profile (+ joined primary address)
  const { data, isLoading, isError, error } = useQuery<ProfileRow | null>({
    queryKey: ['profile', authUser?.id ?? '__none__'],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null
      const { data: profileData, error: profileErr } = await supabase
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
      if (profileErr) throw profileErr
      return profileData as unknown as ProfileRow
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
    dailyInspirationType: 'quote' as 'quote' | 'bibleverse',
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
      dailyInspirationType:
        (data.preferences as Record<string, any> | null)
          ?.daily_inspiration_type === 'bibleverse'
          ? 'bibleverse'
          : 'quote',
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

      // 5c) Update profile core + preferences (RPC replaces entire JSON — merge first)
      const prevPrefs =
        data?.preferences != null &&
        typeof data.preferences === 'object' &&
        !Array.isArray(data.preferences)
          ? { ...(data.preferences as Record<string, unknown>) }
          : {}
      const preferences: Record<string, unknown> = {
        ...prevPrefs,
        date_of_birth: form.date_of_birth || null,
        drivers_license: form.drivers_license || null,
        licenses: licenses.length ? licenses : null,
        certificates: certificates.length ? certificates : null,
        notes: form.notes || null,
        animated_background_enabled: form.animatedBackground,
        animated_background_intensity: form.backgroundIntensity,
        animated_background_shape_type: form.backgroundShapeType,
        animated_background_speed: form.backgroundSpeed,
        daily_inspiration_type: form.dailyInspirationType,
      }
      delete preferences.prefer_reduced_motion
      delete preferences.daily_inspiration_show_attribution
      delete preferences.daily_inspiration_large_text

      const { error: rpcErr } = await supabase.rpc(
        'update_my_profile',
        {
          p_display_name: form.display_name || null,
          p_first_name: form.first_name || null,
          p_last_name: form.last_name || null,
          p_phone: form.phone || null,
          p_bio: form.bio || null,
          p_avatar_path: form.avatarPath || null,
          p_preferences: preferences,
        } as any,
      )
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
      await qc.refetchQueries({
        queryKey: ['profile', authUser?.id, 'daily-inspiration-type'],
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
    <section
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Tabs.Root
        defaultValue="general"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="general">General</Tabs.Trigger>
          <Tabs.Trigger value="notifications">Matter notifications</Tabs.Trigger>
          <Tabs.Trigger value="personalization">Personalization</Tabs.Trigger>
        </Tabs.List>

        <Box
          pt="4"
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs.Content
            value="general"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Card
              size="4"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: isLarge ? '100%' : undefined,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* Header: identity + change password */}
              <Box p="4" pb="3">
                <Grid
                  columns={{ initial: '1', md: '1fr auto' }}
                  gap="4"
                  align="start"
                >
                  <Flex direction="column" gap="3" style={{ minWidth: 0 }}>
                    <Flex align="center" gap="3" wrap="wrap">
                      <Avatar
                        src={avatarUrl ?? undefined}
                        initials={getInitials(form.display_name || data.email)}
                      />
                      <Box style={{ minWidth: 0 }}>
                        <Heading size="4">
                          {form.display_name || data.email}
                        </Heading>
                        <Text as="div" color="gray" size="2">
                          {data.email}
                        </Text>
                      </Box>
                    </Flex>
                    <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
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
                            info(
                              'Photo uploaded',
                              'Remember to hit Save to apply.',
                            )
                          } catch (err: any) {
                            toastError(
                              'Upload failed',
                              err?.message ?? 'Try another image.',
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
                        style={{ width: '100%', maxWidth: 280 }}
                      >
                        <Flex gap="2" align="center" justify="center">
                          <Camera width={16} height={16} />
                          {uploading ? 'Uploading…' : 'Change photo'}
                        </Flex>
                      </Button>
                      {uploading && (
                        <Box style={{ width: '100%', maxWidth: 280 }}>
                          <Progress />
                        </Box>
                      )}
                    </Flex>
                  </Flex>

                  <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => setChangePasswordOpen(true)}
                      style={{ width: '100%', minWidth: 160 }}
                    >
                      <Flex gap="2" align="center" justify="center">
                        <Lock width={16} height={16} />
                        Change password
                      </Flex>
                    </Button>
                  </Flex>
                </Grid>
              </Box>

              {/* Three equal columns: personal, address, optional */}
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                }}
                p="4"
                pt="0"
              >
                <Grid
                  columns={{
                    initial: '1',
                    md: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(3, minmax(0, 1fr))',
                  }}
                  gap="5"
                  align="start"
                >
                  <Column title="Personal information">
                    <Field label="Display name">
                      <TextField.Root
                        value={form.display_name}
                        onChange={(e) => set('display_name', e.target.value)}
                        placeholder="Shown in the app"
                      />
                    </Field>
                    <Field label="Phone">
                      <PhoneInputField
                        value={form.phone || undefined}
                        onChange={(v) => set('phone', v ?? '')}
                        defaultCountry="NO"
                      />
                    </Field>
                    <Grid
                      columns={{ initial: '1', sm: 'repeat(2, minmax(0, 1fr))' }}
                      gap="3"
                      width="100%"
                    >
                      <Field label="First name">
                        <TextField.Root
                          value={form.first_name}
                          onChange={(e) => set('first_name', e.target.value)}
                        />
                      </Field>
                      <Field label="Last name">
                        <TextField.Root
                          value={form.last_name}
                          onChange={(e) => set('last_name', e.target.value)}
                        />
                      </Field>
                    </Grid>
                    <Field label="Bio">
                      <TextArea
                        value={form.bio}
                        onChange={(e) => set('bio', e.target.value)}
                        placeholder="Short description about you…"
                        rows={5}
                      />
                    </Field>
                  </Column>

                  <Column title="Address">
                    <Field label="Address line">
                      <TextField.Root
                        value={addr.address_line}
                        onChange={(e) =>
                          setAddrVal('address_line', e.target.value)
                        }
                        placeholder="Street and number"
                      />
                    </Field>
                    <Grid
                      columns={{
                        initial: '1',
                        sm: 'minmax(5.5rem, 0.32fr) minmax(0, 1fr)',
                      }}
                      gap="3"
                      width="100%"
                    >
                      <Field label="ZIP">
                        <NorwayZipCodeField
                          value={addr.zip_code}
                          onChange={(val) => setAddrVal('zip_code', val)}
                          autoCompleteCity={(city) => setAddrVal('city', city)}
                        />
                      </Field>
                      <Field label="City">
                        <TextField.Root
                          value={addr.city}
                          onChange={(e) => setAddrVal('city', e.target.value)}
                          placeholder="e.g., Oslo"
                        />
                      </Field>
                    </Grid>
                    <Field label="Country">
                      <TextField.Root
                        value={addr.country}
                        onChange={(e) => setAddrVal('country', e.target.value)}
                      />
                    </Field>

                    {mapQuery && (
                      <Box mt="1" style={{ width: '100%' }}>
                        <MapEmbed query={mapQuery} zoom={15} />
                      </Box>
                    )}
                  </Column>

                  <Column title="Optional details">
                    <Field label="Date of birth">
                      <DateTimePicker
                        value={
                          form.date_of_birth
                            ? new Date(
                                form.date_of_birth + 'T00:00:00',
                              ).toISOString()
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
                    <Field label="Driver’s license">
                      <TextField.Root
                        value={form.drivers_license}
                        onChange={(e) =>
                          set('drivers_license', e.target.value)
                        }
                        placeholder="e.g., B, BE"
                      />
                    </Field>
                    <Field label="Other licenses (comma separated)">
                      <TextField.Root
                        value={form.licensesCsv}
                        onChange={(e) => set('licensesCsv', e.target.value)}
                        placeholder="e.g., Lift, Forklift"
                      />
                    </Field>
                    <Field label="Certificates (comma separated)">
                      <TextField.Root
                        value={form.certificatesCsv}
                        onChange={(e) => set('certificatesCsv', e.target.value)}
                        placeholder="e.g., HSE, First aid"
                      />
                    </Field>
                    <Field label="Other notes">
                      <TextArea
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={5}
                      />
                    </Field>
                  </Column>
                </Grid>
              </Box>

              <Flex justify="end" gap="3" p="4" pt="3">
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
                <Button
                  size="2"
                  onClick={() => mut.mutate()}
                  disabled={mut.isPending}
                >
                  {mut.isPending ? 'Saving…' : 'Save'}
                </Button>
              </Flex>
              <ChangePasswordDialog
                open={changePasswordOpen}
                onOpenChange={setChangePasswordOpen}
                userEmail={data.email}
              />
            </Card>
          </Tabs.Content>

          <Tabs.Content
            value="notifications"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ProfileMatterEmailSettings />
          </Tabs.Content>

          <Tabs.Content
            value="personalization"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ProfilePersonalizationTab
              form={
                {
                  animatedBackground: form.animatedBackground,
                  backgroundIntensity: form.backgroundIntensity,
                  backgroundShapeType: form.backgroundShapeType,
                  backgroundSpeed: form.backgroundSpeed,
                  dailyInspirationType: form.dailyInspirationType,
                } satisfies ProfilePersonalizationFormSlice
              }
              patchForm={(patch: Partial<ProfilePersonalizationFormSlice>) =>
                setForm((s) => ({ ...s, ...patch }))
              }
              saveProfile={() => mut.mutateAsync()}
              isSaving={mut.isPending}
            />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </section>
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
    <Flex
      direction="column"
      gap="3"
      style={{ minWidth: 0, width: '100%', alignSelf: 'stretch' }}
    >
      <Heading size="3" mb="0">
        {title}
      </Heading>
      <Flex direction="column" gap="3" style={{ width: '100%' }}>
        {children}
      </Flex>
    </Flex>
  )
}

function Field({
  label,
  children,
  maxWidth,
}: {
  label: string
  children: React.ReactNode
  maxWidth?: number
}) {
  return (
    <Box
      style={
        maxWidth != null
          ? {
              maxWidth,
              width: `min(100%, ${maxWidth}px)`,
            }
          : { width: '100%', minWidth: 0 }
      }
    >
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
