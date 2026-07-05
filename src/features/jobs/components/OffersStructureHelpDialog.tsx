import * as React from 'react'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Separator,
  Text,
} from '@radix-ui/themes'
import { Calendar, QuestionMark, Sparks, Wrench } from 'iconoir-react'

function DiagramCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box
      p="3"
      style={{
        borderRadius: 10,
        border: '1px solid var(--gray-a5)',
        background: 'var(--gray-a2)',
      }}
    >
      <Text size="2" weight="medium" mb="2" as="div">
        {title}
      </Text>
      {children}
    </Box>
  )
}

function OfferStructureDiagram() {
  return (
    <svg
      viewBox="0 0 480 220"
      width="100%"
      height="auto"
      role="img"
      aria-label="Offer basis sits in the center with equipment, crew and transport. Technical and pretty offers branch from the same basis. Bookings sync from the basis."
    >
      <defs>
        <marker
          id="offers-help-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--gray-9)" />
        </marker>
        <marker
          id="offers-help-sync-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--green-9)" />
        </marker>
      </defs>

      {/* Offer basis — center hub */}
      <rect
        x="155"
        y="16"
        width="170"
        height="72"
        rx="12"
        fill="var(--accent-a3)"
        stroke="var(--accent-9)"
        strokeWidth="2"
      />
      <text
        x="240"
        y="44"
        textAnchor="middle"
        fill="var(--gray-12)"
        fontSize="14"
        fontWeight="600"
      >
        Offer basis
      </text>
      <text
        x="240"
        y="64"
        textAnchor="middle"
        fill="var(--gray-11)"
        fontSize="11"
      >
        Equipment · Crew · Transport
      </text>

      {/* Technical offer */}
      <rect
        x="24"
        y="118"
        width="128"
        height="56"
        rx="10"
        fill="var(--blue-a3)"
        stroke="var(--blue-9)"
        strokeWidth="1.5"
      />
      <text
        x="88"
        y="142"
        textAnchor="middle"
        fill="var(--gray-12)"
        fontSize="12"
        fontWeight="600"
      >
        Technical offer
      </text>
      <text
        x="88"
        y="160"
        textAnchor="middle"
        fill="var(--gray-11)"
        fontSize="10"
      >
        PDF · line prices
      </text>

      {/* Pretty offer */}
      <rect
        x="328"
        y="118"
        width="128"
        height="56"
        rx="10"
        fill="var(--purple-a3)"
        stroke="var(--purple-9)"
        strokeWidth="1.5"
      />
      <text
        x="392"
        y="142"
        textAnchor="middle"
        fill="var(--gray-12)"
        fontSize="12"
        fontWeight="600"
      >
        Pretty offer
      </text>
      <text
        x="392"
        y="160"
        textAnchor="middle"
        fill="var(--gray-11)"
        fontSize="10"
      >
        Branded web page
      </text>

      {/* Bookings */}
      <rect
        x="168"
        y="118"
        width="144"
        height="56"
        rx="10"
        fill="var(--green-a3)"
        stroke="var(--green-9)"
        strokeWidth="1.5"
      />
      <text
        x="240"
        y="142"
        textAnchor="middle"
        fill="var(--gray-12)"
        fontSize="12"
        fontWeight="600"
      >
        Job bookings
      </text>
      <text
        x="240"
        y="160"
        textAnchor="middle"
        fill="var(--gray-11)"
        fontSize="10"
      >
        Equipment · Crew · Vehicles
      </text>

      {/* Branches from basis to presentations */}
      <path
        d="M 195 88 L 88 118"
        fill="none"
        stroke="var(--gray-8)"
        strokeWidth="1.5"
        markerEnd="url(#offers-help-arrow)"
      />
      <path
        d="M 285 88 L 392 118"
        fill="none"
        stroke="var(--gray-8)"
        strokeWidth="1.5"
        markerEnd="url(#offers-help-arrow)"
      />

      {/* Sync from basis to bookings */}
      <path
        d="M 240 88 L 240 112"
        fill="none"
        stroke="var(--green-9)"
        strokeWidth="2"
        strokeDasharray="5 4"
        markerEnd="url(#offers-help-sync-arrow)"
      />
      <text
        x="252"
        y="106"
        fill="var(--green-11)"
        fontSize="10"
        fontWeight="600"
      >
        sync
      </text>

      <text
        x="240"
        y="204"
        textAnchor="middle"
        fill="var(--gray-10)"
        fontSize="10"
      >
        One basis · many presentations · one source of truth for bookings
      </text>
    </svg>
  )
}

