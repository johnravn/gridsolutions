import { Badge, Box, Button, Checkbox, Flex, Text } from '@radix-ui/themes'
import { Spark } from 'iconoir-react'
import {
  normalizeCategoryKey,
  suggestCategoryMappingsForModule,
} from '../../../utils/prettyOfferCalculations'
import { CATEGORY_TYPE_LABELS, createTempId } from './types'
import type { LocalCategoryMapping, LocalPrettyModule } from './types'
import type { OfferDetail } from '../../../types'

type CategoryOption = {
  category_type: LocalCategoryMapping['category_type']
  category_key: string
  label: string
}

function buildCategoryOptions(
  technicalOffer: OfferDetail,
): Array<CategoryOption> {
  const options: Array<CategoryOption> = []

  for (const group of technicalOffer.groups ?? []) {
    if (!group.group_name.trim()) continue
    options.push({
      category_type: 'equipment_group',
      category_key: group.group_name,
      label: `Equipment: ${group.group_name}`,
    })
  }

  const crewCategories = new Set<string>()
  for (const item of technicalOffer.crew_items ?? []) {
    if (!item.role_category?.trim()) continue
    crewCategories.add(item.role_category)
  }
  for (const category of crewCategories) {
    options.push({
      category_type: 'crew_category',
      category_key: category,
      label: `Crew: ${category}`,
    })
  }

  for (const group of technicalOffer.transport_groups ?? []) {
    if (!group.group_name.trim()) continue
    options.push({
      category_type: 'transport_group',
      category_key: group.group_name,
      label: `Transport: ${group.group_name}`,
    })
  }

  return options
}

function mappingKey(mapping: LocalCategoryMapping): string {
  return `${mapping.category_type}:${normalizeCategoryKey(mapping.category_key)}`
}

type Props = {
  modules: Array<LocalPrettyModule>
  technicalOffer: OfferDetail | null
  readOnly: boolean
  onModulesChange: (modules: Array<LocalPrettyModule>) => void
}

export function TechnicalBasisSection({
  modules,
  technicalOffer,
  readOnly,
  onModulesChange,
}: Props) {
  const options = technicalOffer ? buildCategoryOptions(technicalOffer) : []

  const technicalModules = modules.filter((m) => m.basis_type === 'technical')

  const toggleMapping = (module: LocalPrettyModule, option: CategoryOption) => {
    const key = `${option.category_type}:${normalizeCategoryKey(option.category_key)}`
    const exists = module.category_mappings.some((m) => mappingKey(m) === key)

    const category_mappings = exists
      ? module.category_mappings.filter((m) => mappingKey(m) !== key)
      : [
          ...module.category_mappings,
          {
            id: createTempId('map'),
            module_id: module.id,
            category_type: option.category_type,
            category_key: option.category_key,
          },
        ]

    onModulesChange(
      modules.map((m) =>
        m.id === module.id ? { ...m, category_mappings } : m,
      ),
    )
  }

  const autoSuggest = (module: LocalPrettyModule) => {
    if (!technicalOffer) return
    const suggestions = suggestCategoryMappingsForModule(
      module.title,
      technicalOffer,
    ).map((s) => ({
      ...s,
      id: createTempId('map'),
      module_id: module.id,
    }))

    onModulesChange(
      modules.map((m) =>
        m.id === module.id
          ? {
              ...m,
              category_mappings: suggestions as Array<LocalCategoryMapping>,
            }
          : m,
      ),
    )
  }

  if (!technicalOffer) {
    return (
      <Text size="2" color="gray">
        Link a technical offer in Settings to map categories to modules.
      </Text>
    )
  }

  if (technicalModules.length === 0) {
    return (
      <Text size="2" color="gray">
        Set one or more modules to the &quot;Technical offer categories&quot;
        basis type to configure mappings.
      </Text>
    )
  }

  return (
    <Flex direction="column" gap="4">
      {technicalModules.map((module) => (
        <Box
          key={module.id}
          p="3"
          style={{ border: '1px solid var(--gray-a5)', borderRadius: 8 }}
        >
          <Flex justify="between" align="center" mb="2">
            <Text size="2" weight="medium">
              {module.title || 'Untitled module'}
            </Text>
            {!readOnly && (
              <Button
                size="1"
                variant="soft"
                onClick={() => autoSuggest(module)}
              >
                <Spark width={14} height={14} />
                Auto-match title
              </Button>
            )}
          </Flex>

          <Flex gap="2" wrap="wrap">
            {options.map((option) => {
              const selected = module.category_mappings.some(
                (m) =>
                  m.category_type === option.category_type &&
                  normalizeCategoryKey(m.category_key) ===
                    normalizeCategoryKey(option.category_key),
              )
              return (
                <label key={`${module.id}-${option.label}`}>
                  <Flex
                    align="center"
                    gap="2"
                    p="2"
                    style={{
                      borderRadius: 8,
                      border: '1px solid var(--gray-a5)',
                      background: selected ? 'var(--accent-a3)' : undefined,
                      cursor: readOnly ? 'default' : 'pointer',
                    }}
                  >
                    <Checkbox
                      checked={selected}
                      disabled={readOnly}
                      onCheckedChange={() => toggleMapping(module, option)}
                    />
                    <Text size="1">{option.label}</Text>
                    <Badge size="1" color="gray">
                      {CATEGORY_TYPE_LABELS[option.category_type]}
                    </Badge>
                  </Flex>
                </label>
              )
            })}
          </Flex>

          {options.length === 0 && (
            <Text size="2" color="gray">
              The linked technical offer has no equipment groups, crew
              categories, or transport groups.
            </Text>
          )}
        </Box>
      ))}
    </Flex>
  )
}
