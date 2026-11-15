import { Flex, Text, TextField } from '@radix-ui/themes'

/** Shared Offer discount (%) control for Add/Edit customer dialogs. */
export function CustomerDiscountPercentField({
  value,
  onBlur,
  onChange,
}: {
  value: string
  onBlur: () => void
  onChange: (value: string) => void
}) {
  return (
    <Flex direction="column" gap="1">
      <Text as="label" size="2" weight="medium">
        Offer discount (%)
      </Text>
      <TextField.Root
        type="number"
        min="0"
        max="100"
        step="0.01"
        placeholder="Company default"
        value={value}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
      />
      <Text size="1" color="gray">
        Leave empty to use the company customer or partner default.
      </Text>
    </Flex>
  )
}
