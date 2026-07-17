import { Button } from '@radix-ui/themes'
import { useFormContext } from '../formContext'
import type { ComponentProps } from 'react'

type SubmitButtonProps = {
  label: string
  pendingLabel?: string
  disabled?: boolean
  variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'surface'
  color?: ComponentProps<typeof Button>['color']
}

export function SubmitButton({
  label,
  pendingLabel = 'Saving…',
  disabled,
  variant = 'solid',
  color,
}: SubmitButtonProps) {
  const form = useFormContext()

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button
          type="submit"
          variant={variant}
          color={color}
          disabled={disabled || !canSubmit || isSubmitting}
        >
          {isSubmitting ? pendingLabel : label}
        </Button>
      )}
    </form.Subscribe>
  )
}
