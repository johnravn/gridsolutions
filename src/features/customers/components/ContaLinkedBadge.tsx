import { Badge, Tooltip } from '@radix-ui/themes'

export function ContaLinkedBadge({ linked }: { linked: boolean }) {
  if (linked) {
    return (
      <Tooltip content="Synced with Conta">
        <Badge variant="soft" color="green" size="1">
          Linked
        </Badge>
      </Tooltip>
    )
  }
  return (
    <Tooltip content="This customer is not yet linked to a Conta contact">
      <Badge variant="soft" color="amber" size="1">
        Not linked
      </Badge>
    </Tooltip>
  )
}
