// src/features/company/components/CompanyInspector.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Code,
  Flex,
  Grid,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import { Edit, MessageText } from 'iconoir-react'
import MapEmbed from '@shared/maps/MapEmbed'
import InspectorSkeleton from '@shared/ui/components/InspectorSkeleton'
import { companyDetailQuery } from '../api/queries'
import EditCompanyDialog from './dialogs/EditCompanyDialog'
import EditWelcomeMatterDialog from './dialogs/EditWelcomeMatterDialog'

export default function CompanyInspector() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [welcomeMatterOpen, setWelcomeMatterOpen] = React.useState(false)
  const { data, isLoading, isError, error } = useQuery({
    ...(companyId
      ? companyDetailQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'company-detail'] as const,
          queryFn: async () => null,
        }),
    enabled: !!companyId,
  })

  if (isLoading) return <InspectorSkeleton />
  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )
  if (!data) return <Text color="gray">Not found.</Text>

  return (
    <Box>
      {/* Header with Edit button */}
      <Flex align="center" justify="between" mb="3">
        <SectionTitle>Company details</SectionTitle>
        <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
          <Edit />
        </Button>
      </Flex>

      <EditCompanyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={data}
        onSaved={() => {
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'company-detail'],
          })
        }}
      />

      <DefinitionList>
        <DT>Name</DT>
        <DD>{data.name}</DD>

        <DT>Created</DT>
        <DD>{formatDate(data.created_at)}</DD>

        <DT>VAT number</DT>
        <DD>{fmtVAT(data.vat_number)}</DD>

        <DT>General email</DT>
        <DD>
          {data.general_email ? (
            <a
              href={`mailto:${data.general_email}`}
              style={{ color: 'inherit' }}
            >
              {data.general_email}
            </a>
          ) : (
            '—'
          )}
        </DD>
      </DefinitionList>

      <Separator my="3" />

      {/* Address section */}
      <SectionTitle>Address</SectionTitle>
      {data.address ? (
        (() => {
          // Parse the address string (stored as comma-separated: address_line, zip_code, city, country)
          const parts = data.address
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
          const parsed = {
            address_line: parts[0] || '',
            zip_code: parts[1] || '',
            city: parts[2] || '',
            country: parts[3] || '',
          }

          return (
            <>
              <DefinitionList>
                <DT>Street</DT>
                <DD>{parsed.address_line || '—'}</DD>

                <DT>City</DT>
                <DD>
                  {parsed.zip_code || parsed.city
                    ? `${parsed.zip_code} ${parsed.city}`.trim() || '—'
                    : '—'}
                </DD>

                <DT>Country</DT>
                <DD>{parsed.country || '—'}</DD>
              </DefinitionList>
              <Box mt="3" style={{ maxWidth: 500 }}>
                <MapEmbed query={data.address} zoom={15} />
              </Box>
            </>
          )
        })()
      ) : (
        <Text size="2" color="gray" mb="3">
          No address on file
        </Text>
      )}

      <Separator my="3" />

      {/* Contact person section - expanded */}
      <Box>
        <Text as="div" size="2" weight="bold" mb="2">
          Contact person
        </Text>
        <Text as="div" size="1" color="gray" mb="3">
          For system owner to contact this company
        </Text>
        {data.contact_person ? (
          <Flex
            direction="column"
            gap="2"
            style={{
              padding: 12,
              background: 'var(--gray-a2)',
              borderRadius: 6,
            }}
          >
            <div>
              <Text as="div" size="2" weight="medium">
                {data.contact_person.display_name || 'No name'}
              </Text>
            </div>
            {data.contact_person.email && (
              <div>
                <Text
                  as="div"
                  size="1"
                  color="gray"
                  style={{ marginBottom: 2 }}
                >
                  Email
                </Text>
                <Text as="div" size="2">
                  <a
                    href={`mailto:${data.contact_person.email}`}
                    style={{ color: 'inherit' }}
                  >
                    {data.contact_person.email}
                  </a>
                </Text>
              </div>
            )}
            {data.contact_person.phone && (
              <div>
                <Text
                  as="div"
                  size="1"
                  color="gray"
                  style={{ marginBottom: 2 }}
                >
                  Phone
                </Text>
                <Text as="div" size="2">
                  <a
                    href={`tel:${data.contact_person.phone}`}
                    style={{ color: 'inherit' }}
                  >
                    {prettyPhone(data.contact_person.phone)}
                  </a>
                </Text>
              </div>
            )}
          </Flex>
        ) : (
          <Text size="2" color="gray">
            No contact person assigned
          </Text>
        )}
      </Box>

      <Separator my="3" />

      {/* Welcome matter section */}
      <Box>
        <Flex align="center" justify="between" mb="2">
          <Text as="div" size="2" weight="bold">
            Welcome matter
          </Text>
          <Button
            size="2"
            variant="soft"
            onClick={() => setWelcomeMatterOpen(true)}
          >
            <MessageText />
            Edit welcome message
          </Button>
        </Flex>
        <Text as="div" size="1" color="gray" mb="2">
          Message sent to all users when they are added to this company
        </Text>
        <EditWelcomeMatterDialog
          open={welcomeMatterOpen}
          onOpenChange={setWelcomeMatterOpen}
          onSaved={() => {}}
        />
      </Box>

      <Separator my="3" />
    </Box>
  )
}

/* ----- mini UI helpers (same vibe as CrewInspector) ----- */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text as="div" size="2" weight="bold" mb="2">
      {children}
    </Text>
  )
}
function DefinitionList({ children }: { children: React.ReactNode }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        rowGap: 8,
        columnGap: 12,
        marginBottom: 12,
      }}
    >
      {children}
    </dl>
  )
}
function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt>
      <Text size="1" color="gray">
        {children}
      </Text>
    </dt>
  )
}
function DD({ children }: { children: React.ReactNode }) {
  return (
    <dd>
      <Text size="2">{children}</Text>
    </dd>
  )
}
function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
