import { Table } from '@radix-ui/themes'
import type { SortDir } from '../types'

export function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: string
  activeKey: string | null
  dir: SortDir
  onSort: (key: string) => void
  align?: 'left' | 'right' | 'center'
}) {
  const active = activeKey === sortKey
  const indicator = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <Table.ColumnHeaderCell
      align={align}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {indicator}
    </Table.ColumnHeaderCell>
  )
}
