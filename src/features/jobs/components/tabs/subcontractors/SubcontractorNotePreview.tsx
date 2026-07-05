import { Button, Flex, Text } from '@radix-ui/themes'
import {
  SUBCONTRACTOR_NOTE_PREVIEW_MAX,
  truncateNotePreview,
} from './noteTextUtils'

export default function SubcontractorNotePreview({
  note,
  onShowMore,
  maxLength = SUBCONTRACTOR_NOTE_PREVIEW_MAX,
  size = '2',
}: {
  note: string
  onShowMore: () => void
  maxLength?: number
  size?: '1' | '2'
}) {
  const { preview, hasMore } = truncateNotePreview(note, maxLength)

  return (
    <Flex align="baseline" gap="1" wrap="wrap">
      <Text size={size} color="gray" style={{ whiteSpace: 'pre-wrap' }}>
        {hasMore ? `${preview}…` : preview}
      </Text>
      {hasMore && (
        <Button
          size="1"
          variant="ghost"
          onClick={onShowMore}
          style={{ flexShrink: 0 }}
        >
          Show more
        </Button>
      )}
    </Flex>
  )
}
