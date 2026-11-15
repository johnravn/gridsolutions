import * as React from 'react'

/**
 * Dialog open contract: run `onOpen` when `open` becomes true, and again when
 * any `resetKeys` change while open (e.g. editing a different record).
 *
 * Centralizes the usual `eslint-disable` for form.reset() effects so callers
 * do not silence exhaustive-deps at every dialog.
 */
export function useDialogOpenEffect(
  open: boolean,
  onOpen: () => void,
  resetKeys: ReadonlyArray<unknown> = [],
): void {
  React.useEffect(() => {
    if (!open) return
    onOpen()
    // onOpen intentionally omitted — typically closes over form.reset / defaults
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dialog open contract
  }, [open, ...resetKeys])
}
