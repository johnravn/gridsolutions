import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Code,
  DropdownMenu,
  Flex,
  Avatar as RadixAvatar,
  Select,
  Separator,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import { EditPencil } from 'iconoir-react'
import { toEventInputs } from '@features/calendar/components/domain'
import InspectorCalendar from '@features/calendar/components/InspectorCalendar'
import { crewCalendarQuery } from '@features/calendar/api/queries'
import ChangeRoleConfirmDialog from '@features/company/components/dialogs/ChangeRoleConfirmDialog'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import {
  crewDetailQuery,
  crewIndexQuery,
  updateCrewMemberRate,
} from '../api/queries'
import type { CrewDetail } from '../api/queries'
import type { CompanyRole } from '@features/company/api/queries'

export default function CrewInspector({ userId }: { userId: string | null }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const { companyRole } = useAuthz()
  const [changeRoleOpen, setChangeRoleOpen] = React.useState(false)
  const [roleChangeInfo, setRoleChangeInfo] = React.useState<{
    userId: string
    userName: string
    userEmail: string
    currentRole: CompanyRole
    newRole: CompanyRole
  } | null>(null)

  // Rate editing state
  const [isEditingRate, setIsEditingRate] = React.useState(false)
  const [rateType, setRateType] = React.useState<'daily' | 'hourly' | null>(
    null,
  )
  const [rate, setRate] = React.useState<string>('')

  const { data, isLoading, isError, error } = useQuery<CrewDetail | null>({
    ...(companyId && userId
      ? crewDetailQuery({ companyId, userId })
      : {
          queryKey: ['company', 'none', 'crew-detail', 'none'] as const,
          queryFn: async () => null,
        }),
    enabled: !!companyId && !!userId,
  })

  // Get owners count to check if this is the last owner
  const { data: owners = [] } = useQuery({
    ...(companyId && data?.role === 'owner'
      ? crewIndexQuery({ companyId, kind: 'owner' })
      : { queryKey: ['crew-index', 'none'], queryFn: async () => [] }),
    enabled: !!companyId && !!data && data.role === 'owner',
  })

  const isLastOwner = data?.role === 'owner' && owners.length <= 1

  // Fetch calendar events for this crew member
  const { data: calendarRecords = [] } = useQuery({
    ...crewCalendarQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId,
  })

  const events = React.useMemo(
    () => toEventInputs(calendarRecords),
    [calendarRecords],
  )

  // Fetch company general rates for employees/owners
  const { data: companyRates } = useQuery({
    queryKey: ['company', companyId, 'general-rates'] as const,
    enabled:
      !!companyId &&
      !!data &&
      (data.role === 'employee' || data.role === 'owner'),
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('companies')
        .select(
          'employee_daily_rate, employee_hourly_rate, owner_daily_rate, owner_hourly_rate',
        )
        .eq('id', companyId)
        .single()
      if (error) throw error
      return data
    },
  })

  // Initialize rate editing state when data loads
  React.useEffect(() => {
    if (data) {
      setRateType(data.rate_type)
      setRate(data.rate?.toString() ?? '')
    }
  }, [data])

  // Rate update mutation
  const updateRateMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId) throw new Error('Missing company or user ID')
      const rateValue = rate.trim() === '' ? null : parseFloat(rate)
      if (rateValue !== null && (isNaN(rateValue) || rateValue < 0)) {
        throw new Error('Rate must be a positive number')
      }
      await updateCrewMemberRate({
        companyId,
        userId,
        rateType,
        rate: rateValue,
      })
    },
    onSuccess: () => {
      success('Success', 'Rate updated successfully')
      setIsEditingRate(false)
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'crew-detail', userId],
      })
    },
    onError: (e: any) => {
      toastError('Failed to update rate', e?.message ?? 'Please try again.')
    },
  })

  const avatarUrl = React.useMemo(() => {
    if (!data?.avatar_url) return null
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.avatar_url)
    return urlData.publicUrl
  }, [data?.avatar_url])

  if (!userId)
    return <Text color="gray">Select a crew member to view details.</Text>
  if (isLoading)
    return (
      <Flex align="center" gap="1">
        <Text>Thinking</Text>
        <Spinner size="2" />
      </Flex>
    )
  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )
  if (!data) return <Text color="gray">Not found.</Text>

  const fullName =
    data.display_name ||
    [data.first_name, data.last_name].filter(Boolean).join(' ') ||
    null

  const roleColor: React.ComponentProps<typeof Badge>['color'] =
    data.role === 'owner'
      ? 'purple'
      : data.role === 'employee'
        ? 'blue'
        : data.role === 'super_user'
          ? 'amber'
          : 'green'

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="3" mb="3" wrap="wrap">
        <Flex align="center" gap="3">
          <RadixAvatar
            size="5"
            radius="full"
            src={avatarUrl ?? undefined}
            fallback={getInitials(fullName ?? data.email)}
            style={{ border: '1px solid var(--gray-5)' }}
          />
          <div>
            <Text as="div" size="4" weight="bold">
              {fullName ?? data.email}
            </Text>
            <Text as="div" color="gray" size="2">
              <a href={`mailto:${data.email}`} style={{ color: 'inherit' }}>
                {data.email}
              </a>
            </Text>
          </div>
        </Flex>

        <Flex align="center" gap="2">
          <Badge variant="soft" color={roleColor}>
            {data.role}
          </Badge>
          {/* Only show role change for employees, freelancers, and owners (not super_user) */}
          {data.role !== 'super_user' && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <EditPencil
                  style={{ color: 'var(--gray-9)', cursor: 'pointer' }}
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="bottom">
                <DropdownMenu.Label>Set role</DropdownMenu.Label>
                <DropdownMenu.Item
                  disabled={data.role === 'owner' || isLastOwner}
                  onSelect={(e) => {
                    e.preventDefault()
                    setRoleChangeInfo({
                      userId: data.user_id,
                      userName: fullName || data.email,
                      userEmail: data.email,
                      currentRole: data.role as CompanyRole,
                      newRole: 'freelancer',
                    })
                    setChangeRoleOpen(true)
                  }}
                >
                  Freelancer
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={data.role === 'employee'}
                  onSelect={(e) => {
                    e.preventDefault()
                    setRoleChangeInfo({
                      userId: data.user_id,
                      userName: fullName || data.email,
                      userEmail: data.email,
                      currentRole: data.role as CompanyRole,
                      newRole: 'employee',
                    })
                    setChangeRoleOpen(true)
                  }}
                >
                  Employee
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  disabled={data.role === 'owner'}
                  onSelect={(e) => {
                    e.preventDefault()
                    setRoleChangeInfo({
                      userId: data.user_id,
                      userName: fullName || data.email,
                      userEmail: data.email,
                      currentRole: data.role as CompanyRole,
                      newRole: 'owner',
                    })
                    setChangeRoleOpen(true)
                  }}
                >
                  Owner
                </DropdownMenu.Item>
                {isLastOwner && (
                  <>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item disabled>
                      Can't demote last owner
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </Flex>
      </Flex>

      <ChangeRoleConfirmDialog
        open={changeRoleOpen}
        onOpenChange={setChangeRoleOpen}
        onChanged={() => {
          // Refresh crew detail to get updated role
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'crew-detail', userId],
          })
          // Also refresh crew index to update lists
          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === 'company' &&
              q.queryKey[1] === companyId &&
              q.queryKey[2] === 'crew-index',
          })
        }}
        userName={roleChangeInfo?.userName ?? ''}
        userEmail={roleChangeInfo?.userEmail ?? ''}
        currentRole={roleChangeInfo?.currentRole ?? 'employee'}
        newRole={roleChangeInfo?.newRole ?? 'employee'}
        userId={roleChangeInfo?.userId ?? ''}
      />

      <Separator my="2" />

      {/* Primary info */}
      <DefinitionList>
        <DT>Joined</DT>
        <DD>{formatMonthYear(data.created_at)}</DD>

        <DT>Phone</DT>
        <DD>
          {data.phone ? (
            <a href={`tel:${data.phone}`} style={{ color: 'inherit' }}>
              {prettyPhone(data.phone)}
            </a>
          ) : (
            '—'
          )}
        </DD>

        <DT>First name</DT>
        <DD>{data.first_name || '—'}</DD>

        <DT>Last name</DT>
        <DD>{data.last_name || '—'}</DD>

        <DT>Display name</DT>
        <DD>{data.display_name || '—'}</DD>
      </DefinitionList>

      <Separator my="2" />

      {/* Billing Rate - show for employees, freelancers, and owners */}
      {(data.role === 'employee' ||
        data.role === 'freelancer' ||
        data.role === 'owner') && (
        <>
          <SectionTitle>Billing Rate</SectionTitle>
          {data.role === 'freelancer' && !isEditingRate ? (
            <Box mb="3">
              <DefinitionList>
                <DT>Rate type</DT>
                <DD>{data.rate_type ? data.rate_type : '—'}</DD>

                <DT>Rate</DT>
                <DD>
                  {data.rate !== null
                    ? `${data.rate.toFixed(2)} kr ${data.rate_type === 'daily' ? 'per day' : 'per hour'}`
                    : '—'}
                </DD>

                {data.rate_updated_at && (
                  <>
                    <DT>Last updated</DT>
                    <DD>
                      <Text size="1" color="gray">
                        {formatMonthYear(data.rate_updated_at)}
                      </Text>
                    </DD>
                  </>
                )}
              </DefinitionList>
              <Button
                size="2"
                variant="soft"
                onClick={() => setIsEditingRate(true)}
                style={{ marginTop: 8 }}
              >
                <EditPencil width={14} height={14} />
                Edit rate
              </Button>
            </Box>
          ) : data.role === 'freelancer' && isEditingRate ? (
            <Box mb="3">
              <Flex direction="column" gap="3">
                <Flex align="end" gap="3" wrap="wrap">
                  <Box style={{ flex: 1, minWidth: 150 }}>
                    <Text
                      as="label"
                      size="2"
                      weight="medium"
                      mb="1"
                      style={{ display: 'block' }}
                    >
                      Rate type
                    </Text>
                    <Select.Root
                      value={rateType ?? 'none'}
                      onValueChange={(value) =>
                        setRateType(
                          value === 'none'
                            ? null
                            : (value as 'daily' | 'hourly'),
                        )
                      }
                    >
                      <Select.Trigger placeholder="Select rate type" />
                      <Select.Content>
                        <Select.Item value="none">None</Select.Item>
                        <Select.Item value="daily">Daily</Select.Item>
                        <Select.Item value="hourly">Hourly</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Box>

                  <Box style={{ flex: '0 0 auto', minWidth: 120 }}>
                    <Text
                      as="label"
                      size="2"
                      weight="medium"
                      mb="1"
                      style={{ display: 'block' }}
                    >
                      Rate amount
                    </Text>
                    <Flex align="center" gap="2">
                      <TextField.Root
                        type="number"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        style={{ width: 100 }}
                      />
                      <Text size="2" color="gray">
                        kr
                      </Text>
                    </Flex>
                  </Box>
                </Flex>

                <Flex gap="2">
                  <Button
                    size="2"
                    variant="solid"
                    onClick={() => updateRateMutation.mutate()}
                    disabled={updateRateMutation.isPending}
                  >
                    {updateRateMutation.isPending ? (
                      <>
                        <Spinner size="2" /> Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => {
                      setIsEditingRate(false)
                      // Reset to original values
                      setRateType(data.rate_type)
                      setRate(data.rate?.toString() ?? '')
                    }}
                    disabled={updateRateMutation.isPending}
                  >
                    Cancel
                  </Button>
                </Flex>
              </Flex>
            </Box>
          ) : (
            // Read-only display for employees and owners (using general rates)
            <Box mb="3">
              <DefinitionList>
                {data.role === 'employee' && (
                  <>
                    <DT>Daily rate</DT>
                    <DD>
                      {companyRates?.employee_daily_rate
                        ? `${Number(companyRates.employee_daily_rate).toFixed(2)} kr per day`
                        : '—'}
                    </DD>
                    <DT>Hourly rate</DT>
                    <DD>
                      {companyRates?.employee_hourly_rate
                        ? `${Number(companyRates.employee_hourly_rate).toFixed(2)} kr per hour`
                        : '—'}
                    </DD>
                  </>
                )}
                {data.role === 'owner' && (
                  <>
                    <DT>Daily rate</DT>
                    <DD>
                      {companyRates?.owner_daily_rate
                        ? `${Number(companyRates.owner_daily_rate).toFixed(2)} kr per day`
                        : '—'}
                    </DD>
                    <DT>Hourly rate</DT>
                    <DD>
                      {companyRates?.owner_hourly_rate
                        ? `${Number(companyRates.owner_hourly_rate).toFixed(2)} kr per hour`
                        : '—'}
                    </DD>
                  </>
                )}
                <DT>Note</DT>
                <DD>
                  <Text size="1" color="gray">
                    General rates are set in Company → Setup (owners only)
                  </Text>
                </DD>
              </DefinitionList>
            </Box>
          )}
          <Separator my="2" />
        </>
      )}

      {/* Bio */}
      <SectionTitle>Bio</SectionTitle>
      <Box mb="3">
        <Text size="2" color={data.bio ? undefined : 'gray'}>
          {data.bio || '—'}
        </Text>
      </Box>

      <Separator my="2" />

      {/* Address */}
      <SectionTitle>Address</SectionTitle>
      <DefinitionList>
        <DT>Label</DT>
        <DD>{data.primary_address?.name || '—'}</DD>

        <DT>Street</DT>
        <DD>{data.primary_address?.address_line || '—'}</DD>

        <DT>City</DT>
        <DD>
          {data.primary_address
            ? `${data.primary_address.zip_code} ${data.primary_address.city}`
            : '—'}
        </DD>

        <DT>Country</DT>
        <DD>{data.primary_address?.country || '—'}</DD>
      </DefinitionList>

      {!data.primary_address && (
        <Text size="2" color="gray" mb="3">
          No address on file
        </Text>
      )}

      <Separator my="2" />

      {/* Optional details (preferences) */}
      <SectionTitle>Optional details</SectionTitle>
      <DefinitionList>
        <DT>Date of birth</DT>
        <DD>{formatMonthYear(data.preferences?.date_of_birth)}</DD>

        <DT>Driver's license</DT>
        <DD>{data.preferences?.drivers_license || '—'}</DD>

        <DT>Other licenses</DT>
        <DD>{listOrDash(data.preferences?.licenses)}</DD>

        <DT>Certificates</DT>
        <DD>{listOrDash(data.preferences?.certificates)}</DD>

        <DT>Notes</DT>
        <DD>
          <Text size="2" color={data.preferences?.notes ? undefined : 'gray'}>
            {data.preferences?.notes || '—'}
          </Text>
        </DD>
      </DefinitionList>

      <Separator my="2" />

      {/* Calendar */}
      <InspectorCalendar
        events={events}
        calendarHref={`/calendar?userId=${userId}`}
        onCreate={(e) => {}}
        onUpdate={(id, patch) => {}}
        onDelete={(id) => {}}
      />
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
