import * as React from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Badge, Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { Plus, Spark, Trash, WarningTriangle } from 'iconoir-react'
import {
  buildModuleTitleSuggestions,
  buildModuleTitlesFromLineItemSource,
  filterNewModuleTitles,
  isPrettyModuleStoryComplete,
  lineItemSourceFromOfferBasis,
  validatePrettyOfferModules,
} from '../../../utils/prettyOfferCalculations'
import { SortableContentBlock } from './sortable'
import { ModuleEditor } from './ModuleEditor'
import { TimelineModuleEditor } from './TimelineModuleEditor'
import { createEmptyModule, createEmptyTimelineModule } from './types'
import type { PrettyOfferPricingOptions } from '../../../utils/prettyOfferCalculations'
import type { LocalPrettyModule, LocalPricingBasis } from './types'
import type { OfferBasisDetail } from '../../../types'

type Props = {
  jobId: string
  companyId: string
  offerId: string
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
  offerBasisDetail: OfferBasisDetail | null | undefined
  splitCalculationOptions: PrettyOfferPricingOptions
  selectedModuleId: string | null
  readOnly: boolean
  onModulesChange: (modules: Array<LocalPrettyModule>) => void
  onSelectModule: (moduleId: string | null) => void
}

export function ModulesSection({
  jobId,
  companyId,
  offerId,
  modules,
  pricingBases,
  offerBasisDetail,
  splitCalculationOptions,
  selectedModuleId,
  readOnly,
  onModulesChange,
  onSelectModule,
}: Props) {
  const [hoveredModuleId, setHoveredModuleId] = React.useState<string | null>(
    null,
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const sorted = [...modules].sort((a, b) => a.sort_order - b.sort_order)
  const selected =
    sorted.find((m) => m.id === selectedModuleId) ?? sorted[0] ?? null

  React.useEffect(() => {
    if (!selectedModuleId && sorted[0]) {
      onSelectModule(sorted[0].id)
    }
  }, [selectedModuleId, sorted, onSelectModule])

  const setModules = (next: Array<LocalPrettyModule>) => {
    onModulesChange(
      next.map((module, index) => ({ ...module, sort_order: index })),
    )
  }

  const addModule = () => {
    const next = [...sorted, createEmptyModule(sorted.length)]
    setModules(next)
    onSelectModule(next[next.length - 1].id)
  }

  const addTimelineModule = () => {
    const next = [...sorted, createEmptyTimelineModule(sorted.length)]
    setModules(next)
    onSelectModule(next[next.length - 1].id)
  }

  const categoryTitles = React.useMemo(() => {
    if (!offerBasisDetail) return []
    return buildModuleTitlesFromLineItemSource(
      lineItemSourceFromOfferBasis(offerBasisDetail),
    )
  }, [offerBasisDetail])

  const newCategoryTitles = React.useMemo(
    () => filterNewModuleTitles(categoryTitles, sorted),
    [categoryTitles, sorted],
  )

  const addModulesFromBasis = () => {
    if (newCategoryTitles.length === 0) return
    const next = [...sorted]
    for (const title of newCategoryTitles) {
      const module = createEmptyModule(next.length)
      module.title = title
      next.push(module)
    }
    setModules(next)
    onSelectModule(next[sorted.length]?.id ?? null)
  }

  const removeModule = (moduleId: string) => {
    const next = sorted.filter((m) => m.id !== moduleId)
    setModules(next)
    onSelectModule(next[0]?.id ?? null)
  }

  const updateModule = (module: LocalPrettyModule) => {
    setModules(sorted.map((m) => (m.id === module.id ? module : m)))
  }

  const selectedFieldErrors = React.useMemo(() => {
    if (!selected) return {}
    const issues = validatePrettyOfferModules([selected])
    return Object.fromEntries(
      issues.map((issue) => [issue.field ?? 'general', issue.message]),
    )
  }, [selected])

  const selectedTitleSuggestions = React.useMemo(() => {
    if (!selected) return []
    return buildModuleTitleSuggestions({
      basisTitles: categoryTitles,
      existingModules: sorted.filter((module) => module.id !== selected.id),
      currentModuleTitle: selected.title,
    })
  }, [selected, categoryTitles, sorted])

  return (
    <Flex
      gap="4"
      style={{ flex: 1, minHeight: 0, height: '100%', alignItems: 'stretch' }}
    >
      <Box
        style={{
          width: 300,
          flexShrink: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Flex justify="between" align="center" mb="2" style={{ flexShrink: 0 }}>
          <Text size="2" weight="bold">
            Modules
          </Text>
          {!readOnly && (
            <Flex gap="1">
              {offerBasisDetail && categoryTitles.length > 0 && (
                <Button
                  size="1"
                  variant="soft"
                  disabled={newCategoryTitles.length === 0}
                  onClick={addModulesFromBasis}
                >
                  <Spark width={14} height={14} />
                  From basis
                </Button>
              )}
              <Button size="1" onClick={addModule}>
                <Plus width={14} height={14} />
                Add
              </Button>
              <Button size="1" variant="soft" onClick={addTimelineModule}>
                <Plus width={14} height={14} />
                Timeline
              </Button>
            </Flex>
          )}
        </Flex>
        <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {sorted.length === 0 ? (
            <Text size="2" color="gray">
              Add modules like Audio, Lights, or Rigging.
            </Text>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return
                const oldIndex = sorted.findIndex((m) => m.id === active.id)
                const newIndex = sorted.findIndex((m) => m.id === over.id)
                if (oldIndex < 0 || newIndex < 0) return
                setModules(arrayMove(sorted, oldIndex, newIndex))
              }}
            >
              <SortableContext
                items={sorted.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <Flex direction="column" gap="2">
                  {sorted.map((module) => (
                    <SortableContentBlock
                      key={module.id}
                      id={module.id}
                      disabled={readOnly}
                    >
                      {({ handle }) => (
                        <Flex
                          align="center"
                          gap="2"
                          p="3"
                          style={{
                            borderRadius: 8,
                            cursor: 'pointer',
                            minHeight: 52,
                            background:
                              selected?.id === module.id
                                ? 'var(--accent-a3)'
                                : 'var(--gray-a2)',
                          }}
                          onClick={() => onSelectModule(module.id)}
                          onMouseEnter={() => setHoveredModuleId(module.id)}
                          onMouseLeave={() => setHoveredModuleId(null)}
                        >
                          {handle}
                          <Text
                            size="3"
                            weight="medium"
                            truncate
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            {module.title || 'Untitled module'}
                          </Text>
                          {!isPrettyModuleStoryComplete(module) && (
                            <Badge color="orange" variant="soft" size="1">
                              <WarningTriangle width={12} height={12} />
                              Incomplete
                            </Badge>
                          )}
                          {module.module_type === 'timeline' && (
                            <Badge color="blue" variant="soft" size="1">
                              Timeline
                            </Badge>
                          )}
                          {!readOnly && (
                            <IconButton
                              size="2"
                              variant="ghost"
                              color="red"
                              aria-label="Delete module"
                              style={{
                                flexShrink: 0,
                                opacity: hoveredModuleId === module.id ? 1 : 0,
                                pointerEvents:
                                  hoveredModuleId === module.id
                                    ? 'auto'
                                    : 'none',
                                transition: 'opacity 0.15s ease',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                removeModule(module.id)
                              }}
                            >
                              <Trash width={16} height={16} />
                            </IconButton>
                          )}
                        </Flex>
                      )}
                    </SortableContentBlock>
                  ))}
                </Flex>
              </SortableContext>
            </DndContext>
          )}
        </Box>
      </Box>

      <Box style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
        {selected ? (
          selected.module_type === 'timeline' ? (
            <TimelineModuleEditor
              module={selected}
              jobId={jobId}
              readOnly={readOnly}
              fieldErrors={selectedFieldErrors}
              onChange={updateModule}
            />
          ) : (
            <ModuleEditor
              module={selected}
              jobId={jobId}
              companyId={companyId}
              offerId={offerId}
              pricingBases={pricingBases}
              splitCalculationOptions={splitCalculationOptions}
              titleSuggestions={selectedTitleSuggestions}
              readOnly={readOnly}
              fieldErrors={selectedFieldErrors}
              onChange={updateModule}
            />
          )
        ) : (
          <Text size="2" color="gray">
            Select or add a module to edit.
          </Text>
        )}
      </Box>
    </Flex>
  )
}
