import * as React from 'react'
import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'

const clampStyle = (lines: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
})

type MoneySuggestionDescriptionProps = {
  description: string
  confidenceReason?: string | null
  /** Conta Preview / Open in Conta — kept outside the clamp so they stay usable. */
  actions?: React.ReactNode
}

/**
 * Compact suggestion description: 3-line clamp, hover title, click → full text dialog.
 */
export default function MoneySuggestionDescription({
  description,
  confidenceReason,
  actions,
}: MoneySuggestionDescriptionProps) {
  const [open, setOpen] = React.useState(false)
  const hoverTitle = confidenceReason
    ? `${description}\n\n${confidenceReason}`
    : description

  return (
    <Flex direction="column" gap="1" style={{ minWidth: 0, maxWidth: '28rem' }}>
      <Box
        role="button"
        tabIndex={0}
        title={hoverTitle}
        aria-label="Show full description"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <Text size="2" style={clampStyle(3)}>
          {description}
        </Text>
        {confidenceReason ? (
          <Text size="1" color="gray" mt="1" as="p" style={clampStyle(1)}>
            {confidenceReason}
          </Text>
        ) : null}
      </Box>
      {actions}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Description</Dialog.Title>
          <Dialog.Description size="2" mb="3">
            Full suggestion text
          </Dialog.Description>
          <Text size="2" as="p" style={{ whiteSpace: 'pre-wrap' }}>
            {description}
          </Text>
          {confidenceReason ? (
            <Text size="2" color="gray" mt="3" as="p">
              {confidenceReason}
            </Text>
          ) : null}
          <Flex justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  )
}
