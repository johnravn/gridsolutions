import { Box, CheckboxCards, Flex, Text } from '@radix-ui/themes'
import { CheckCircle, User } from 'iconoir-react'
import { technicianCrewBookingFromCheckedValues } from '../../utils/technicianCrewBooking'
import type { TechnicianCrewBookingSelection } from '../../utils/technicianCrewBooking'
import './TechnicianCrewBookingCards.css'

type Props = {
  value: TechnicianCrewBookingSelection
  onChange: (value: TechnicianCrewBookingSelection) => void
}

const iconStyle = { width: 18, height: 18, flexShrink: 0 } as const

export function TechnicianCrewBookingCards({ value, onChange }: Props) {
  return (
    <CheckboxCards.Root
      className="technician-crew-booking-cards"
      value={value ? [value] : []}
      onValueChange={(values) => {
        onChange(technicianCrewBookingFromCheckedValues(value, values))
      }}
      columns="2"
      size="1"
    >
      <CheckboxCards.Item value="open">
        <Box>
          <Flex gap="2" align="center" mb="1">
            <User style={iconStyle} />
            <Text size="2" weight="medium">
              Leave it open
            </Text>
          </Flex>
          <Text size="1" color="gray" as="p" mt="0" mb="0">
            Create a technician crew booking without assigning anyone.
          </Text>
        </Box>
      </CheckboxCards.Item>
      <CheckboxCards.Item value="confirm_myself">
        <Box>
          <Flex gap="2" align="center" mb="1">
            <CheckCircle style={iconStyle} />
            <Text size="2" weight="medium">
              Confirm myself
            </Text>
          </Flex>
          <Text size="1" color="gray" as="p" mt="0" mb="0">
            Create a technician crew booking and set you to confirmed.
          </Text>
        </Box>
      </CheckboxCards.Item>
    </CheckboxCards.Root>
  )
}
