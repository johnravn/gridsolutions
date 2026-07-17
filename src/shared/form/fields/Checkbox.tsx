import { Flex, Checkbox as RadixCheckbox, Text } from '@radix-ui/themes'
import { useFieldContext } from '../formContext'

type CheckboxProps = {
  label: string
  disabled?: boolean
}

export function Checkbox({ label, disabled }: CheckboxProps) {
  const field = useFieldContext<boolean>()

  return (
    <Flex align="center" gap="2">
      <RadixCheckbox
        checked={!!field.state.value}
        disabled={disabled}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
        onBlur={field.handleBlur}
      />
      <Text as="label" size="2">
        {label}
      </Text>
    </Flex>
  )
}
