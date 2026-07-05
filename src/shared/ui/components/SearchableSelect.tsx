// src/shared/ui/components/SearchableSelect.tsx
import * as React from 'react'
import { createPortal } from 'react-dom'
import { Box, Spinner, Text, TextField, Theme } from '@radix-ui/themes'
import { fuzzySearch } from '@shared/lib/generalFunctions'

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
}

type DropdownPosition = {
  top: number
  left: number
  width: number
}

type Props = {
  options: Array<SearchableSelectOption>
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  emptyMessage?: string
  'data-testid'?: string
  /** Restrict dropdown width; defaults to matching input. Use e.g. 260 for natural width. */
  dropdownMaxWidth?: number
  dropdownMaxHeight?: number
  style?: React.CSSProperties
  /** When false, options are shown as-is (e.g. server pre-filtered). Default true. */
  filterLocally?: boolean
  onInputChange?: (value: string) => void
  onOpenChange?: (open: boolean) => void
  loading?: boolean
}

export const SEARCHABLE_SELECT_DROPDOWN_SELECTOR =
  '[data-searchable-select-dropdown]'

/** Use on Dialog.Content onPointerDownOutside / onInteractOutside. */
export function preventDialogCloseOnSearchableSelect(e: {
  preventDefault: () => void
  target: EventTarget | null
  detail?: { originalEvent?: Event }
}) {
  const el = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null
  if (el?.closest(SEARCHABLE_SELECT_DROPDOWN_SELECTOR)) {
    e.preventDefault()
  }
}

function useFixedDropdownPosition(
  inputRef: React.RefObject<HTMLInputElement | null>,
  open: boolean,
) {
  const [position, setPosition] = React.useState<DropdownPosition | null>(null)

  React.useLayoutEffect(() => {
    if (!open || !inputRef.current) {
      setPosition(null)
      return
    }

    const update = () => {
      const el = inputRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }

    update()
    const raf = requestAnimationFrame(update)

    const onLayoutChange = () => update()
    window.addEventListener('scroll', onLayoutChange, true)
    window.addEventListener('resize', onLayoutChange)
    const vv = window.visualViewport
    vv?.addEventListener('resize', onLayoutChange)
    vv?.addEventListener('scroll', onLayoutChange)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onLayoutChange, true)
      window.removeEventListener('resize', onLayoutChange)
      vv?.removeEventListener('resize', onLayoutChange)
      vv?.removeEventListener('scroll', onLayoutChange)
    }
  }, [open, inputRef])

  return position
}

