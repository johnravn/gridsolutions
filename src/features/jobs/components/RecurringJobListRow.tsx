import { Avatar, Badge, Box, Flex, Text, Tooltip } from '@radix-ui/themes'
import { Repeat } from 'iconoir-react'
import { getInitials } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
} from '@shared/ui/index-table/indexTableStyles'
import type { RecurringJobListRow } from '../types'

type Props = {
  row: RecurringJobListRow
  isSelected: boolean
  compact?: boolean
  onClick: () => void
}

export default function RecurringJobListRow({
  row,
  isSelected,
  compact = false,
  onClick,
}: Props) {
  const customerName =
    row.customer?.name ??
    row.customer_user?.display_name ??
    row.customer_user?.email ??
    '—'
  const leadName =
    row.project_lead?.display_name || row.project_lead?.email || 'Unassigned'
  const initials = getInitials(
    row.project_lead?.display_name ?? row.project_lead?.email ?? '',
  )
  const avatarUrl = row.project_lead?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(row.project_lead.avatar_url)
        .data.publicUrl
    : null

  return (
    <div
      className={[
        INDEX_TABLE_ROW_CLASS,
        isSelected
          ? INDEX_TABLE_ROW_SELECTED_CLASS
          : compact
            ? 'index-table-row--muted'
            : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      style={{
        cursor: 'pointer',
        padding: compact ? 'var(--space-3)' : 'var(--space-2) var(--space-3)',
        borderRadius: compact ? 'var(--radius-3)' : 'var(--radius-2)',
        marginBottom: compact ? 'var(--space-2)' : 'var(--space-1)',
      }}
    >
      {compact ? (
        <Flex justify="between" align="start" gap="3">
          <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
            <Flex gap="2" align="center" wrap="wrap">
              <Repeat width={14} height={14} />
              <Text weight={isSelected ? 'bold' : 'medium'} size="2">
                {row.title}
              </Text>
              <Badge size="1" color="violet" variant="soft">
                Recurring
              </Badge>
              <Badge size="1" variant="outline">
                {row.job_count} job{row.job_count !== 1 ? 's' : ''}
              </Badge>
            </Flex>
            <Text size="1" color="gray">
              {customerName}
            </Text>
          </Flex>
          <Avatar
            size="2"
            src={avatarUrl ?? undefined}
            fallback={initials}
            radius="full"
          />
        </Flex>
      ) : (
        <Flex align="center" justify="between" gap="3">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Flex gap="2" align="center" wrap="wrap">
              <Repeat width={14} height={14} />
              <Tooltip content={row.title} delayDuration={300}>
                <Text
                  weight={isSelected ? 'bold' : 'medium'}
                  size="2"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {row.title}
                </Text>
              </Tooltip>
              <Badge size="1" color="violet" variant="soft">
                Recurring
              </Badge>
              <Badge size="1" variant="outline">
                {row.job_count} job{row.job_count !== 1 ? 's' : ''}
              </Badge>
            </Flex>
            <Text size="1" color="gray" mt="1">
              {customerName}
            </Text>
          </Box>
          <Flex gap="2" align="center" style={{ flexShrink: 0 }}>
            <Text size="1" color="gray">
              {leadName}
            </Text>
            <Avatar
              size="2"
              src={avatarUrl ?? undefined}
              fallback={initials}
              radius="full"
            />
          </Flex>
        </Flex>
      )}
    </div>
  )
}
