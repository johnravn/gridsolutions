import { Box, Dialog, Flex, IconButton, Text } from '@radix-ui/themes'
import { Xmark } from 'iconoir-react'
import type { ReactNode } from 'react'

export function HomeBottomSheet({
  open,
  onOpenChange,
  title,
  headerAction,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  headerAction?: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        aria-describedby={undefined}
        className="home-bottom-sheet"
        style={{
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          top: 'auto',
          left: 0,
          right: 0,
          margin: 0,
          maxWidth: '100%',
          width: '100%',
          maxHeight: '70dvh',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'hidden',
        }}
      >
        <Flex
          align="center"
          justify="between"
          gap="3"
          style={{ flexShrink: 0 }}
        >
          <Dialog.Title mb="0" style={{ flex: 1, minWidth: 0 }}>
            <Text size="5" weight="bold" as="span">
              {title}
            </Text>
          </Dialog.Title>
          <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
            {headerAction}
            <Dialog.Close>
              <IconButton
                size="2"
                variant="ghost"
                color="gray"
                aria-label="Close"
              >
                <Xmark width={18} height={18} />
              </IconButton>
            </Dialog.Close>
          </Flex>
        </Flex>
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {children}
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  )
}
