import { Box, Checkbox, Flex, Text } from '@radix-ui/themes'

type Props = {
  useCustomerBrandColors: boolean
  hasCustomerColor: boolean
  customerName?: string | null
  readOnly: boolean
  onChange: (useCustomerBrandColors: boolean) => void
}

export function AppearanceSection({
  useCustomerBrandColors,
  hasCustomerColor,
  customerName,
  readOnly,
  onChange,
}: Props) {
  return (
    <Box
      p="3"
      mb="3"
      style={{
        border: '1px solid var(--gray-a5)',
        borderRadius: 8,
        background: 'var(--gray-a2)',
      }}
    >
      <Text size="2" weight="medium" mb="2" as="div">
        Appearance
      </Text>
      {!hasCustomerColor ? (
        <Text size="2" color="gray">
          {customerName
            ? `${customerName} has no brand color set. Assign one on the customer page.`
            : 'This job has no customer. Assign a customer and brand color to use customer theming.'}
        </Text>
      ) : (
        <Text as="label" size="2">
          <Flex gap="2" align="center">
            <Checkbox
              checked={useCustomerBrandColors}
              disabled={readOnly}
              onCheckedChange={(checked) => onChange(checked === true)}
            />
            Use customer brand colors
          </Flex>
        </Text>
      )}
    </Box>
  )
}
