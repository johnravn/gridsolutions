import { Box, Separator } from '@radix-ui/themes'
import { ContentBlockListEditor } from './ContentBlockListEditor'
import type { LocalContentBlock } from './types'

type Props = {
  moduleId: string
  jobId: string
  companyId: string
  offerId: string
  blocks: Array<LocalContentBlock>
  readOnly: boolean
  onChange: (blocks: Array<LocalContentBlock>) => void
}

export function ContentBlocksSection({
  moduleId,
  jobId,
  companyId,
  offerId,
  blocks,
  readOnly,
  onChange,
}: Props) {
  return (
    <Box>
      <ContentBlockListEditor
        moduleId={moduleId}
        jobId={jobId}
        companyId={companyId}
        offerId={offerId}
        blocks={blocks}
        readOnly={readOnly}
        onChange={onChange}
        showTitle
      />

      <Separator size="4" my="3" />
    </Box>
  )
}
