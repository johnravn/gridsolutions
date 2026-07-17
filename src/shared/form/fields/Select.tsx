import { Flex, Select as RadixSelect, Text } from '@radix-ui/themes'
import { useFieldContext } from '../formContext'
import { formatFieldErrors } from '../formatFieldErrors'

type SelectOption = { value: string; label: string }

type SelectProps = {
  label?: string
  placeholder?: string
  disabled?: boolean
  options: Array<SelectOption>
}

export function Select({ label, placeholder, disabled, options }: SelectProps) {
  const field = useFieldContext<string>()
  const showError = field.state.meta.errors.length > 0

  return (
    <Flex direction="column" gap="1">
      {label ? (
        <Text as="label" size="2" weight="medium">
          {label}
        </Text>
      ) : null}
      <RadixSelect.Root
        value={field.state.value || undefined}
        disabled={disabled}
        onValueChange={field.handleChange}
        onOpenChange={(open) => {
          if (!open) field.handleBlur()
        }}
      >
        <RadixSelect.Trigger
          placeholder={placeholder}
          color={showError ? 'red' : undefined}
        />
        <RadixSelect.Content>
          {options.map((opt) => (
            <RadixSelect.Item key={opt.value} value={opt.value}>
              {opt.label}
            </RadixSelect.Item>
          ))}
        </RadixSelect.Content>
      </RadixSelect.Root>
      {showError ? (
        <Text size="1" color="red">
          {formatFieldErrors(field.state.meta.errors)}
        </Text>
      ) : null}
    </Flex>
  )
}
