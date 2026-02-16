// src/shared/ui/components/SearchableSelect.tsx
import * as React from 'react'
import { Box, Text, TextField } from '@radix-ui/themes'
import { fuzzySearch } from '@shared/lib/generalFunctions'

export type SearchableSelectOption = {
  value: string
  label: string
}

type Props = {
  options: SearchableSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  emptyMessage?: string
  'data-testid'?: string
}

function useDropdownPosition(
  inputRef: React.RefObject<HTMLInputElement | null>,
  open: boolean,
) {
  const [position, setPosition] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

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

    const scrollOrResize = () => update()
    window.addEventListener('scroll', scrollOrResize, true)
    window.addEventListener('resize', scrollOrResize)
    return () => {
      window.removeEventListener('scroll', scrollOrResize, true)
      window.removeEventListener('resize', scrollOrResize)
    }
  }, [open, inputRef])

  return position
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  disabled,
  emptyMessage = 'No results',
  'data-testid': dataTestId,
}: Props) {
  const [inputValue, setInputValue] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const selectingRef = React.useRef(false)
  const dropdownPosition = useDropdownPosition(inputRef, open)

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  )

  const displayValue = selectedOption?.label ?? inputValue

  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return options
    return fuzzySearch(
      options,
      inputValue.trim(),
      [(o) => o.label],
      0.25,
    )
  }, [options, inputValue])

  React.useEffect(() => {
    if (value && selectedOption) {
      setInputValue(selectedOption.label)
    } else if (!open) {
      setInputValue('')
    }
  }, [value, selectedOption?.label, open])

  const handleFocus = () => {
    setOpen(true)
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
      setOpen(false)
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
    setOpen(true)
    if (value) onValueChange('')
  }

  const handleSelect = (option: SearchableSelectOption) => {
    selectingRef.current = true
    onValueChange(option.value)
    setInputValue(option.label)
    setOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <Box style={{ position: 'relative', width: '100%' }}>
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
      />
      {open && dropdownPosition && (
        <Box
          ref={listRef}
          data-searchable-select-dropdown
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 10000,
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filteredOptions.length === 0 ? (
            <Box px="3" py="2">
              <Text size="2" color="gray">
                {emptyMessage}
              </Text>
            </Box>
          ) : (
            filteredOptions.map((option) => (
              <Box
                key={option.value}
                data-searchable-select-option
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelect(option)
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelect(option)
                }}
                style={{
                  padding: '8px 12px',
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
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  )
}
