import { Button } from '@radix-ui/themes'
import { downloadCsv, toCsv } from '../utils/csv'

export function ExportCsvButton({
  filename,
  headers,
  rows,
  disabled,
}: {
  filename: string
  headers: Array<string>
  rows: Array<Array<string | number | null | undefined>>
  disabled?: boolean
}) {
  return (
    <Button
      size="2"
      variant="soft"
      disabled={disabled || rows.length === 0}
      onClick={() => downloadCsv(filename, toCsv(headers, rows))}
    >
      Export CSV
    </Button>
  )
}
