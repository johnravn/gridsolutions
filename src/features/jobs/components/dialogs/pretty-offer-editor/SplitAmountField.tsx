import * as React from 'react'
import { TextField } from '@radix-ui/themes'

type Props = {
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}

export function SplitAmountField({ value, disabled, onChange }: Props) {
  const [draft, setDraft] = React.useState<string | null>(null)

  const displayValue =
    draft ?? (value === 0 ? '' : String(Math.round(value * 100) / 100))

  return (
    <TextField.Root
      size="2"
      type="text"
      inputMode="decimal"
      disabled={disabled}
      placeholder="0"
      value={displayValue}
      onFocus={() => {
        setDraft(value === 0 ? '' : String(value))
      }}
      onBlur={() => {
        if (draft === null) return
        const parsed =
          draft.trim() === '' ? 0 : Number.parseFloat(draft.replace(',', '.'))
        onChange(Number.isFinite(parsed) ? parsed : 0)
        setDraft(null)
      }}
      onChange={(event) => {
        const next = event.target.value
        if (next === '' || /^\d*[,.]?\d*$/.test(next)) {
          setDraft(next)
        }
      }}
    />
  )
}
