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
import { authUserQueryOptions } from '@shared/auth/authUserQuery'
import { resolveAvatarUrl } from '@shared/lib/avatarUrl'
import {
  DEFAULT_BIBLE_VERSION,
  normalizeBibleVersion,
} from '@shared/lib/bibleVersion'
import { getInitials } from '@shared/lib/generalFunctions'
import {
  useTabKeyboardScopeProps,
  useTabKeyboardShortcuts,
} from '@shared/lib/keyboardShortcuts'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import ProfilePageSkeleton from '@shared/ui/components/ProfilePageSkeleton'
import { DatePicker } from '@shared/ui/components/pickers'
import { Camera } from 'iconoir-react'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import MapEmbed from '@shared/maps/MapEmbed' // <- ensure this path fits your project
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'
import { profilePageQuery } from '@features/profile/api/profileQuery'
import {
  
  
  
  prefsAsRecord,
  saveProfilePage
} from '@features/profile/api/updateProfile'
import { uploadAvatar } from '@features/profile/api/uploadAvatar'
import ProfileAuthTab from '@features/profile/components/ProfileAuthTab'
import ProfileMatterEmailSettings from '@features/profile/components/ProfileMatterEmailSettings'
import ProfilePersonalizationTab from '@features/profile/components/ProfilePersonalizationTab'
import ProfileShortcutsTab from '@features/profile/components/ProfileShortcutsTab'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
  normalizeGeometricPreset,
} from '@shared/ui/components/AnimatedBackground'
import type {ProfileAddressForm, ProfilePageForm, ProfilePreferencesFields} from '@features/profile/api/updateProfile';
import type { ProfilePersonalizationFormSlice } from '@features/profile/components/ProfilePersonalizationTab'

const PROFILE_TABS = [
  'general',
  'auth',
  'notifications',
  'personalization',
  'shortcuts',
] as const

