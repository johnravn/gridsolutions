import * as React from 'react'
import { Text } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  motionDurationReveal,
  motionEaseReveal,
  motionFadeTransition,
  motionRevealTransition,
} from '@shared/lib/motion'
import type { PrettyOfferModuleBlockItem } from '../../types'

type Props = {
  items: Array<PrettyOfferModuleBlockItem>
}

export function InteractiveListBlock({ items }: Props) {
  const canHover = useMediaQuery('(hover: hover)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)

  const toggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
      {sorted.map((item) => {
        const showDetail = canHover
          ? hoveredId === item.id
          : expandedId === item.id
        const hasDetail = Boolean(item.detail)

        return (
          <li
            key={item.id}
            style={{
              marginBottom: 8,
              padding: 12,
              border: '1px solid var(--gray-a5)',
              borderRadius: 8,
              cursor: hasDetail ? 'pointer' : 'default',
              transition: prefersReducedMotion
                ? undefined
                : `border-color ${motionDurationReveal} ${motionEaseReveal}, background-color ${motionDurationReveal} ${motionEaseReveal}`,
              background: showDetail ? 'var(--accent-a2)' : 'transparent',
              borderColor: showDetail ? 'var(--accent-a5)' : 'var(--gray-a5)',
            }}
            onMouseEnter={() => {
              if (canHover && hasDetail) setHoveredId(item.id)
            }}
            onMouseLeave={() => {
              if (canHover) setHoveredId(null)
            }}
            onClick={() => {
              if (!canHover && hasDetail) toggleExpanded(item.id)
            }}
          >
            <Text size="3" weight="medium" as="div">
              {item.label}
            </Text>
            {hasDetail && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: showDetail ? '1fr' : '0fr',
                  transition: prefersReducedMotion
                    ? undefined
                    : motionRevealTransition(['grid-template-rows']),
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <Text
                    size="2"
                    color="gray"
                    mt="2"
                    style={{
                      whiteSpace: 'pre-wrap',
                      opacity: showDetail ? 1 : 0,
                      transition: prefersReducedMotion
                        ? undefined
                        : motionFadeTransition(),
                    }}
                    as="div"
                  >
                    {item.detail}
                  </Text>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
