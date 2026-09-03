import { Badge } from '@radix-ui/themes'

export function BetaBadge({ size = '1' }: { size?: '1' | '2' }) {
  return (
    <Badge size={size} color="amber" variant="soft" highContrast>
      BETA
    </Badge>
  )
}
