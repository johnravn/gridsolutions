import * as React from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { parsePastedPhoneNumber } from './phone'
import type { CountryCode } from 'libphonenumber-js/core'
import 'react-phone-number-input/style.css'
import './phone-input-radix-shim.css'

type Props = {
  value: string | undefined
  onChange: (e164: string | undefined) => void
  defaultCountry?: CountryCode
  placeholder?: string
  disabled?: boolean
  id?: string
}

export function PhoneInputField({
  value,
  onChange,
  defaultCountry = 'NO' as CountryCode,
  placeholder = 'Enter phone number',
  disabled,
  id,
}: Props) {
  const [touched, setTouched] = React.useState(false)
  const [country, setCountry] = React.useState<CountryCode | undefined>(
    defaultCountry,
  )
  const invalid = !!(touched && value && !isValidPhoneNumber(value))

  React.useEffect(() => {
    if (!value) return
    const parsed = parsePhoneNumberFromString(value)
    if (parsed?.country) {
      setCountry(parsed.country)
    }
  }, [value])

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const pasted = e.clipboardData.getData('text')
      const parsed = parsePastedPhoneNumber(pasted, defaultCountry)
      if (!parsed) return

      e.preventDefault()
      e.stopPropagation()
      setCountry(parsed.country)
      onChange(parsed.e164)
    },
    [defaultCountry, onChange],
  )

  // ⬇️ Create this ONCE so the input isn't remounted on invalid/disabled changes
  const RadixTextFieldShim = React.useMemo(
    () =>
      React.forwardRef<
        HTMLInputElement,
        React.InputHTMLAttributes<HTMLInputElement>
      >((props, ref) => {
        const {
          style,
          onBlur,
          className,
          disabled: inputDisabled,
          ...rest
        } = props
        return (
          <div
            className={[
              'rt-TextFieldRoot',
              'rt-variant-surface',
              'rt-r-size-2',
              className || '',
            ].join(' ')}
            data-disabled={inputDisabled ? 'true' : 'false'}
            style={{ width: '100%', ...(style || {}) }}
          >
            <input
              ref={ref}
              {...rest}
              className="rt-TextFieldInput"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              onBlur={(e) => {
                setTouched(true)
                onBlur?.(e)
              }}
            />
          </div>
        )
      }),
    [], // ✅ stable identity
  )
  ;(RadixTextFieldShim as any).displayName = 'RadixTextFieldShim'

  return (
    // Drive invalid styling from this wrapper (so the shim can stay stable)
    <div
      className="radix-phone"
      data-invalid={invalid ? 'true' : 'false'}
      style={{ minWidth: 220 }}
      onPasteCapture={handlePaste}
    >
      <PhoneInput
        id={id}
        international
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry}
        country={country}
        onCountryChange={setCountry}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        inputComponent={RadixTextFieldShim as any}
      />
      {invalid && (
        <div className="radix-phone-error">
          Please enter a valid phone number.
        </div>
      )}
    </div>
  )
}
