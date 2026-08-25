// CopyIconButton.tsx
import { IconButton } from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { CheckCircle, Copy } from 'iconoir-react'
import * as React from 'react'

type CopyIconButtonProps = {
  /** The text to copy to the clipboard */
  text: string
  /** Announced to screen readers when copied */
  copiedLabel?: string
  /** Tooltip/title when idle */
  copyLabel?: string
  /** How long to show the "copied" state (ms) */
  timeoutMs?: number
  /** Optional className for styling */
  className?: string
  /** Called after a successful copy */
  onCopy?: (value: string) => void
}

export const CopyIconButton: React.FC<CopyIconButtonProps> = ({
  text,
  copiedLabel = 'Copied!',
  copyLabel = 'Copy',
  timeoutMs = 1200,
  className: _className,
  onCopy,
}) => {
  void _className
  void copyLabel
  void copiedLabel
  const [copied, setCopied] = React.useState(false)
  const timerRef = React.useRef<number | null>(null)
  const { success } = useToast()

  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }

      setCopied(true)
      success('Copied to clipboard')
      onCopy?.(text)

      timerRef.current = window.setTimeout(() => {
        setCopied(false)
      }, timeoutMs)
    } catch (err) {
      // Optionally handle errors here (toast/log)
      console.error('Copy failed', err)
    }
  }

  return (
    <IconButton onClick={copyToClipboard} variant="ghost">
      {copied ? (
        <CheckCircle fontSize={'0.8rem'} />
      ) : (
        <Copy fontSize={'0.8rem'} />
      )}
    </IconButton>
  )
}
