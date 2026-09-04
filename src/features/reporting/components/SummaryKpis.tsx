import { Card, Flex, Text } from '@radix-ui/themes'

export type KpiItem = {
  label: string
  value: string
  hint?: string
}

export function SummaryKpis({ items }: { items: Array<KpiItem> }) {
  if (items.length === 0) return null
  return (
    <Flex gap="3" wrap="wrap">
      {items.map((item) => (
        <Card
          key={item.label}
          size="2"
          style={{ minWidth: 140, flex: '1 1 140px' }}
        >
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              {item.label}
            </Text>
            <Text size="5" weight="bold">
              {item.value}
            </Text>
            {item.hint ? (
              <Text size="1" color="gray">
                {item.hint}
              </Text>
            ) : null}
          </Flex>
        </Card>
      ))}
    </Flex>
  )
}
