import { Badge, Box, Callout, Flex, Text } from '@radix-ui/themes'
import { Check, Xmark } from 'iconoir-react'
import { parseMatterOutcome } from '../utils/crewInviteAnswer'
import type {
  MatterOutcome,
  MatterOutcomeStatus,
} from '../utils/crewInviteAnswer'

export function crewInviteAnswerStatus(
  metadata: unknown,
): MatterOutcomeStatus | null {
  return parseMatterOutcome(metadata)?.status ?? null
}

export function CrewInviteAnswerBadge({
  status,
  withLabel = false,
}: {
  status: MatterOutcomeStatus
  withLabel?: boolean
}) {
  const accepted = status === 'accepted'
  return (
    <Badge
      radius="full"
      color={accepted ? 'green' : 'red'}
      size="2"
      title={accepted ? 'Accepted' : 'Declined'}
    >
      <Flex align="center" gap="1">
        {accepted ? (
          <Check width={14} height={14} />
        ) : (
          <Xmark width={14} height={14} />
        )}
        {withLabel ? (accepted ? 'Accepted' : 'Declined') : null}
      </Flex>
    </Badge>
  )
}

export function MatterOutcomeBanner({
  outcome,
  jobTitle,
  roleTitle,
}: {
  outcome: MatterOutcome
  jobTitle?: string | null
  roleTitle?: string | null
}) {
  const accepted = outcome.status === 'accepted'
  const job = jobTitle?.trim() || 'Untitled job'
  const role = roleTitle?.trim() || 'Role'
  const detail =
    outcome.kind === 'offer'
      ? `Offer for "${job}".`
      : `Crew invitation for "${job}" (${role}).`
  return (
    <Box mb="4">
      <Callout.Root color={accepted ? 'green' : 'red'} variant="soft">
        <Callout.Icon>
          {accepted ? (
            <Check width={18} height={18} />
          ) : (
            <Xmark width={18} height={18} />
          )}
        </Callout.Icon>
        <Callout.Text>
          <Flex direction="column" gap="1">
            <Text weight="bold">{accepted ? 'Accepted' : 'Declined'}</Text>
            <Text>{detail}</Text>
          </Flex>
        </Callout.Text>
      </Callout.Root>
    </Box>
  )
}

export function CrewInviteAnswerBanner({
  status,
  jobTitle,
  roleTitle,
}: {
  status: MatterOutcomeStatus
  jobTitle?: string | null
  roleTitle?: string | null
}) {
  return (
    <MatterOutcomeBanner
      outcome={{
        kind: 'crew_invite',
        status,
        answeredByUserId: null,
        answeredByName: null,
      }}
      jobTitle={jobTitle}
      roleTitle={roleTitle}
    />
  )
}
