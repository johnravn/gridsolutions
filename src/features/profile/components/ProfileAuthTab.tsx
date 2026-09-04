import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { Lock } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { linkOAuthProvider } from '@shared/auth/oauth'
import ChangePasswordDialog from '@features/profile/components/ChangePasswordDialog'
import type { OAuthProvider } from '@shared/auth/oauth'
import type { UserIdentity } from '@supabase/supabase-js'

type Props = {
  userId: string
  email: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

type MethodRow = {
  id: string
  label: string
  description: string
  kind: 'email' | 'oauth' | 'soon'
  provider?: OAuthProvider
}

const METHODS: Array<MethodRow> = [
  {
    id: 'email',
    label: 'Email & password',
    description: 'Sign in with your Grid email and a password.',
    kind: 'email',
  },
  {
    id: 'google',
    label: 'Google',
    description: 'Use your Google account to sign in to this Grid profile.',
    kind: 'oauth',
    provider: 'google',
  },
  {
    id: 'apple',
    label: 'Apple',
    description: 'Use Sign in with Apple for this Grid profile.',
    kind: 'oauth',
    provider: 'apple',
  },
  {
    id: 'vipps',
    label: 'Vipps',
    description: 'Norwegian Vipps login — coming soon.',
    kind: 'soon',
  },
  {
    id: 'passkeys',
    label: 'Passkeys',
    description: 'Biometric / device passkeys — coming soon.',
    kind: 'soon',
  },
]

function identityProvider(id: UserIdentity): string {
  return id.provider
}

export default function ProfileAuthTab({
  userId,
  email,
  displayName,
  firstName,
  lastName,
  avatarUrl,
}: Props) {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const [passwordOpen, setPasswordOpen] = React.useState(false)
  const [busyProvider, setBusyProvider] = React.useState<string | null>(null)

  const name =
    displayName || [firstName, lastName].filter(Boolean).join(' ') || email

  const { data: identities = [], isLoading } = useQuery({
    queryKey: ['auth', 'identities', userId],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities()
      if (error) throw error
      return data.identities ?? []
    },
  })

  const hasPassword = identities.some((i) => identityProvider(i) === 'email')
  const linkedProviders = new Set(identities.map(identityProvider))

  const linkMutation = useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      setBusyProvider(provider)
      const { error } = await linkOAuthProvider(provider)
      if (error) throw error
    },
    onError: (e: Error) => {
      setBusyProvider(null)
      toastError('Could not connect', e.message)
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: async (identity: UserIdentity) => {
      setBusyProvider(identity.provider)
      const { error } = await supabase.auth.unlinkIdentity(identity)
      if (error) throw error
    },
    onSuccess: async () => {
      setBusyProvider(null)
      success(
        'Disconnected',
        'That sign-in method was removed from this profile.',
      )
      await qc.invalidateQueries({ queryKey: ['auth', 'identities', userId] })
    },
    onError: (e: Error) => {
      setBusyProvider(null)
      toastError('Could not disconnect', e.message)
    },
  })

  const findIdentity = (provider: string) =>
    identities.find((i) => identityProvider(i) === provider)

  return (
    <Flex direction="column" gap="5" p="4" style={{ maxWidth: 720 }}>
      <Card size="3">
        <Flex direction="column" gap="3">
          <Text size="2" color="gray" weight="medium">
            Grid profile
          </Text>
          <Flex align="center" gap="3">
            <Avatar
              src={avatarUrl ?? undefined}
              fallback={getInitials(name)}
              size="5"
              style={{ border: '1px solid var(--gray-6)' }}
            />
            <Box style={{ minWidth: 0 }}>
              <Heading size="5" trim="start">
                {name}
              </Heading>
              <Text size="2" color="gray" as="div">
                {email}
              </Text>
            </Box>
          </Flex>
          <Text size="2" color="gray">
            Sign-in methods below attach to this Grid profile. Linking Google or
            Apple lets you open the same account with whichever method is
            available — your jobs, companies, and settings stay with this
            profile.
          </Text>
        </Flex>
      </Card>

      <Box>
        <Heading size="4" mb="1">
          Sign-in methods
        </Heading>
        <Text size="2" color="gray" mb="3" as="div">
          Connect or disconnect providers for this profile.
        </Text>

        <Flex direction="column" gap="3">
          {METHODS.map((method) => {
            const linked =
              method.kind === 'email'
                ? hasPassword
                : method.kind === 'oauth' && method.provider
                  ? linkedProviders.has(method.provider)
                  : false
            const identity =
              method.kind === 'oauth' && method.provider
                ? findIdentity(method.provider)
                : undefined
            const canUnlink = linked && identities.length >= 2 && !!identity

            return (
              <Card key={method.id} size="2">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Box style={{ flex: 1, minWidth: 200 }}>
                    <Flex align="center" gap="2" mb="1">
                      <Text weight="medium">{method.label}</Text>
                      {method.kind === 'soon' ? (
                        <Badge color="gray" variant="soft">
                          Coming soon
                        </Badge>
                      ) : linked ? (
                        <Badge color="green" variant="soft">
                          Connected
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="outline">
                          Not connected
                        </Badge>
                      )}
                    </Flex>
                    <Text size="2" color="gray">
                      {method.description}
                    </Text>
                  </Box>

                  <Flex gap="2" align="center">
                    {method.kind === 'email' && (
                      <Button
                        size="2"
                        variant="soft"
                        onClick={() => setPasswordOpen(true)}
                      >
                        <Lock width={16} height={16} />
                        {hasPassword ? 'Change password' : 'Set a password'}
                      </Button>
                    )}

                    {method.kind === 'oauth' && method.provider && (
                      <>
                        {linked ? (
                          <Button
                            size="2"
                            variant="soft"
                            color="red"
                            disabled={
                              !canUnlink ||
                              busyProvider === method.provider ||
                              isLoading
                            }
                            onClick={() => {
                              if (identity) unlinkMutation.mutate(identity)
                            }}
                          >
                            {busyProvider === method.provider
                              ? 'Working…'
                              : 'Disconnect'}
                          </Button>
                        ) : (
                          <Button
                            size="2"
                            variant="solid"
                            disabled={
                              busyProvider !== null || linkMutation.isPending
                            }
                            onClick={() =>
                              linkMutation.mutate(method.provider!)
                            }
                          >
                            {busyProvider === method.provider
                              ? 'Redirecting…'
                              : 'Connect'}
                          </Button>
                        )}
                      </>
                    )}

                    {method.kind === 'soon' && (
                      <Button size="2" variant="soft" disabled>
                        Coming soon
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </Card>
            )
          })}
        </Flex>
      </Box>

      <Separator size="4" />
      <Text size="1" color="gray">
        You need at least two connected methods to disconnect one. Password is
        optional if you only use Google or Apple.
      </Text>

      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        userEmail={email}
        mode={hasPassword ? 'change' : 'set'}
        onSuccess={() => {
          void qc.invalidateQueries({
            queryKey: ['auth', 'identities', userId],
          })
        }}
      />
    </Flex>
  )
}
