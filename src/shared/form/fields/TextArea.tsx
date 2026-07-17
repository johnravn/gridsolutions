import { useId } from 'react'
import { Flex, TextArea as RadixTextArea, Text } from '@radix-ui/themes'
import { useFieldContext } from '../formContext'
import { formatFieldErrors } from '../formatFieldErrors'
import type { CSSProperties } from 'react'

type TextAreaProps = {
  label?: string
  placeholder?: string
  disabled?: boolean
  rows?: number
  style?: CSSProperties
}

export function TextArea({
  label,
  placeholder,
  disabled,
  rows,
  style,
}: TextAreaProps) {
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
      <RadixTextArea
        id={inputId}
        value={field.state.value}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
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