export default function ProfilePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const { info, success, error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const initialTab =
    search.tab && (PROFILE_TABS as ReadonlyArray<string>).includes(search.tab)
      ? search.tab
      : 'general'
  const [activeTab, setActiveTab] = React.useState<string>(initialTab)

  React.useEffect(() => {
    if (
      search.tab &&
      (PROFILE_TABS as ReadonlyArray<string>).includes(search.tab) &&
      search.tab !== activeTab
    ) {
      setActiveTab(search.tab)
    }
  }, [search.tab, activeTab])

  const handleTabChange = React.useCallback(
    (tab: string) => {
      setActiveTab(tab)
      void navigate({
        to: '/profile',
        search: { tab: tab === 'general' ? undefined : tab },
        replace: true,
      })
    },
    [navigate],
  )

  const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
  useTabKeyboardShortcuts({
    scopeRef,
    tabs: PROFILE_TABS,
    activeTab,
    onTabChange: handleTabChange,
  })

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
  const { data: authUser } = useQuery(authUserQueryOptions)

  // 2) load profile (+ joined primary address)
  const { data, isLoading, isError, error } = useQuery({
    ...profilePageQuery(authUser?.id ?? '__none__'),
    enabled: !!authUser?.id,
  })

  // 3) local form state
  const [form, setForm] = React.useState<ProfilePageForm>({
    // personal
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    avatarPath: null,
    // optional (preferences)
    date_of_birth: '',
    drivers_license: '',
    licensesCsv: '',
    certificatesCsv: '',
    notes: '',
    animatedBackground: false,
    backgroundIntensity: 1.0,
    backgroundPreset: DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
    dailyInspirationType: 'quote',
    bibleVersion: DEFAULT_BIBLE_VERSION,
  })
  const formRef = React.useRef(form)
  formRef.current = form

  const [addr, setAddr] = React.useState<ProfileAddressForm>({
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
    const prefs = prefsAsRecord(data.preferences) as ProfilePreferencesFields
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
      animatedBackground: prefs.animated_background_enabled ?? false,
      backgroundIntensity: prefs.animated_background_intensity ?? 1.0,
      backgroundPreset: normalizeGeometricPreset(
        prefs.animated_background_shape_type,
      ),
      dailyInspirationType:
        prefs.daily_inspiration_type === 'bibleverse' ? 'bibleverse' : 'quote',
      bibleVersion: normalizeBibleVersion(prefs.bible_version),
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

  // 4) save
  const mut = useMutation({
    mutationFn: async () => {
      if (!authUser?.id) throw new Error('Not authenticated')
      const result = await saveProfilePage({
        userId: authUser.id,
        form: formRef.current,
        addr,
        previousPreferences: data?.preferences,
        previousDisplayName: data?.display_name,
      })
      if (result.addressId && result.addressId !== addr.id) {
        setAddr((s) => ({ ...s, id: result.addressId }))
      }
    },
    onSuccess: () => {
      success('Saved', 'Your profile has been updated.')
      void Promise.all([
        qc.invalidateQueries({
          queryKey: ['profile', authUser?.id],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['youversion', 'verse-of-the-day'],
        }),
      ])
    },
    onError: (e: unknown) => {
      toastError(
        'Save failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  // Absolute OAuth URLs pass through; relative keys get the public avatars prefix
  const avatarUrl = React.useMemo(
    () => resolveAvatarUrl(form.avatarPath),
    [form.avatarPath],
  )

  const set = <TKey extends keyof ProfilePageForm>(
    key: TKey,
    value: ProfilePageForm[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  const setAddrVal = <TKey extends keyof ProfileAddressForm>(
    key: TKey,
    value: ProfileAddressForm[TKey],
  ) => setAddr((s) => ({ ...s, [key]: value }))

  // Build a single-line address for the map preview
  const mapQuery = [addr.address_line, addr.zip_code, addr.city, addr.country]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(', ')

  if (isLoading) {
    return <ProfilePageSkeleton />
  }
  if (isError || !data) {
    return (
      <Box p="4">
        <Text color="red">
          Failed to load profile. {error instanceof Error ? error.message : ''}
        </Text>
      </Box>
    )
  }

  return (
    <section
      {...scopeProps}
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Tabs.Root
        value={activeTab}
        onValueChange={handleTabChange}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <AnimatedTabsList>
          <Tabs.Trigger value="general">General</Tabs.Trigger>
          <Tabs.Trigger value="auth">Sign-in methods</Tabs.Trigger>
          <Tabs.Trigger value="notifications">
            Matter notifications
          </Tabs.Trigger>
          <Tabs.Trigger value="personalization">Personalization</Tabs.Trigger>
          <Tabs.Trigger value="shortcuts">Shortcuts</Tabs.Trigger>
        </AnimatedTabsList>

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
              {/* Header: identity + avatar */}
              <Box p="4" pb="3">
                <Grid columns={{ initial: '1' }} gap="4" align="start">
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
                          if (!authUser?.id) {
                            toastError('Upload failed', 'Not authenticated')
                            return
                          }
                          setUploading(true)
                          try {
                            const path = await uploadAvatar(authUser.id, file)
                            set('avatarPath', path)
                            info(
                              'Photo uploaded',
                              'Remember to hit Save to apply.',
                            )
                          } catch (err: unknown) {
                            toastError(
                              'Upload failed',
                              err instanceof Error
                                ? err.message
                                : 'Try another image.',
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
                      columns={{
                        initial: '1',
                        sm: 'repeat(2, minmax(0, 1fr))',
                      }}
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
                      <DatePicker
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
                      />
                    </Field>
                    <Field label="Driver’s license">
                      <TextField.Root
                        value={form.drivers_license}
                        onChange={(e) => set('drivers_license', e.target.value)}
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
                    qc.invalidateQueries({
                      queryKey: ['profile', authUser?.id],
                    })
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
            </Card>
          </Tabs.Content>

          <Tabs.Content
            value="auth"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}
          >
            {authUser?.id && (
              <ProfileAuthTab
                userId={authUser.id}
                email={data.email}
                displayName={form.display_name || data.display_name}
                firstName={form.first_name || data.first_name}
                lastName={form.last_name || data.last_name}
                avatarUrl={avatarUrl}
              />
            )}
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
                  backgroundPreset: form.backgroundPreset,
                  dailyInspirationType: form.dailyInspirationType,
                  bibleVersion: form.bibleVersion,
                } satisfies ProfilePersonalizationFormSlice
              }
              patchForm={(patch: Partial<ProfilePersonalizationFormSlice>) =>
                setForm((s) => {
                  const next = { ...s, ...patch }
                  formRef.current = next
                  return next
                })
              }
              saveProfile={(patch) => {
                if (patch) {
                  const next = { ...formRef.current, ...patch }
                  formRef.current = next
                  setForm(next)
                }
                return mut.mutateAsync()
              }}
              isSaving={mut.isPending}
            />
          </Tabs.Content>

          <Tabs.Content
            value="shortcuts"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ProfileShortcutsTab />
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