function portalAppearance(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function setOpenState(
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  onOpenChange?: (open: boolean) => void,
) {
  setOpen(open)
  onOpenChange?.(open)
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  disabled,
  emptyMessage = 'No results',
  'data-testid': dataTestId,
  dropdownMaxWidth = 320,
  dropdownMaxHeight = 160,
  style,
  filterLocally = true,
  onInputChange,
  onOpenChange,
  loading,
}: Props) {
  const [inputValue, setInputValue] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState<number | null>(
    null,
  )
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const selectingRef = React.useRef(false)

  const fixedPosition = useFixedDropdownPosition(inputRef, open)

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  )

  const displayValue = open ? inputValue : (selectedOption?.label ?? inputValue)

  const filteredOptions = React.useMemo(() => {
    if (!filterLocally || !inputValue.trim()) return options
    return fuzzySearch(
      options,
      inputValue.trim(),
      [(o) => o.label, (o) => o.description ?? ''],
      0.25,
    )
  }, [options, inputValue, filterLocally])

  React.useEffect(() => {
    if (value && selectedOption) {
      setInputValue(selectedOption.label)
    } else if (!open) {
      setInputValue('')
    }
  }, [value, selectedOption?.label, open])

  React.useEffect(() => {
    setHighlightedIndex(null)
  }, [filteredOptions])

  React.useEffect(() => {
    if (!open) {
      setHighlightedIndex(null)
    }
  }, [open])

  React.useEffect(() => {
    if (highlightedIndex === null || !listRef.current) return
    const optionEl = listRef.current.querySelector(
      `[data-searchable-select-option-index="${highlightedIndex}"]`,
    )
    if (typeof optionEl?.scrollIntoView === 'function') {
      optionEl.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  const handleFocus = () => {
    setOpenState(true, setOpen, onOpenChange)
    if (value && selectedOption) {
      setInputValue(selectedOption.label)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (selectingRef.current) {
        selectingRef.current = false
        return
      }
      setOpenState(false, setOpen, onOpenChange)
      if (value && selectedOption) {
        setInputValue(selectedOption.label)
      } else {
        setInputValue('')
      }
    }, 200)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInputValue(v)
    setOpenState(true, setOpen, onOpenChange)
    onInputChange?.(v)
  }

  const handleSelect = (option: SearchableSelectOption) => {
    selectingRef.current = true
    onValueChange(option.value)
    setInputValue(option.label)
    setOpenState(false, setOpen, onOpenChange)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpenState(false, setOpen, onOpenChange)
      inputRef.current?.blur()
      return
    }

    if (loading || filteredOptions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpenState(true, setOpen, onOpenChange)
      setHighlightedIndex((prev) => {
        if (prev === null) return 0
        return Math.min(prev + 1, filteredOptions.length - 1)
      })
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpenState(true, setOpen, onOpenChange)
      setHighlightedIndex((prev) => {
        if (prev === null) return filteredOptions.length - 1
        return Math.max(prev - 1, 0)
      })
      return
    }

    if (e.key === 'Enter' && highlightedIndex !== null) {
      e.preventDefault()
      handleSelect(filteredOptions[highlightedIndex])
    }
  }

  const dropdownEl =
    open && fixedPosition ? (
      <Theme appearance={portalAppearance()} hasBackground={false}>
        <Box
          ref={listRef}
          data-searchable-select-dropdown
          onPointerDownCapture={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            top: fixedPosition.top,
            left: fixedPosition.left,
            width: Math.min(fixedPosition.width, dropdownMaxWidth),
            zIndex: 2147483647,
            pointerEvents: 'auto',
            backgroundColor: 'var(--color-panel-solid)',
            border: '1px solid var(--gray-a6)',
            borderRadius: 'var(--radius-3)',
            boxShadow: 'var(--shadow-4)',
            maxHeight: dropdownMaxHeight,
            overflowY: 'auto',
            fontFamily: 'inherit',
          }}
        >
          {loading ? (
            <Box px="2" py="1">
              <Text size="2" color="gray">
                Searching…
              </Text>
            </Box>
          ) : filteredOptions.length === 0 ? (
            <Box px="2" py="1">
              <Text size="2" color="gray">
                {emptyMessage}
              </Text>
            </Box>
          ) : (
            filteredOptions.map((option, index) => (
              <Box
                key={option.value || '__empty__'}
                data-searchable-select-option
                data-searchable-select-option-index={index}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  selectingRef.current = true
                  handleSelect(option)
                }}
                px="2"
                py="1"
                style={{
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-2)',
                  backgroundColor:
                    index === highlightedIndex
                      ? 'var(--gray-a3)'
                      : 'transparent',
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <Text as="div" size="2" truncate>
                  {option.label}
                </Text>
                {option.description && (
                  <Text as="div" size="1" color="gray" truncate>
                    {option.description}
                  </Text>
                )}
              </Box>
            ))
          )}
        </Box>
      </Theme>
    ) : null

  return (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: style?.maxWidth ?? 320,
        ...style,
      }}
    >
      <TextField.Root
        ref={inputRef}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={dataTestId}
      >
        {loading && (
          <TextField.Slot side="right">
            <Spinner size="1" />
          </TextField.Slot>
        )}
      </TextField.Root>
      {dropdownEl && createPortal(dropdownEl, document.body)}
    </Box>
  )
}
