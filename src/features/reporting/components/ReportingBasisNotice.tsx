import { Text } from '@radix-ui/themes'

/** Short honesty disclosure for Reporting money figures. */
export function ReportingBasisNotice() {
  return (
    <Text size="1" color="gray">
      All amounts ex MVA. Based on confirmed Money items only — jobs without
      fill-in may understate profit.
    </Text>
  )
}
