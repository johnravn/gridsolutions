import * as React from 'react'
import { Box, Button, Flex, Text } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  motionEaseRevealIn,
  motionEaseRevealOut,
  motionFadeTransition,
  motionOffsetRevealY,
  motionRevealTransition,
} from '@shared/lib/motion'

const LARGE_SCREEN_QUERY = '(min-width: 769px)'

export type AnimatedQuickSuggestionsProps = {
  suggestions: ReadonlyArray<string>
  /** When true, the animated panel is expanded (typically while the field is focused). */
  open: boolean
  onSelect: (suggestion: string) => void
  /** Called after a suggestion is selected (e.g. clear focus state). */
  onAfterSelect?: () => void
  showLabel?: boolean
  label?: string
  /** On small screens: show a static chip row when true. */
  staticOpen?: boolean
  /** Override media-query; defaults to large screens only. */
  animate?: boolean
  gap?: '1' | '2'
  stopPropagation?: boolean
}

export function AnimatedQuickSuggestions(props: AnimatedQuickSuggestionsProps) {
  if (props.animate !== undefined) {
    return <AnimatedQuickSuggestionsView {...props} animate={props.animate} />
  }
  return <AnimatedQuickSuggestionsResponsive {...props} />
}

function AnimatedQuickSuggestionsResponsive(
  props: Omit<AnimatedQuickSuggestionsProps, 'animate'>,
) {
  const isLargeScreen = useMediaQuery(LARGE_SCREEN_QUERY)
  return <AnimatedQuickSuggestionsView {...props} animate={isLargeScreen} />
}

function AnimatedQuickSuggestionsView({
  suggestions,
  open,
  onSelect,
  onAfterSelect,
  showLabel = false,
  label = 'Quick suggestions:',
  staticOpen = false,
  animate,
  gap = '1',
  stopPropagation = false,
}: AnimatedQuickSuggestionsProps & { animate: boolean }) {
  const handleSelect = (suggestion: string) => {
    onSelect(suggestion)
    onAfterSelect?.()
  }

  const renderButton = (
    suggestion: string,
    index: number,
    useAnimation: boolean,
    visible: boolean,
  ) => (
    <Button
      key={suggestion}
      size="1"
      variant="soft"
      color="gray"
      style={
        useAnimation
          ? {
              opacity: visible ? 1 : 0,
              transition: visible
                ? motionRevealTransition(['opacity'], {
                    ease: motionEaseRevealOut,
                    delay: `${80 + index * 40}ms`,
                  })
                : motionFadeTransition(motionEaseRevealIn),
            }
          : undefined
      }
      onMouseDown={useAnimation ? (e) => e.preventDefault() : undefined}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
        handleSelect(suggestion)
      }}
    >
      {suggestion}
    </Button>
  )

  if (!animate) {
    if (!staticOpen) return null
    return (
      <Flex gap={gap} wrap="wrap" mt="2">
        {showLabel && (
          <Text size="1" color="gray" style={{ width: '100%' }}>
            {label}
          </Text>
        )}
        {suggestions.map((suggestion, index) =>
          renderButton(suggestion, index, false, true),
        )}
      </Flex>
    )
  }

  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: motionRevealTransition(['grid-template-rows'], {
          ease: motionEaseRevealOut,
        }),
      }}
    >
      <Box style={{ overflow: 'hidden', minHeight: 0 }}>
        <Flex
          gap={gap}
          wrap="wrap"
          pt="1"
          style={{
            opacity: open ? 1 : 0,
            transform: open
              ? 'translateY(0)'
              : `translateY(${motionOffsetRevealY})`,
            transition: open
              ? motionRevealTransition(['opacity', 'transform'], {
                  ease: motionEaseRevealOut,
                  delay: '60ms',
                })
              : motionRevealTransition(['opacity', 'transform'], {
                  ease: motionEaseRevealIn,
                }),
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          {showLabel && (
            <Text size="1" color="gray" style={{ width: '100%' }}>
              {label}
            </Text>
          )}
          {suggestions.map((suggestion, index) =>
            renderButton(suggestion, index, true, open),
          )}
        </Flex>
      </Box>
    </Box>
  )
}
