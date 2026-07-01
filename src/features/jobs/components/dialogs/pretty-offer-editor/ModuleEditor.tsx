import {
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Plus, Trash } from 'iconoir-react'
import { BASIS_TYPE_LABELS, createEmptyManualField } from './types'
import { ContentBlocksSection } from './ContentBlocksSection'
import type { LocalPrettyModule } from './types'

type Props = {
  module: LocalPrettyModule
  jobId: string
  companyId: string
  offerId: string
  readOnly: boolean
  onChange: (module: LocalPrettyModule) => void
}

export function ModuleEditor({
  module,
  jobId,
  companyId,
  offerId,
  readOnly,
  onChange,
}: Props) {
  const update = (patch: Partial<LocalPrettyModule>) => {
    onChange({ ...module, ...patch })
  }

  const addManualField = () => {
    update({
      manual_fields: [
        ...module.manual_fields,
        createEmptyManualField(module.id, module.manual_fields.length),
      ],
    })
  }

  const updateManualField = (
    fieldId: string,
    patch: Partial<LocalPrettyModule['manual_fields'][number]>,
  ) => {
    update({
      manual_fields: module.manual_fields.map((field) =>
        field.id === fieldId ? { ...field, ...patch } : field,
      ),
    })
  }

  const removeManualField = (fieldId: string) => {
    update({
      manual_fields: module.manual_fields.filter(
        (field) => field.id !== fieldId,
      ),
    })
  }

  return (
    <Box>
      <Flex direction="column" gap="3">
        <Box>
          <Text size="2" weight="medium" mb="1" as="div">
            Title
          </Text>
          <TextField.Root
            value={module.title}
            disabled={readOnly}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Audio"
          />
        </Box>

        <Flex gap="3" align="end" wrap="wrap">
          <Box style={{ flex: 1, minWidth: 160 }}>
            <Text size="2" weight="medium" mb="1" as="div">
              Basis type
            </Text>
            <Select.Root
              value={module.basis_type}
              disabled={readOnly}
              onValueChange={(value) =>
                update({
                  basis_type: value as LocalPrettyModule['basis_type'],
                })
              }
            >
              <Select.Trigger />
              <Select.Content style={{ zIndex: 10000 }}>
                {Object.entries(BASIS_TYPE_LABELS).map(([value, label]) => (
                  <Select.Item key={value} value={value}>
                    {label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>

          <Flex align="center" gap="2" style={{ minWidth: 160 }}>
            <Checkbox
              checked={module.show_price}
              disabled={readOnly}
              onCheckedChange={(checked) =>
                update({ show_price: checked === true })
              }
            />
            <Text size="2">Show price to customer</Text>
          </Flex>

          {module.show_price && (
            <Box style={{ flex: 1, minWidth: 140 }}>
              <Text size="2" weight="medium" mb="1" as="div">
                Customer price (footer)
              </Text>
              <TextField.Root
                type="number"
                value={module.display_price ?? ''}
                disabled={readOnly}
                onChange={(e) =>
                  update({
                    display_price: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                placeholder="Optional"
              />
            </Box>
          )}
        </Flex>

        {module.basis_type === 'manual' && (
          <Box>
            <Flex justify="between" align="center" mb="2">
              <Text size="2" weight="medium">
                Manual cost inputs
              </Text>
              {!readOnly && (
                <Button size="1" variant="soft" onClick={addManualField}>
                  <Plus width={14} height={14} />
                  Add field
                </Button>
              )}
            </Flex>
            <Flex direction="column" gap="2">
              {module.manual_fields.map((field) => (
                <Flex key={field.id} gap="2" align="center">
                  <TextField.Root
                    style={{ flex: 1 }}
                    value={field.label}
                    disabled={readOnly}
                    placeholder="Label"
                    onChange={(e) =>
                      updateManualField(field.id, { label: e.target.value })
                    }
                  />
                  <TextField.Root
                    style={{ width: 140 }}
                    value={field.value}
                    disabled={readOnly}
                    placeholder="Amount"
                    onChange={(e) =>
                      updateManualField(field.id, { value: e.target.value })
                    }
                  />
                  {!readOnly && (
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="red"
                      onClick={() => removeManualField(field.id)}
                    >
                      <Trash width={14} height={14} />
                    </IconButton>
                  )}
                </Flex>
              ))}
              {module.manual_fields.length === 0 && (
                <Text size="2" color="gray">
                  Add labeled amounts that sum to this module&apos;s cost.
                </Text>
              )}
            </Flex>
          </Box>
        )}

        <Separator size="4" />

        <ContentBlocksSection
          moduleId={module.id}
          jobId={jobId}
          companyId={companyId}
          offerId={offerId}
          blocks={module.content_blocks}
          readOnly={readOnly}
          onChange={(content_blocks) => update({ content_blocks })}
        />
      </Flex>
    </Box>
  )
}
