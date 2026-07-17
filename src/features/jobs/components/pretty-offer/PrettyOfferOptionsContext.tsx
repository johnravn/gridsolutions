import * as React from 'react'
import {
  applyOptionsToOfferTotals,
  calculateOptionsSubtotal,
  collectOfferOptions,
  getSelectedOptionEntries,
  resolveDefaultSelectedOptionIds,
  validateOptionSelection,
} from '../../utils/prettyOfferOptions'
import type { OfferTotalsWithOptions } from '../../utils/prettyOfferOptions'
import type { AcceptedOptionSelection, PrettyOfferModule } from '../../types'

type PrettyOfferOptionsContextValue = {
  allOptions: ReturnType<typeof collectOfferOptions>
  selectedOptionIds: Set<string>
  optionsSubtotal: number
  selectedOptions: ReturnType<typeof getSelectedOptionEntries>
  isFrozen: boolean
  toggleOption: (optionId: string) => void
  selectRadioOption: (groupKey: string, optionId: string) => void
  isOptionSelected: (optionId: string) => boolean
  getAdjustedTotals: (
    baseSubtotal: number,
    vatPercent: number,
    discountPercent: number,
  ) => OfferTotalsWithOptions
}

const PrettyOfferOptionsContext =
  React.createContext<PrettyOfferOptionsContextValue | null>(null)

type ProviderProps = {
  modules: Array<Pick<PrettyOfferModule, 'id' | 'content_blocks' | 'blocks'>>
  acceptedSelections?: Array<AcceptedOptionSelection> | null
  children: React.ReactNode
}

export function PrettyOfferOptionsProvider({
  modules,
  acceptedSelections,
  children,
}: ProviderProps) {
  const allOptions = React.useMemo(
    () => collectOfferOptions(modules),
    [modules],
  )

  const isFrozen = (acceptedSelections?.length ?? 0) > 0

  const [selectedOptionIds, setSelectedOptionIds] = React.useState<Set<string>>(
    () => {
      if (acceptedSelections?.length) {
        return new Set(acceptedSelections.map((entry) => entry.option_id))
      }
      return resolveDefaultSelectedOptionIds(allOptions)
    },
  )

  React.useEffect(() => {
    if (acceptedSelections?.length) {
      setSelectedOptionIds(
        new Set(acceptedSelections.map((entry) => entry.option_id)),
      )
      return
    }
    setSelectedOptionIds(resolveDefaultSelectedOptionIds(allOptions))
  }, [acceptedSelections, allOptions])

  const validatedSelectedIds = React.useMemo(
    () => validateOptionSelection(selectedOptionIds, allOptions),
    [selectedOptionIds, allOptions],
  )

  const optionsSubtotal = React.useMemo(
    () => calculateOptionsSubtotal(validatedSelectedIds, allOptions),
    [validatedSelectedIds, allOptions],
  )

  const selectedOptions = React.useMemo(
    () => getSelectedOptionEntries(validatedSelectedIds, allOptions),
    [validatedSelectedIds, allOptions],
  )

  const toggleOption = React.useCallback(
    (optionId: string) => {
      if (isFrozen) return
      const option = allOptions.find((entry) => entry.optionId === optionId)
      if (!option) return

      setSelectedOptionIds((current) => {
        const next = new Set(current)
        if (option.selectionMode === 'single') {
          for (const sibling of allOptions) {
            if (
              sibling.blockId === option.blockId &&
              sibling.groupId === option.groupId
            ) {
              next.delete(sibling.optionId)
            }
          }
          next.add(optionId)
          return validateOptionSelection(next, allOptions)
        }

        if (next.has(optionId)) {
          next.delete(optionId)
        } else {
          next.add(optionId)
        }
        return validateOptionSelection(next, allOptions)
      })
    },
    [allOptions, isFrozen],
  )

  const selectRadioOption = React.useCallback(
    (groupKey: string, optionId: string) => {
      if (isFrozen) return
      setSelectedOptionIds((current) => {
        const next = new Set(current)
        for (const option of allOptions) {
          const key = `${option.blockId}:${option.groupId}`
          if (key === groupKey) {
            next.delete(option.optionId)
          }
        }
        next.add(optionId)
        return validateOptionSelection(next, allOptions)
      })
    },
    [allOptions, isFrozen],
  )

  const isOptionSelected = React.useCallback(
    (optionId: string) => validatedSelectedIds.has(optionId),
    [validatedSelectedIds],
  )

  const getAdjustedTotals = React.useCallback(
    (baseSubtotal: number, vatPercent: number, discountPercent: number) =>
      applyOptionsToOfferTotals(
        baseSubtotal,
        optionsSubtotal,
        vatPercent,
        discountPercent,
      ),
    [optionsSubtotal],
  )

  const value = React.useMemo(
    (): PrettyOfferOptionsContextValue => ({
      allOptions,
      selectedOptionIds: validatedSelectedIds,
      optionsSubtotal,
      selectedOptions,
      isFrozen,
      toggleOption,
      selectRadioOption,
      isOptionSelected,
      getAdjustedTotals,
    }),
    [
      allOptions,
      validatedSelectedIds,
      optionsSubtotal,
      selectedOptions,
      isFrozen,
      toggleOption,
      selectRadioOption,
      isOptionSelected,
      getAdjustedTotals,
    ],
  )

  return (
    <PrettyOfferOptionsContext.Provider value={value}>
      {children}
    </PrettyOfferOptionsContext.Provider>
  )
}

export function usePrettyOfferOptions() {
  return React.useContext(PrettyOfferOptionsContext)
}
