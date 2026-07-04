import * as React from 'react'
import { Badge, Table, Text } from '@radix-ui/themes'
import { vehicleOwnerBadge } from '../lib/ownership'
import type { VehicleIndexRow } from '../api/queries'

export default function VehiclesList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Array<VehicleIndexRow>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <Table.Root variant="surface" style={{ marginTop: 16 }}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Reg</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Fuel</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Owner</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={4}>No vehicles</Table.Cell>
          </Table.Row>
        ) : (
          rows.map((v) => {
            const active = v.id === selectedId
            const ownerBadge = vehicleOwnerBadge(v)
            return (
              <Table.Row
                key={v.id}
                onClick={() => onSelect(v.id)}
                style={{
                  cursor: 'pointer',
                  background: active ? 'var(--accent-a3)' : undefined,
                }}
                data-state={active ? 'active' : undefined}
              >
                <Table.Cell>
                  <Text size="2" weight="medium">
                    {v.name}
                  </Text>
                </Table.Cell>
                <Table.Cell>{v.registration_no ?? '—'}</Table.Cell>
                <Table.Cell>
                  {v.fuel ? (
                    <Badge
                      variant="soft"
                      color={
                        v.fuel === 'electric'
                          ? 'green'
                          : v.fuel === 'diesel'
                            ? 'orange'
                            : 'blue'
                      }
                    >
                      {v.fuel}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="soft" color={ownerBadge.color}>
                    {ownerBadge.label}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            )
          })
        )}
        {/* Probe row for height measurement */}
        <Table.Row
          data-row-probe
          style={{
            display: 'none',
          }}
        >
          <Table.Cell colSpan={4}>probe</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  )
}
