import * as React from 'react'
import { Box, Button, Flex, Text, TextField } from '@radix-ui/themes'
import { EditPencil } from 'iconoir-react'
import { resolveSubcontractorMarkupPercent } from '../../../utils/prettyOfferCalculations'

type Props = {
  companyMarkupPercent: number | null | undefined
  offerMarkupPercent: number | null | undefined
  readOnly: boolean
  onChange: (value: number | null) => void
}

function formatPercent(value: number) {
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2).replace(/\.?0+$/, '')}%`
}

export function SubcontractorMarkupField({
  companyMarkupPercent,
  offerMarkupPercent,
  readOnly,
  onChange,
}: Props) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')

  const effectivePercent = resolveSubcontractorMarkupPercent(
    offerMarkupPercent,
    companyMarkupPercent,
  )
  const usesCompanyDefault = offerMarkupPercent == null
  const hasMarkup = effectivePercent > 0 || companyMarkupPercent != null

  React.useEffect(() => {
    if (!isEditing) return
    setDraft(
      offerMarkupPercent != null
        ? String(offerMarkupPercent)
        : String(effectivePercent),
    )
  }, [isEditing, offerMarkupPercent, effectivePercent])

  const commitDraft = () => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      onChange(null)
      setIsEditing(false)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return
    onChange(parsed)
    setIsEditing(false)
  }

  if (isEditing && !readOnly) {
    return (
      <Box
        className="pretty-offer-markup-display pretty-offer-markup-display--editing"
        style={{ flex: '0 0 220px', minWidth: 200 }}
      >
        <Text size="2" weight="medium" mb="1" as="div">
          Subcontractor markup
        </Text>
        <Flex direction="column" gap="2">
          <TextField.Root
            type="number"
            min="0"
            max="1000"
            step="0.01"
            size="2"
            placeholder="e.g. 15"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            onBlur={commitDraft}
          />
          {companyMarkupPercent != null && (
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(null)
                setIsEditing(false)
              }}
            >
              Use company default ({formatPercent(companyMarkupPercent)})
            </Button>
          )}
        </Flex>
      </Box>
    )
  }

  return (
    <Box
      className="pretty-offer-markup-display"
      style={{ flex: '0 0 220px', minWidth: 200 }}
    >
      <Text size="2" weight="medium" mb="1" as="div">
        Subcontractor markup
      </Text>
      <Flex
        align="center"
        justify="between"
        gap="2"
        className="pretty-offer-markup-display__surface"
      >
        <Box style={{ minWidth: 0 }}>
          <Text size="2" weight="medium" as="div">
            {hasMarkup ? formatPercent(effectivePercent) : 'Not set'}
          </Text>
          <Text size="1" color="gray" as="div">
            {usesCompanyDefault
              ? companyMarkupPercent != null
                ? 'Company standard'
                : 'Set in company rates'
              : 'Custom for this offer'}
          </Text>
        </Box>
        {!readOnly && (
          <Button
            size="1"
            variant="ghost"
            color="gray"
            className="pretty-offer-markup-display__edit"
            aria-label="Edit subcontractor markup"
            onClick={() => setIsEditing(true)}
          >
            <EditPencil width={14} height={14} />
            Edit
          </Button>
        )}
      </Flex>
    </Box>
  )
}
