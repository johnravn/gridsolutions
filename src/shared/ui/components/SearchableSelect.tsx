// src/shared/ui/components/SearchableSelect.tsx
import * as React from 'react'
import { createPortal } from 'react-dom'
import { Box, Spinner, Text, TextField } from '@radix-ui/themes'
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
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const selectingRef = React.useRef(false)

  const fixedPosition = useFixedDropdownPosition(inputRef, open)

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  )

  const displayValue = selectedOption?.label ?? inputValue

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
    if (value) onValueChange('')
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
    }
  }

  const dropdownEl =
    open && fixedPosition ? (
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
          backgroundColor: 'var(--color-background)',
          border: '1px solid var(--gray-a6)',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          maxHeight: dropdownMaxHeight,
          overflowY: 'auto',
        }}
      >
        {loading ? (
          <Box px="3" py="2">
            <Text size="2" color="gray">
              Searching…
            </Text>
          </Box>
        ) : filteredOptions.length === 0 ? (
          <Box px="3" py="2">
            <Text size="2" color="gray">
              {emptyMessage}
            </Text>
          </Box>
        ) : (
          filteredOptions.map((option) => (
            <Box
              key={option.value || '__empty__'}
              data-searchable-select-option
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                selectingRef.current = true
                handleSelect(option)
              }}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--gray-a4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-a3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Text size="2">{option.label}</Text>
              {option.description && (
                <Text
                  size="1"
                  color="gray"
                  style={{ display: 'block', marginTop: 2 }}
                >
                  {option.description}
                </Text>
              )}
            </Box>
          ))
        )}
      </Box>
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
