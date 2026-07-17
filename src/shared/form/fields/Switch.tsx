import { Flex, Switch as RadixSwitch, Text } from '@radix-ui/themes'
import { useFieldContext } from '../formContext'

type SwitchProps = {
  label: string
  disabled?: boolean
}

export function Switch({ label, disabled }: SwitchProps) {
  const field = useFieldContext<boolean>()

  return (
    <Flex align="center" gap="2">
      <RadixSwitch
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
