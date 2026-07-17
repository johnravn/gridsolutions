import { useId } from 'react'
import { Flex, TextField as RadixTextField, Text } from '@radix-ui/themes'
import { useFieldContext } from '../formContext'
import { formatFieldErrors } from '../formatFieldErrors'
import type { CSSProperties } from 'react'

type TextFieldProps = {
  label?: string
  placeholder?: string
  type?:
    | 'number'
    | 'text'
    | 'search'
    | 'email'
    | 'url'
    | 'date'
    | 'time'
    | 'hidden'
    | 'tel'
    | 'month'
    | 'datetime-local'
    | 'password'
    | 'week'
  disabled?: boolean
  autoComplete?: string
  style?: CSSProperties
}

export function TextField({
  label,
  placeholder,
  type = 'text',
  disabled,
  autoComplete,
  style,
}: TextFieldProps) {
  const field = useFieldContext<string>()
  const inputId = useId()
  const showError = field.state.meta.errors.length > 0

  return (
    <Flex direction="column" gap="1" style={style}>
      {label ? (
        <Text as="label" size="2" weight="medium" htmlFor={inputId}>
          {label}
        </Text>
      ) : null}
      <RadixTextField.Root
        id={inputId}
        type={type}
        value={field.state.value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        color={showError ? 'red' : undefined}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {showError ? (
        <Text size="1" color="red">
          {formatFieldErrors(field.state.meta.errors)}
        </Text>
      ) : null}
    </Flex>
  )
}
