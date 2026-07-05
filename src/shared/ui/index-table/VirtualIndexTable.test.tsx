import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { VirtualIndexTable } from './VirtualIndexTable'

const rows = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Bravo' },
]

const columns = [{ id: 'name', header: 'Name', sortable: true }]

function mockVirtualizer(count: number) {
  return {
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 44,
        size: 44,
        key: String(index),
      })),
    getTotalSize: () => count * 44,
  } as never
}

describe('VirtualIndexTable', () => {
  it('renders header and empty state', () => {
    renderWithProviders(
      <VirtualIndexTable
        rows={[]}
        columns={columns}
        gridTemplateColumns="1fr"
        getRowId={(r) => r.id}
        renderCell={(r) => r.name}
        scrollRef={{ current: null }}
        rowVirtualizer={mockVirtualizer(0)}
        emptyMessage="No items"
      />,
    )

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('No items')).toBeInTheDocument()
  })

  it('renders skeleton rows when loading', () => {
    const { container } = renderWithProviders(
      <VirtualIndexTable
        rows={[]}
        columns={columns}
        gridTemplateColumns="1fr"
        getRowId={(r) => r.id}
        renderCell={(r) => r.name}
        scrollRef={{ current: null }}
        rowVirtualizer={mockVirtualizer(0)}
        isLoading
      />,
    )

    expect(container.querySelectorAll('.rt-Skeleton')).toHaveLength(8)
  })

  it('calls onSelect when row is clicked', () => {
    const onSelect = vi.fn()
    renderWithProviders(
      <VirtualIndexTable
        rows={rows}
        columns={columns}
        gridTemplateColumns="1fr"
        getRowId={(r) => r.id}
        renderCell={(r) => r.name}
        selectedId={null}
        onSelect={onSelect}
        scrollRef={{ current: null }}
        rowVirtualizer={mockVirtualizer(2)}
        horizontalScroll={false}
      />,
    )

    fireEvent.click(screen.getByText('Alpha'))
    expect(onSelect).toHaveBeenCalledWith('1')
  })
})
