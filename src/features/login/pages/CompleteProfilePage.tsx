import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { isValidPhoneNumber } from 'react-phone-number-input'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useAppForm } from '@shared/form'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import {
  completeRequiredProfile,
  signOut,
} from '@features/login/api/authActions'
import {
  AnimatedBackground,
  DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
} from '@shared/ui/components/AnimatedBackground'
import { authUserQueryOptions } from '@shared/auth/authUserQuery'
import { fetchProfileCompleteness, isProfileComplete } from '@shared/auth/oauth'
import { myProfileQueryKey } from '@shared/api/myProfileQuery'
import { useLockDocumentScroll } from '@shared/ui/hooks/useLockDocumentScroll'

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phone: z
    .string()
    .min(1, 'Please enter a valid phone number')
    .refine((v) => isValidPhoneNumber(v), 'Please enter a valid phone number'),
})

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = React.useState<string | null>(null)

  const { data: authUser, isLoading: authLoading } =
    useQuery(authUserQueryOptions)

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-completeness', authUser?.id ?? '__none__'],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null
      return fetchProfileCompleteness(authUser.id)
    },
  })

  React.useEffect(() => {
    if (!authLoading && !authUser) {
      void navigate({ to: '/login' })
    }
  }, [authLoading, authUser, navigate])

  React.useEffect(() => {
    if (!profileLoading && isProfileComplete(profile)) {
      void navigate({ to: '/dashboard' })
    }
  }, [profileLoading, profile, navigate])

  const form = useAppForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setError(null)
      await saveMutation.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!profile) return
    form.setFieldValue('firstName', profile.first_name?.trim() ?? '')
    form.setFieldValue('lastName', profile.last_name?.trim() ?? '')
    form.setFieldValue('phone', profile.phone?.trim() ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once profile loads
  }, [profile?.first_name, profile?.last_name, profile?.phone])

  const saveMutation = useMutation({
    mutationFn: async (value: {
      firstName: string
      lastName: string
      phone: string
    }) => {
      if (!authUser?.id) throw new Error('Not signed in')
      await completeRequiredProfile({
        userId: authUser.id,
        firstName: value.firstName,
        lastName: value.lastName,
        phone: value.phone,
      })
    },
    onSuccess: async () => {
      if (authUser?.id) {
        await Promise.all([
          qc.invalidateQueries({
            queryKey: ['profile-completeness', authUser.id],
          }),
          qc.invalidateQueries({ queryKey: myProfileQueryKey(authUser.id) }),
          qc.invalidateQueries({ queryKey: ['profile', authUser.id] }),
        ])
      }
      void navigate({ to: '/dashboard' })
    },
    onError: (e: Error) => {
      setError(e.message ?? 'Could not save profile')
    },
  })

  useLockDocumentScroll({ includeHtml: false })

  if (authLoading || profileLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100dvh' }}>
        <Text color="gray">Loading…</Text>
      </Flex>
    )
  }

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 1,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <AnimatedBackground
        intensity={0.35}
        preset={DEFAULT_GEOMETRIC_BACKGROUND_PRESET}
      />
      <Card
        size="4"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--gray-a2)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Flex direction="column" gap="4">
          <Box>
            <Heading size="7" mb="1">
              Finish your Grid profile
            </Heading>
            <Text color="gray">
              Your sign-in method is connected. Add a few details so teammates
              can find you.
            </Text>
          </Box>

          <Separator size="4" />

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Flex direction="column" gap="3">
                <Flex gap="3" wrap="wrap">
                  <Box style={{ flex: 1, minWidth: 160 }}>
                    <form.AppField name="firstName">
                      {(field) => (
                        <field.TextField
                          label="First name"
                          placeholder="First name"
                          autoComplete="given-name"
                        />
                      )}
                    </form.AppField>
                  </Box>
                  <Box style={{ flex: 1, minWidth: 160 }}>
                    <form.AppField name="lastName">
                      {(field) => (
                        <field.TextField
                          label="Last name"
                          placeholder="Last name"
                          autoComplete="family-name"
                        />
                      )}
                    </form.AppField>
                  </Box>
                </Flex>

                <form.AppField name="phone">
                  {(field) => (
                    <Box>
                      <Text
                        as="label"
                        size="2"
                        color="gray"
                        mb="1"
                        style={{ display: 'block' }}
                      >
                        Phone number
                      </Text>
                      <PhoneInputField
                        id="complete-profile-phone"
                        value={field.state.value || undefined}
                        onChange={(v) => field.handleChange(v ?? '')}
                        defaultCountry="NO"
                        placeholder="Enter phone number"
                        disabled={saveMutation.isPending}
                      />
                      {field.state.meta.errors?.[0] && (
                        <Text size="1" color="red" mt="1">
                          {String(field.state.meta.errors[0])}
                        </Text>
                      )}
                    </Box>
                  )}
                </form.AppField>

                {authUser?.email && (
                  <Box>
                    <Text size="2" color="gray" mb="1" as="div">
                      Email
                    </Text>
                    <TextField.Root value={authUser.email} disabled />
                  </Box>
                )}

                {error && <Text color="red">{error}</Text>}

                <form.SubmitButton
                  label="Continue to Grid"
                  pendingLabel="Saving…"
                />
              </Flex>
            </form.AppForm>
          </form>

          <Button
            type="button"
            variant="ghost"
            color="gray"
            onClick={async () => {
              await signOut()
              void navigate({ to: '/login' })
            }}
          >
            Sign out
          </Button>
        </Flex>
      </Card>
    </Box>
  )
}
