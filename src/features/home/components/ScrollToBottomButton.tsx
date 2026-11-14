import { Button } from '@radix-ui/themes'
import { ArrowDown } from 'iconoir-react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'

export function useScrollButtonStyles() {
  // No-op kept for call-site compatibility; bounce keyframes were removed.
}

export function ScrollToBottomButton({
  onClick,
  visible,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: {
  onClick: () => void
  visible: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const canHoverMotion = useMediaQuery('(hover: hover) and (pointer: fine)')

  if (!visible) return null

  const showHoverScale = !prefersReducedMotion && canHoverMotion && isHovered

  return (
    <Button
      size="1"
      variant="ghost"
      style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isHovered
          ? '0 4px 12px rgba(0, 0, 0, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.15)',
        backgroundColor: isHovered ? 'var(--gray-4)' : 'var(--gray-3)',
        color: 'var(--gray-11)',
        cursor: 'pointer',
        zIndex: 10,
        transition: prefersReducedMotion
          ? 'background-color 150ms var(--motion-ease-out), box-shadow 150ms var(--motion-ease-out)'
          : 'background-color 150ms var(--motion-ease-out), box-shadow 150ms var(--motion-ease-out), transform 160ms var(--motion-ease-out)',
        transform: showHoverScale ? 'scale(1.03)' : 'scale(1)',
      }}
      className={prefersReducedMotion ? undefined : 'scroll-to-bottom-btn'}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      aria-label="Scroll to bottom"
    >
      <ArrowDown width={16} height={16} />
    </Button>
  )
}
