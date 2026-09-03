import * as React from 'react'
import { DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes'
import { NavArrowDown } from 'iconoir-react'

export function MattersInboxMenu({
  visible,
  checkedCount,
  checkedUnreadCount,
  checkedReadCount,
  unreadCount,
  unreadFilter,
  onMarkCheckedRead,
  onMarkCheckedUnread,
  onShowUnread,
  onShowAll,
  onMarkAllUnreadAsRead,
  onSelectAll,
  onClearSelection,
  pending,
}: {
  visible: boolean
  checkedCount: number
  checkedUnreadCount: number
  checkedReadCount: number
  unreadCount: number
  unreadFilter: boolean
  onMarkCheckedRead: () => void
  onMarkCheckedUnread: () => void
  onShowUnread: () => void
  onShowAll: () => void
  onMarkAllUnreadAsRead: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  pending?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!visible) setOpen(false)
  }, [visible])

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={(next) => {
        if (next && !visible) return
        setOpen(next)
      }}
    >
      <DropdownMenu.Trigger>
        <IconButton
          type="button"
          variant="ghost"
          color="gray"
          size="1"
          aria-label="Inbox actions"
          aria-hidden={!visible}
          tabIndex={visible ? undefined : -1}
          data-visible={visible ? '' : undefined}
          className="matters-select-actions"
          style={{
            marginLeft: -2,
            width: 18,
            height: 18,
            minWidth: 18,
            padding: 0,
          }}
        >
          <NavArrowDown width={12} height={12} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" style={{ minWidth: 240 }}>
        <DropdownMenu.Label>Checked</DropdownMenu.Label>
        <DropdownMenu.Item
          disabled={pending || checkedUnreadCount === 0}
          onSelect={onMarkCheckedRead}
        >
          Mark checked as read
          {checkedUnreadCount > 0 ? ` (${checkedUnreadCount})` : ''}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={pending || checkedReadCount === 0}
          onSelect={onMarkCheckedUnread}
        >
          Mark checked as unread
          {checkedReadCount > 0 ? ` (${checkedReadCount})` : ''}
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled={pending} onSelect={onSelectAll}>
          Select all visible
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={pending || checkedCount === 0}
          onSelect={onClearSelection}
        >
          Clear selection
        </DropdownMenu.Item>

        <DropdownMenu.Separator />
        <DropdownMenu.Label>View</DropdownMenu.Label>
        <DropdownMenu.Item disabled={unreadFilter} onSelect={onShowUnread}>
          <Flex align="center" justify="between" gap="3" width="100%">
            <Text>Show unread only</Text>
            {unreadFilter ? (
              <Text size="1" color="gray">
                On
              </Text>
            ) : null}
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled={!unreadFilter} onSelect={onShowAll}>
          Show all
        </DropdownMenu.Item>

        <DropdownMenu.Separator />
        <DropdownMenu.Label>Inbox</DropdownMenu.Label>
        <DropdownMenu.Item
          disabled={pending || unreadCount === 0}
          onSelect={onMarkAllUnreadAsRead}
        >
          Mark all unread as read
          {unreadCount > 0 ? ` (${unreadCount})` : ''}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
