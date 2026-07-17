import * as React from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  hasOpenDialog,
  isEditableTarget,
} from '@shared/lib/keyboardShortcuts'
import { getAdjacentSelectionIndex } from './getAdjacentSelectionIndex'

/**
 * When a list row is selected, ArrowUp/ArrowDown move selection instead of
 * scrolling the overflow container.
 */
export function useIndexTableSelectionKeyboard({
  enabled = true,
  selectedId,
  getIds,
  isIndexSelectable,
  onSelect,
  scrollToIndex,
}: {
  enabled?: boolean
  selectedId: string | null | undefined
  getIds: () => ReadonlyArray<string>
  isIndexSelectable?: (index: number) => boolean
  onSelect: (id: string) => void
  scrollToIndex?: (index: number) => void
}) {
  const selectedIdRef = React.useRef(selectedId)
  selectedIdRef.current = selectedId

  const getIdsRef = React.useRef(getIds)
  getIdsRef.current = getIds

  const isIndexSelectableRef = React.useRef(isIndexSelectable)
  isIndexSelectableRef.current = isIndexSelectable

  const onSelectRef = React.useRef(onSelect)
  onSelectRef.current = onSelect

  const scrollToIndexRef = React.useRef(scrollToIndex)
  scrollToIndexRef.current = scrollToIndex

  const move = React.useCallback((delta: 1 | -1, event: KeyboardEvent) => {
    if (hasOpenDialog()) return
    if (isEditableTarget(event.target)) return

    const ids = getIdsRef.current()
    const nextIndex = getAdjacentSelectionIndex({
      ids,
      selectedId: selectedIdRef.current,
      delta,
      isIndexSelectable: isIndexSelectableRef.current,
    })

    // Stop the scroll container from moving even at the list boundary.
    event.preventDefault()
    if (nextIndex == null) return

    const nextId = ids[nextIndex]
    if (!nextId) return
    onSelectRef.current(nextId)
    scrollToIndexRef.current?.(nextIndex)
  }, [])

  const canNav = enabled && selectedId != null && selectedId !== ''

  useHotkey('ArrowDown', (event) => move(1, event), {
    enabled: canNav,
    preventDefault: false,
    ignoreInputs: true,
  })

  useHotkey('ArrowUp', (event) => move(-1, event), {
    enabled: canNav,
    preventDefault: false,
    ignoreInputs: true,
  })
}
