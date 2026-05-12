import { Flex, Heading, Table, Text } from '@radix-ui/themes'
import type { calculateOfferTotals } from '../../../utils/offerCalculations'

export function TotalsSection({
  totals,
}: {
  totals: ReturnType<typeof calculateOfferTotals>
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Heading size="3">Totals</Heading>
      <Table.Root variant="surface">
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Equipment Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.equipmentSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Crew Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.crewSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Transport Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.transportSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Total Before Discount</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.totalBeforeDiscount)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">
                Equipment discount ({totals.discountPercent}%)
              </Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text color="red">-{formatCurrency(totals.discountAmount)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Total After Discount</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.totalAfterDiscount)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">VAT ({totals.vatPercent}%)</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>
                {formatCurrency(
                  totals.totalWithVAT - totals.totalAfterDiscount,
                )}
              </Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text size="4" weight="bold">
                Total With VAT
              </Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text size="4" weight="bold">
                {formatCurrency(totals.totalWithVAT)}
              </Text>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </Flex>
  )
}
