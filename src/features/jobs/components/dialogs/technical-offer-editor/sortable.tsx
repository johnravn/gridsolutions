import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Box, IconButton, Table } from '@radix-ui/themes'
import { DotsGrid3x3 } from 'iconoir-react'

export function SortableEquipmentRow({
  id,
  children,
  disabled,
}: {
  id: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
    background: isDragging ? 'var(--gray-a2)' : undefined,
  }

  return (
    <Table.Row ref={setNodeRef as any} style={style}>
      {!disabled && (
        <Table.Cell
          style={{
            width: 40,
            paddingLeft: 6,
            paddingRight: 6,
            verticalAlign: 'middle',
          }}
        >
          <IconButton
            ref={setActivatorNodeRef as any}
            size="1"
            variant="ghost"
            color="gray"
            style={{
              cursor: 'grab',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
            }}
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <DotsGrid3x3 width={18} height={18} />
          </IconButton>
        </Table.Cell>
      )}
      {children}
    </Table.Row>
  )
}

export function SortableCrewCard({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (props: { handle: React.ReactNode }) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
  }

  const handle = disabled ? null : (
    <IconButton
      ref={setActivatorNodeRef as any}
      size="1"
      variant="ghost"
      color="gray"
      style={{
        cursor: 'grab',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
      }}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
    >
      <DotsGrid3x3 width={18} height={18} />
    </IconButton>
  )

  return (
    <Box ref={setNodeRef as any} style={style}>
      {children({ handle })}
    </Box>
  )
}

export function SortableEquipmentGroupCard({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (props: { handle: React.ReactNode }) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
  }

  const handle = disabled ? null : (
    <IconButton
      ref={setActivatorNodeRef as any}
      size="1"
      variant="ghost"
      color="gray"
      style={{
        cursor: 'grab',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
      }}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder group"
      onClick={(e) => e.stopPropagation()}
    >
      <DotsGrid3x3 width={18} height={18} />
    </IconButton>
  )

  return (
    <Box ref={setNodeRef as any} style={style}>
      {children({ handle })}
    </Box>
  )
}

