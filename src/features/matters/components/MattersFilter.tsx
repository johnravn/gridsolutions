// src/features/matters/components/MattersFilter.tsx
import * as React from 'react'
import {
  Box,
  Checkbox,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes'
import { Filter } from 'iconoir-react'
import type { MatterType } from '../types'

const TYPE_LABELS: Record<MatterType, string> = {
  crew_invite: 'Crew Invite',
  vote: 'Vote',
  announcement: 'Announcement',
  chat: 'Chat',
  update: 'Update',
}

const TYPE_ORDER: MatterType[] = [
  'vote',
  'announcement',
  'chat',
  'update',
  'crew_invite',
]

type Props = {
  unreadFilter: boolean
  onUnreadFilterChange: (v: boolean) => void
  companyFilter: string[]
  onCompanyFilterChange: (v: string[]) => void
  typeFilter: MatterType[]
  onTypeFilterChange: (v: MatterType[]) => void
  companies: Array<{ id: string; name: string }>
}

export default function MattersFilter({
  unreadFilter,
  onUnreadFilterChange,
  companyFilter,
  onCompanyFilterChange,
  typeFilter,
  onTypeFilterChange,
  companies,
}: Props) {
  const [open, setOpen] = React.useState(false)

  const activeCount =
    (unreadFilter ? 1 : 0) + companyFilter.length + typeFilter.length

  const toggleCompany = (companyId: string) => {
    if (companyFilter.includes(companyId)) {
      onCompanyFilterChange(companyFilter.filter((id) => id !== companyId))
    } else {
      onCompanyFilterChange([...companyFilter, companyId])
    }
  }

  const toggleType = (type: MatterType) => {
    if (typeFilter.includes(type)) {
      onTypeFilterChange(typeFilter.filter((t) => t !== type))
    } else {
      onTypeFilterChange([...typeFilter, type])
    }
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
      <DropdownMenu.Content align="end" style={{ minWidth: 220 }}>
        <DropdownMenu.Label>Status</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onUnreadFilterChange(!unreadFilter)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={unreadFilter}
              onCheckedChange={onUnreadFilterChange}
            />
            <Text>Unread only</Text>
          </Flex>
        </DropdownMenu.Item>

        {companies.length > 0 && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Label>Company</DropdownMenu.Label>
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault()
                onCompanyFilterChange([])
              }}
            >
              <Flex align="center" gap="2">
                <Checkbox checked={companyFilter.length === 0} />
                <Text>All Companies</Text>
              </Flex>
            </DropdownMenu.Item>
            {companies.map((c) => (
              <DropdownMenu.Item
                key={c.id}
                onSelect={(e) => {
                  e.preventDefault()
                  toggleCompany(c.id)
                }}
              >
                <Flex align="center" gap="2">
                  <Checkbox checked={companyFilter.includes(c.id)} />
                  <Text>{c.name}</Text>
                </Flex>
              </DropdownMenu.Item>
            ))}
          </>
        )}

        <DropdownMenu.Separator />
        <DropdownMenu.Label>Type</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onTypeFilterChange([])
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={typeFilter.length === 0} />
            <Text>All Types</Text>
          </Flex>
        </DropdownMenu.Item>
        {TYPE_ORDER.map((value) => (
          <DropdownMenu.Item
            key={value}
            onSelect={(e) => {
              e.preventDefault()
              toggleType(value)
            }}
          >
            <Flex align="center" gap="2">
              <Checkbox checked={typeFilter.includes(value)} />
              <Text>{TYPE_LABELS[value]}</Text>
            </Flex>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
