import * as React from 'react'
import { Flex } from '@radix-ui/themes'

export type Segment = {
  id: string
  label: string
}

type Props = {
  segments: Array<Segment>
  activeId: string
  onChange: (id: string) => void
}

export function SegmentedControl({ segments, activeId, onChange }: Props) {
  return (
    <Flex
      gap="1"
      style={{
        background: 'var(--gray-3)',
        padding: 4,
        borderRadius: 6,
        display: 'inline-flex',
      }}
    >
      {segments.map((segment) => {
        const active = segment.id === activeId
        return (
          <button
            key={segment.id}
            type="button"
            onClick={() => onChange(segment.id)}
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              border: 'none',
              background: active ? 'var(--gray-9)' : 'transparent',
              color: active ? 'white' : 'var(--gray-11)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-2)',
              fontWeight: active ? 500 : 400,
              transition: 'all 0.15s',
            }}
          >
            {segment.label}
          </button>
        )
      })}
    </Flex>
  )
}
