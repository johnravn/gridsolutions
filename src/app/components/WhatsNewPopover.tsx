import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Popover,
  Separator,
  Text,
} from '@radix-ui/themes'
import { Sparks, Xmark } from 'iconoir-react'
import { APP_VERSION, RELEASE_NOTES } from '@app/config/releaseNotes'
import { useWhatsNew } from '@app/hooks/useWhatsNew'

type Props = {
  userId: string | undefined
  profileLoaded: boolean
  lastSeenReleaseVersion: string | null | undefined
}

export function WhatsNewPopover({
  userId,
  profileLoaded,
  lastSeenReleaseVersion,
}: Props) {
  const { shouldShow, dismiss, isDismissing } = useWhatsNew({
    userId,
    profileLoaded,
    lastSeenReleaseVersion,
  })
  const [open, setOpen] = React.useState(false)
  const autoOpenedRef = React.useRef(false)

  React.useEffect(() => {
    if (shouldShow && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      setOpen(true)
    }
    if (!shouldShow) {
      autoOpenedRef.current = false
      setOpen(false)
    }
  }, [shouldShow])

  if (!shouldShow) return null

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) dismiss()
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger>
        <Button
          size="2"
          variant="soft"
          color="blue"
          style={{ position: 'relative' }}
        >
          <Sparks width={16} height={16} />
          What's new
          <Badge
            color="blue"
            variant="solid"
            size="1"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 8,
              height: 8,
              padding: 0,
            }}
            aria-hidden
          />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        style={{
          width: 'min(360px, calc(100vw - 32px))',
          maxHeight: 'min(70dvh, 560px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Flex align="start" justify="between" gap="3" mb="2" style={{ flexShrink: 0 }}>
          <Box style={{ minWidth: 0 }}>
            <Text size="3" weight="bold" as="div">
              {RELEASE_NOTES.title}
            </Text>
            <Text size="1" color="gray" as="div">
              v{APP_VERSION}
            </Text>
          </Box>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            aria-label="Close"
            onClick={() => setOpen(false)}
            disabled={isDismissing}
          >
            <Xmark width={16} height={16} />
          </IconButton>
        </Flex>

        <Separator size="4" mb="3" style={{ flexShrink: 0 }} />

        <Box
          mb="4"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          <Flex direction="column" gap="3">
            {RELEASE_NOTES.highlights.map((highlight) => (
              <Box key={highlight.title}>
                <Text size="2" weight="medium" as="div">
                  {highlight.title}
                </Text>
                <Text size="2" color="gray" as="div">
                  {highlight.description}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>

        <Flex justify="end" style={{ flexShrink: 0 }}>
          <Button
            size="2"
            onClick={() => setOpen(false)}
            disabled={isDismissing}
          >
            Got it
          </Button>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  )
}
