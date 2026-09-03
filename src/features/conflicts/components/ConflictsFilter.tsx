import { Flex, Select } from '@radix-ui/themes'
import { CONFLICT_KIND_LABEL } from '../utils/conflictItems'
import type { ConflictListFilters } from '../utils/conflictItems'

export default function ConflictsFilter({
  filters,
  onChange,
}: {
  filters: ConflictListFilters
  onChange: (next: ConflictListFilters) => void
}) {
  return (
    <Flex align="center" gap="2" wrap="wrap">
      <Select.Root
        value={filters.status}
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value as ConflictListFilters['status'],
          })
        }
      >
        <Select.Trigger style={{ minWidth: 140 }} />
        <Select.Content>
          <Select.Item value="all">All statuses</Select.Item>
          <Select.Item value="unresolved">Unresolved</Select.Item>
          <Select.Item value="forced">Forced</Select.Item>
        </Select.Content>
      </Select.Root>
      <Select.Root
        value={filters.kind}
        onValueChange={(value) =>
          onChange({
            ...filters,
            kind: value as ConflictListFilters['kind'],
          })
        }
      >
        <Select.Trigger style={{ minWidth: 140 }} />
        <Select.Content>
          <Select.Item value="all">All types</Select.Item>
          {(
            Object.keys(CONFLICT_KIND_LABEL) as Array<
              keyof typeof CONFLICT_KIND_LABEL
            >
          ).map((kind) => (
            <Select.Item key={kind} value={kind}>
              {CONFLICT_KIND_LABEL[kind]}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  )
}
