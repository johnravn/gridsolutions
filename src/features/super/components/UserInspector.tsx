import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
  Code,
  Flex,
  Separator,
  Text,
} from '@radix-ui/themes'
import { Edit, Trash } from 'iconoir-react'
import InspectorSkeleton from '@shared/ui/components/InspectorSkeleton'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import { userCompanyMembershipsQuery, userDetailQuery } from '../api/queries'

export default function UserInspector({
  id,
  onDeleted,
  onEdit,
  onDelete,
}: {
  id: string | null
  onDeleted?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { data, isLoading, isError, error } = useQuery({
    ...userDetailQuery({ userId: id ?? '__none__' }),
    enabled: !!id,
  })

  const { data: companies = [] } = useQuery({
    ...userCompanyMembershipsQuery({ userId: id ?? '__none__' }),
    enabled: !!id,
  })

  // If query returns no data (user was deleted), clear selection
  React.useEffect(() => {
    if (id && !isLoading && data === undefined && !isError && onDeleted) {
      onDeleted()
    }
  }, [id, isLoading, data, isError, onDeleted])

  const avatarUrl = React.useMemo(() => {
    if (!data?.avatar_url) return null
    const { data: storageData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.avatar_url)
    return storageData.publicUrl
  }, [data?.avatar_url])

  if (!id) return <Text color="gray">Select a user to view details.</Text>

  if (isLoading) return <InspectorSkeleton />

  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )

  if (!data) return <Text color="gray">Not found.</Text>

  const user = data
  const fullName =
    user.display_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    null

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="3" mb="3" wrap="wrap">
        <Flex align="center" gap="3">
          <Avatar
            src={avatarUrl ?? undefined}
            fallback={getInitials(fullName ?? user.email)}
            size="5"
            style={{ border: '1px solid var(--gray-5)' }}
          />
          <div>
            <Text as="div" size="4" weight="bold">
              {fullName ?? user.email}
            </Text>
            <Text as="div" color="gray" size="2">
              <a href={`mailto:${user.email}`} style={{ color: 'inherit' }}>
                {user.email}
              </a>
            </Text>
          </div>
        </Flex>

        <Flex align="center" gap="2">
          <Button
            size="2"
            variant="soft"
            onClick={() => {
              onEdit?.()
            }}
          >
            <Edit />
          </Button>
          <Button
            size="2"
            variant="surface"
            color="red"
            onClick={() => {
              onDelete?.()
            }}
          >
            <Trash />
          </Button>
        </Flex>
      </Flex>

      <Separator my="2" />

      {/* Primary info */}
      <DefinitionList>
        <DT>User ID</DT>
        <DD>{user.user_id}</DD>

        <DT>Joined</DT>
        <DD>{formatMonthYear(user.created_at)}</DD>

        <DT>Phone</DT>
        <DD>
          {user.phone ? (
            <a href={`tel:${user.phone}`} style={{ color: 'inherit' }}>
              {prettyPhone(user.phone)}
            </a>
          ) : (
            '—'
          )}
        </DD>

        <DT>First name</DT>
        <DD>{user.first_name || '—'}</DD>

        <DT>Last name</DT>
        <DD>{user.last_name || '—'}</DD>

        <DT>Display name</DT>
        <DD>{user.display_name || '—'}</DD>

        <DT>Superuser</DT>
        <DD>{user.superuser ? 'Yes' : 'No'}</DD>

        {user.locale && (
          <>
            <DT>Locale</DT>
            <DD>{user.locale}</DD>
          </>
        )}

        {user.timezone && (
          <>
            <DT>Timezone</DT>
            <DD>{user.timezone}</DD>
          </>
        )}
      </DefinitionList>

      {/* Bio */}
      {(user.bio || companies.length > 0) && (
        <>
          <Separator my="2" />
          {user.bio && (
            <>
              <SectionTitle>Bio</SectionTitle>
              <Box mb="3">
                <Text size="2" color={user.bio ? undefined : 'gray'}>
                  {user.bio}
                </Text>
              </Box>
            </>
          )}

          {companies.length > 0 && (
            <>
              <SectionTitle>Companies</SectionTitle>
              <Box mb="3">
                <Text size="2">
                  {companies.map((comp) => (
                    <div key={comp.company_id} style={{ marginBottom: 4 }}>
                      {comp.company_name} ({comp.role})
                    </div>
                  ))}
                </Text>
              </Box>
            </>
          )}
        </>
      )}

      {/* Address */}
      {user.primary_address && (
        <>
          <Separator my="2" />
          <SectionTitle>Address</SectionTitle>
          <DefinitionList>
            <DT>Label</DT>
            <DD>{user.primary_address.name || '—'}</DD>

            <DT>Street</DT>
            <DD>{user.primary_address.address_line || '—'}</DD>

            <DT>City</DT>
            <DD>
              {user.primary_address
                ? `${user.primary_address.zip_code} ${user.primary_address.city}`
                : '—'}
            </DD>

            <DT>Country</DT>
            <DD>{user.primary_address.country || '—'}</DD>
          </DefinitionList>
        </>
      )}

      {/* Optional details (preferences) */}
      {user.preferences && (
        <>
          <Separator my="2" />
          <SectionTitle>Optional details</SectionTitle>
          <DefinitionList>
            <DT>Date of birth</DT>
            <DD>{formatMonthYear(user.preferences.date_of_birth)}</DD>

            <DT>Driver's license</DT>
            <DD>{user.preferences.drivers_license || '—'}</DD>

            <DT>Other licenses</DT>
            <DD>{listOrDash(user.preferences.licenses)}</DD>

            <DT>Certificates</DT>
            <DD>{listOrDash(user.preferences.certificates)}</DD>

            <DT>Notes</DT>
            <DD>
              <Text
                size="2"
                color={user.preferences.notes ? undefined : 'gray'}
              >
                {user.preferences.notes || '—'}
              </Text>
            </DD>
          </DefinitionList>
        </>
      )}
    </Box>
  )
}

/* ---------- tiny UI helpers ---------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text as="div" size="2" weight="bold" mb="2">
      {children}
    </Text>
  )
}

function DefinitionList({ children }: { children: React.ReactNode }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        rowGap: 8,
        columnGap: 12,
        marginBottom: 12,
      }}
    >
      {children}
    </dl>
  )
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt>
      <Text size="1" color="gray">
        {children}
      </Text>
    </dt>
  )
}

function DD({ children }: { children: React.ReactNode }) {
  return (
    <dd>
      <Text size="2">{children}</Text>
    </dd>
  )
}

// Using shared getInitials from generalFunctions

function formatMonthYear(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  // "5. sep 2024" vibe without spelling the day
  const day = d.getDate()
  const rest = d
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    .toLowerCase()
  return `${day}. ${rest}`
}

function listOrDash(arr?: Array<string> | null) {
  if (!arr || arr.length === 0) return '—'
  return arr.join(', ')
}