function BookingSyncDiagram() {
  return (
    <svg
      viewBox="0 0 480 150"
      width="100%"
      height="auto"
      role="img"
      aria-label="Bookings sync from the offer basis, not from individual technical or pretty offers."
    >
      <defs>
        <marker
          id="offers-help-sync-arrow-2"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--green-9)" />
        </marker>
      </defs>
      {/* Left: what syncs */}
      <rect
        x="16"
        y="20"
        width="200"
        height="52"
        rx="10"
        fill="var(--green-a3)"
        stroke="var(--green-9)"
        strokeWidth="1.5"
      />
      <text x="32" y="42" fill="var(--green-11)" fontSize="16" fontWeight="700">
        ✓
      </text>
      <text x="52" y="42" fill="var(--gray-12)" fontSize="12" fontWeight="600">
        Offer basis → Bookings
      </text>
      <text x="52" y="58" fill="var(--gray-11)" fontSize="10">
        Edit equipment, crew &amp; transport here
      </text>

      {/* Right: what does NOT sync */}
      <rect
        x="264"
        y="20"
        width="200"
        height="52"
        rx="10"
        fill="var(--gray-a2)"
        stroke="var(--gray-a6)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <text x="280" y="42" fill="var(--red-11)" fontSize="16" fontWeight="700">
        ✗
      </text>
      <text x="300" y="42" fill="var(--gray-11)" fontSize="12" fontWeight="600">
        Offers → Bookings
      </text>
      <text x="300" y="58" fill="var(--gray-10)" fontSize="10">
        Technical &amp; pretty are presentation only
      </text>

      {/* Flow illustration */}
      <rect
        x="72"
        y="88"
        width="120"
        height="44"
        rx="8"
        fill="var(--accent-a3)"
        stroke="var(--accent-9)"
        strokeWidth="1.5"
      />
      <text
        x="132"
        y="114"
        textAnchor="middle"
        fill="var(--gray-12)"
        fontSize="11"
        fontWeight="600"
      >
        Offer basis
      </text>

      <path
        d="M 192 110 L 248 110"
        fill="none"
        stroke="var(--green-9)"
        strokeWidth="2"
        markerEnd="url(#offers-help-sync-arrow-2)"
      />
      <text
        x="220"
        y="102"
        textAnchor="middle"
        fill="var(--green-11)"
        fontSize="9"
        fontWeight="600"
      >
        Sync
      </text>

      <rect
        x="248"
        y="88"
        width="120"
        height="44"
        rx="8"
        fill="var(--green-a3)"
        stroke="var(--green-9)"
        strokeWidth="1.5"
      />
      <text
        x="308"
        y="114"
        textAnchor="middle"
        fill="var(--gray-12)"
        fontSize="11"
        fontWeight="600"
      >
        Bookings tab
      </text>
    </svg>
  )
}

