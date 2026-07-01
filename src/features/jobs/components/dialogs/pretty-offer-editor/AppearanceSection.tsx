import { Box, Checkbox, Flex, Text } from '@radix-ui/themes'

type Props = {
  useCustomerAccent: boolean
  useCustomerBackground: boolean
  hasCustomerColor: boolean
  customerName?: string | null
  readOnly: boolean
  onChange: (updates: {
    pretty_use_customer_accent?: boolean
    pretty_use_customer_background?: boolean
  }) => void
}

export function AppearanceSection({
  useCustomerAccent,
  useCustomerBackground,
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
        <Flex direction="column" gap="2">
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={useCustomerAccent}
                disabled={readOnly}
                onCheckedChange={(checked) =>
                  onChange({ pretty_use_customer_accent: checked === true })
                }
              />
              Use customer accent color
            </Flex>
          </Text>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={useCustomerBackground}
                disabled={readOnly}
                onCheckedChange={(checked) =>
                  onChange({
                    pretty_use_customer_background: checked === true,
                  })
                }
              />
              Use customer color for background tints
            </Flex>
          </Text>
        </Flex>
      )}
    </Box>
  )
}
