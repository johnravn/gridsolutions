import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Box, IconButton } from '@radix-ui/themes'
import { DotsGrid3x3 } from 'iconoir-react'

export function SortableContentBlock({
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
      ref={setActivatorNodeRef as React.Ref<HTMLButtonElement>}
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
      aria-label="Drag to reorder block"
      onClick={(e) => e.stopPropagation()}
    >
      <DotsGrid3x3 width={18} height={18} />
    </IconButton>
  )

  return (
    <Box ref={setNodeRef as React.Ref<HTMLDivElement>} style={style}>
      {children({ handle })}
    </Box>
  )
}
