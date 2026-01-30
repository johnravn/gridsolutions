// src/features/inventory/components/BrandAutocomplete.tsx
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Flex, Text, TextField } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'

type Brand = {
  id: string
  name: string
}

type Props = {
  companyId: string
  value: string | null // brand name (not ID)
  onChange: (brandName: string | null) => void
  onBrandIdChange?: (brandId: string | null) => void
  disabled?: boolean
  placeholder?: string
}

export default function BrandAutocomplete({
  companyId,
  value,
  onChange,
  onBrandIdChange,
  disabled,
  placeholder = 'Type brand name...',
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [inputValue, setInputValue] = React.useState(value || '')
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const suggestionsRef = React.useRef<HTMLDivElement>(null)
  const lastCreatedBrandRef = React.useRef<{ id: string; name: string } | null>(
    null,
  )

  // Update input value when prop changes (e.g., when editing existing item)
  React.useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '')
    }
  }, [value])

  // Fetch brands with fuzzy search using PostgreSQL similarity
  const { data: suggestions = [] } = useQuery({
    queryKey: [
      'company',
      companyId,
      'item_brands',
      'search',
      inputValue.trim(),
    ],
    enabled: !!companyId && inputValue.trim().length > 0,
    queryFn: async (): Promise<Array<Brand>> => {
      const searchTerm = inputValue.trim()

      // Use ILIKE for fuzzy matching (PostgreSQL will use indexes)
      // For better fuzzy search, we can add a PostgreSQL function later
      const { data, error } = await supabase
        .from('item_brands')
        .select('id, name')
        .eq('company_id', companyId)
        .ilike('name', `%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(20)

      if (error) throw error
      return data || []
    },
    staleTime: 1000, // Short cache for search results
  })

  // Filter suggestions client-side for better fuzzy matching
  const filteredSuggestions = React.useMemo(() => {
    if (!inputValue.trim()) return []

    const term = inputValue.trim().toLowerCase()

    // Exact matches first
    const exact = suggestions.filter((b) => b.name.toLowerCase() === term)

    // Starts with
    const startsWith = suggestions.filter(
      (b) =>
        b.name.toLowerCase().startsWith(term) && b.name.toLowerCase() !== term,
    )

    // Contains
    const contains = suggestions.filter(
      (b) =>
        b.name.toLowerCase().includes(term) &&
        !b.name.toLowerCase().startsWith(term),
    )

    // Fuzzy match (typos, similar)
    const fuzzy = suggestions.filter((b) => {
      const name = b.name.toLowerCase()
      if (name === term || name.startsWith(term) || name.includes(term)) {
        return false // Already included
      }

      // Simple fuzzy: check if most characters match in order
      let searchIdx = 0
      for (let i = 0; i < name.length && searchIdx < term.length; i++) {
        if (name[i] === term[searchIdx]) {
          searchIdx++
        }
      }

      // If 70%+ of search chars found in order, consider it a match
      return searchIdx >= Math.ceil(term.length * 0.7)
    })

    return [...exact, ...startsWith, ...contains, ...fuzzy].slice(0, 8)
  }, [suggestions, inputValue])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    onChange(newValue || null)
    onBrandIdChange?.(null) // Clear brand ID when typing
  }

  const handleSelectBrand = (brand: Brand) => {
    setInputValue(brand.name)
    setShowSuggestions(false)
    onChange(brand.name)
    onBrandIdChange?.(brand.id)
    inputRef.current?.blur()
  }

  const handleCreateNew = () => {
    const brandName = inputValue.trim()
    if (!brandName) return

    // Create new brand
    supabase
      .from('item_brands')
      .insert({
        company_id: companyId,
        name: brandName,
      })
      .select('id, name')
      .single()
      .then(({ data, error }) => {
        if (error) {
          // Brand might already exist, try to find it
          supabase
            .from('item_brands')
            .select('id, name')
            .eq('company_id', companyId)
            .ilike('name', brandName)
            .maybeSingle()
            .then(({ data: existing, error: findError }) => {
              if (findError) {
                toastError('Failed to save brand', findError.message)
                return
              }
              if (existing) {
                onBrandIdChange?.(existing.id)
                qc.invalidateQueries({
                  queryKey: ['company', companyId, 'item_brands'],
                  exact: false,
                })
              } else {
                toastError('Failed to save brand', error.message)
              }
            })
          return
        }
        if (data) {
          lastCreatedBrandRef.current = { id: data.id, name: data.name }
          onBrandIdChange?.(data.id)
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'item_brands'],
            exact: false,
          })

          // Show toast with undo
          success(
            'Brand saved',
            `"${brandName}" has been added`,
            5000, // 5 second duration
            () => {
              // Undo: delete the brand
              if (lastCreatedBrandRef.current) {
                supabase
                  .from('item_brands')
                  .delete()
                  .eq('id', lastCreatedBrandRef.current.id)
                  .then(() => {
                    qc.invalidateQueries({
                      queryKey: ['company', companyId, 'item_brands'],
                      exact: false,
                    })
                    // Clear the brand selection
                    onBrandIdChange?.(null)
                    onChange(null)
                    setInputValue('')
                  })
                lastCreatedBrandRef.current = null
              }
            },
            'Undo',
          )
        }
      })

    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  // Handle clicks outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasExactMatch = filteredSuggestions.some(
    (b) => b.name.toLowerCase() === inputValue.trim().toLowerCase(),
  )
  const showCreateOption =
    inputValue.trim().length > 0 && !hasExactMatch && showSuggestions

  return (
    <Box style={{ position: 'relative', width: '100%' }}>
      <TextField.Root
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        disabled={disabled}
        placeholder={placeholder}
      />

      {showSuggestions &&
        (filteredSuggestions.length > 0 || showCreateOption) && (
          <Box
            ref={suggestionsRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 10000,
              marginTop: 4,
              backgroundColor: 'var(--gray-1)',
              border: '1px solid var(--gray-a6)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {filteredSuggestions.map((brand) => (
              <Box
                key={brand.id}
                onClick={() => handleSelectBrand(brand)}
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
                <Text size="2">{brand.name}</Text>
              </Box>
            ))}

            {showCreateOption && (
              <Box
                onClick={handleCreateNew}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderTop: '1px solid var(--gray-a4)',
                  backgroundColor: 'var(--blue-a2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--blue-a3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--blue-a2)'
                }}
              >
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">
                    + Create "{inputValue.trim()}"
                  </Text>
                </Flex>
              </Box>
            )}
          </Box>
        )}
    </Box>
  )
}
