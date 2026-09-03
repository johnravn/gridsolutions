import { Box, Text } from '@radix-ui/themes'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'

export function CrewDateRangeField({
  startAt,
  endAt,
  readOnly = false,
  onChange,
}: {
  startAt: string
  endAt: string
  readOnly?: boolean
  onChange: (range: { startAt: string; endAt: string }) => void
}) {
  return (
    <Box style={{ flex: '1 1 280px' }}>
      <Text size="2" color="gray" mb="1">
        Start and end
      </Text>
      {readOnly ? (
        <Text>
          {startAt && endAt
            ? `${new Date(startAt).toLocaleString('nb-NO')} – ${new Date(endAt).toLocaleString('nb-NO')}`
            : '—'}
        </Text>
      ) : (
        <div onClick={(event) => event.stopPropagation()}>
          <DateTimeRangePicker
            startAt={startAt}
            endAt={endAt}
            onChange={onChange}
            inline
          />
        </div>
      )}
    </Box>
  )
}
