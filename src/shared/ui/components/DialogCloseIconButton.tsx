import { Dialog, IconButton } from '@radix-ui/themes'
import { Xmark } from 'iconoir-react'

/**
 * Header X control for Radix Themes dialogs (closes via Dialog.Close).
 *
 * Ghost IconButtons use negative margins for optical text alignment; those
 * get clipped inside dialogs with overflow:hidden. Keep margin:0 so the
 * hover background stays fully visible.
 */
export function DialogCloseIconButton({
  disabled,
  size = '2',
}: {
  disabled?: boolean
  size?: '1' | '2' | '3' | '4'
}) {
  return (
    <Dialog.Close>
      <IconButton
        size={size}
        variant="ghost"
        color="gray"
        aria-label="Close"
        disabled={disabled}
        style={{ margin: 0, flexShrink: 0 }}
      >
        <Xmark width={18} height={18} />
      </IconButton>
    </Dialog.Close>
  )
}
