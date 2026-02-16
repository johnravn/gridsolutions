// src/features/jobs/components/JobsFilter.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Checkbox,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes'
import { Filter } from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import type { JobStatus } from '../types'

const ALL_STATUSES: JobStatus[] = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'invoiced',
  'paid',
]

/** Default: show all statuses except invoiced, canceled, paid */
export const DEFAULT_STATUS_FILTER: JobStatus[] = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
]

type Props = {
  statusFilter: JobStatus[]
  onStatusFilterChange: (v: JobStatus[]) => void
  showOnlyArchived: boolean
  onShowOnlyArchivedChange: (v: boolean) => void
}

export default function JobsFilter({
  statusFilter,
  onStatusFilterChange,
  showOnlyArchived,
  onShowOnlyArchivedChange,
}: Props) {
  const [open, setOpen] = React.useState(false)

  const statusCount =
    statusFilter.length === 0 || statusFilter.length === ALL_STATUSES.length
      ? 0
      : statusFilter.length
  const activeCount = statusCount + (showOnlyArchived ? 1 : 0)

  const toggleStatus = (status: JobStatus) => {
    if (statusFilter.includes(status)) {
      onStatusFilterChange(statusFilter.filter((s) => s !== status))
    } else {
      onStatusFilterChange([...statusFilter, status])
    }
  }

  const selectAllStatuses = () => {
    onStatusFilterChange([])
  }

  const selectOnlyStatus = (status: JobStatus) => {
    onStatusFilterChange([status])
  }

  const selectDefault = () => {
    onStatusFilterChange([...DEFAULT_STATUS_FILTER])
  }

  const isDefault =
    statusFilter.length === DEFAULT_STATUS_FILTER.length &&
    DEFAULT_STATUS_FILTER.every((s) => statusFilter.includes(s))

  const showAllStatuses = statusFilter.length === 0
  const [hoveredStatus, setHoveredStatus] = React.useState<JobStatus | null>(
    null,
  )

  const resetFilters = () => {
    onShowOnlyArchivedChange(false)
    onStatusFilterChange([...DEFAULT_STATUS_FILTER])
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger>
        <Box style={{ position: 'relative', display: 'inline-block' }}>
          <IconButton variant="soft" size="2">
            <Filter width={16} height={16} />
          </IconButton>
          {activeCount > 0 && (
            <Box
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-9)',
                color: 'white',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeCount}
            </Box>
          )}
        </Box>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" style={{ minWidth: 240 }}>
        <Flex justify="between" align="center" mb="1">
          <DropdownMenu.Label>Visibility</DropdownMenu.Label>
          <Button
            size="1"
            variant="soft"
            color="gray"
            onClick={(e) => {
              e.preventDefault()
              resetFilters()
            }}
          >
            Reset filters
          </Button>
        </Flex>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            if (showOnlyArchived) onShowOnlyArchivedChange(false)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={!showOnlyArchived} />
            <Text>Show all</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            if (!showOnlyArchived) onShowOnlyArchivedChange(true)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showOnlyArchived} />
            <Text>Show archived</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Status</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            selectDefault()
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={isDefault} />
            <Text>Active only (excl. invoiced, canceled, paid)</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>By status</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            selectAllStatuses()
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showAllStatuses} />
            <Text>All</Text>
          </Flex>
        </DropdownMenu.Item>
        {ALL_STATUSES.map((status) => (
          <DropdownMenu.Item
            key={status}
            onSelect={(e) => {
              e.preventDefault()
              toggleStatus(status)
            }}
            onMouseEnter={() => setHoveredStatus(status)}
            onMouseLeave={() => setHoveredStatus(null)}
          >
            <Flex align="center" justify="between" gap="2" style={{ width: '100%' }}>
              <Flex align="center" gap="2">
                <Checkbox checked={statusFilter.includes(status)} />
                <Text>{makeWordPresentable(status)}</Text>
              </Flex>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-1)',
                  color: 'var(--gray-a10)',
                  flexShrink: 0,
                  opacity: hoveredStatus === status ? 1 : 0,
                  pointerEvents: hoveredStatus === status ? 'auto' : 'none',
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  selectOnlyStatus(status)
                }}
              >
                Only
              </button>
            </Flex>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
