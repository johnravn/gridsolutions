import * as React from 'react'
import { TextField } from '@radix-ui/themes'
import { getPostalCodeInfo } from 'norwegian-postalcodes-mapper'

type NorwayZipCodeFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoCompleteCity?: (city: string) => void
}

/**
 * A specialized zip code input field for Norwegian postal codes.
 * Automatically looks up and autocompletes the city when a valid postal code is entered.
 */
export function NorwayZipCodeField({
  value,
  onChange,
  placeholder = 'e.g., 0361',
  autoCompleteCity,
}: NorwayZipCodeFieldProps) {
  // Store the callback in a ref to avoid recreating the effect
  const autoCompleteCityRef = React.useRef(autoCompleteCity)
  const lastProcessedZipRef = React.useRef<string>('')

  React.useEffect(() => {
    autoCompleteCityRef.current = autoCompleteCity
  }, [autoCompleteCity])

  // Debounce to avoid too many lookups while typing
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
      // Reset the last processed zip when value changes
      lastProcessedZipRef.current = ''
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [value])

  // Look up city when debounced value changes and is a valid 4-digit postal code
  React.useEffect(() => {
    if (
      !debouncedValue ||
      debouncedValue.length !== 4 ||
      debouncedValue === lastProcessedZipRef.current
    ) {
      return
    }

    lastProcessedZipRef.current = debouncedValue
    const info = getPostalCodeInfo(debouncedValue)
    if (info && autoCompleteCityRef.current) {
      autoCompleteCityRef.current(info.city)
    }
  }, [debouncedValue])

  return (
    <TextField.Root
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={4} // Norwegian postal codes are always 4 digits
    />
  )
}
