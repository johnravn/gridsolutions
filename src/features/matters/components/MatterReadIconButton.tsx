import { IconButton, Tooltip } from '@radix-ui/themes'
import { Check, Mail } from 'iconoir-react'

export function MatterReadIconButton({
  isUnread,
  disabled,
  size = '1',
  onMarkRead,
  onMarkUnread,
}: {
  isUnread: boolean
  disabled?: boolean
  size?: '1' | '2'
  onMarkRead: () => void
  onMarkUnread: () => void
}) {
  const label = isUnread ? 'Mark as read' : 'Mark as unread'
  return (
    <Tooltip content={label}>
      <IconButton
        size={size}
        variant="soft"
        highContrast
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          if (isUnread) onMarkRead()
          else onMarkUnread()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={label}
      >
        {isUnread ? (
          <Check width={14} height={14} />
        ) : (
          <Mail width={14} height={14} />
        )}
      </IconButton>
    </Tooltip>
  )
}