function WorkflowDiagram() {
  const steps = [
    { n: '1', label: 'New basis', sub: 'Start empty in the editor' },
    {
      n: '2',
      label: 'Edit line items',
      sub: 'Add manually or import bookings',
    },
    { n: '3', label: 'Add offers', sub: 'Technical and/or pretty' },
    { n: '4', label: 'Sync bookings', sub: 'When the job is ready' },
  ]

  return (
    <svg
      viewBox="0 0 480 100"
      width="100%"
      height="auto"
      role="img"
      aria-label="Four-step workflow: create basis, edit line items, add offers, sync bookings."
    >
      <defs>
        <marker
          id="offers-help-arrow-3"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--gray-9)" />
        </marker>
      </defs>
      {steps.map((step, index) => {
        const x = 12 + index * 118
        return (
          <g key={step.n}>
            <circle
              cx={x + 44}
              cy="28"
              r="18"
              fill="var(--accent-a3)"
              stroke="var(--accent-9)"
              strokeWidth="1.5"
            />
            <text
              x={x + 44}
              y="33"
              textAnchor="middle"
              fill="var(--accent-11)"
              fontSize="14"
              fontWeight="700"
            >
              {step.n}
            </text>
            <text
              x={x + 44}
              y="62"
              textAnchor="middle"
              fill="var(--gray-12)"
              fontSize="11"
              fontWeight="600"
            >
              {step.label}
            </text>
            <text
              x={x + 44}
              y="78"
              textAnchor="middle"
              fill="var(--gray-10)"
              fontSize="9"
            >
              {step.sub}
            </text>
            {index < steps.length - 1 && (
              <path
                d={`M ${x + 66} 28 L ${x + 92} 28`}
                fill="none"
                stroke="var(--gray-7)"
                strokeWidth="1.5"
                markerEnd="url(#offers-help-arrow-3)"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function LegendRow({
  icon,
  color,
  title,
  description,
}: {
  icon: React.ReactNode
  color: 'accent' | 'blue' | 'purple' | 'green'
  title: string
  description: string
}) {
  const swatch: Record<typeof color, string> = {
    accent: 'var(--accent-9)',
    blue: 'var(--blue-9)',
    purple: 'var(--purple-9)',
    green: 'var(--green-9)',
  }

  return (
    <Flex gap="3" align="start">
      <Flex
        align="center"
        justify="center"
        width="32px"
        height="32px"
        style={{
          flexShrink: 0,
          borderRadius: 8,
          background: `color-mix(in srgb, ${swatch[color]} 18%, transparent)`,
          color: swatch[color],
        }}
      >
        {icon}
      </Flex>
      <Box style={{ minWidth: 0 }}>
        <Text size="2" weight="medium" as="div">
          {title}
        </Text>
        <Text size="2" color="gray" as="div">
          {description}
        </Text>
      </Box>
    </Flex>
  )
}

export function OffersStructureHelpDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <IconButton
        variant="ghost"
        size="2"
        color="gray"
        aria-label="How offers work"
        onClick={() => setOpen(true)}
        style={{ cursor: 'help' }}
      >
        <QuestionMark width={18} height={18} />
      </IconButton>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="640px">
          <Dialog.Title>How offers work</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            Offers are built around a shared <strong>offer basis</strong> — the
            single place for equipment, crew, and transport. Technical and
            pretty offers are different ways to present the same content, and
            bookings always sync from the basis.
          </Dialog.Description>

          <ScrollArea
            type="auto"
            scrollbars="vertical"
            style={{ maxHeight: 'min(70vh, 560px)' }}
          >
            <Flex direction="column" gap="4" pr="3">
              <DiagramCard title="The big picture">
                <OfferStructureDiagram />
              </DiagramCard>

              <DiagramCard title="What syncs to bookings">
                <BookingSyncDiagram />
              </DiagramCard>

              <DiagramCard title="Typical workflow">
                <WorkflowDiagram />
              </DiagramCard>

              <Separator size="4" />

              <Box>
                <Heading size="2" mb="3">
                  The three layers
                </Heading>
                <Flex direction="column" gap="3">
                  <LegendRow
                    color="accent"
                    icon={<Wrench width={16} height={16} />}
                    title="Offer basis"
                    description="Where you add and edit equipment groups, crew roles, and transport. This is the source of truth for what the job needs."
                  />
                  <LegendRow
                    color="blue"
                    icon={<Calendar width={16} height={16} />}
                    title="Technical offer"
                    description="A detailed PDF-style quote with line prices, discounts, and VAT. Good for internal review or customers who want the full breakdown."
                  />
                  <LegendRow
                    color="purple"
                    icon={<Sparks width={16} height={16} />}
                    title="Pretty offer"
                    description="A branded web page you can share with a link. Uses the same basis for pricing, with modules, galleries, and your company look."
                  />
                </Flex>
              </Box>

              <Box
                p="3"
                style={{
                  borderRadius: 10,
                  background: 'var(--green-a2)',
                  border: '1px solid var(--green-a5)',
                }}
              >
                <Text size="2" weight="medium" as="div" mb="1">
                  Sync bookings from the basis
                </Text>
                <Text size="2" color="gray" as="div">
                  Use <strong>Create bookings</strong> or{' '}
                  <strong>Sync from basis</strong> on the offer basis card — not
                  on individual offers. After syncing, the basis is locked until
                  you unlock it or create a new basis version.
                </Text>
              </Box>
            </Flex>
          </ScrollArea>

          <Flex justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft">Got it</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
