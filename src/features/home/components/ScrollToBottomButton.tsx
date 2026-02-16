import * as React from 'react'
import { Button } from '@radix-ui/themes'
import { ArrowDown } from 'iconoir-react'

const STYLE_ID = 'scroll-button-animation'

export function useScrollButtonStyles() {
  React.useEffect(() => {
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      @keyframes scrollButtonBounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-4px);
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      const existingStyle = document.getElementById(STYLE_ID)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])
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
  if (!visible) return null

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
        animation: 'scrollButtonBounce 2s ease-in-out infinite',
        transition:
          'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      aria-label="Scroll to bottom"
    >
      <ArrowDown width={16} height={16} />
    </Button>
  )
}
