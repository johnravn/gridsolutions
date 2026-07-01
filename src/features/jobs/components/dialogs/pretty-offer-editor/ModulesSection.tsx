import * as React from 'react'
import { Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { NavArrowDown, NavArrowUp, Plus, Trash } from 'iconoir-react'
import { ModuleEditor } from './ModuleEditor'
import { BASIS_TYPE_LABELS, createEmptyModule } from './types'
import type { LocalPrettyModule } from './types'

type Props = {
  jobId: string
  companyId: string
  offerId: string
  modules: Array<LocalPrettyModule>
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
  selectedModuleId,
  readOnly,
  onModulesChange,
  onSelectModule,
}: Props) {
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

  const removeModule = (moduleId: string) => {
    const next = sorted.filter((m) => m.id !== moduleId)
    setModules(next)
    onSelectModule(next[0]?.id ?? null)
  }

  const moveModule = (moduleId: string, direction: -1 | 1) => {
    const index = sorted.findIndex((m) => m.id === moduleId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= sorted.length) return
    const next = [...sorted]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setModules(next)
  }

  const updateModule = (module: LocalPrettyModule) => {
    setModules(sorted.map((m) => (m.id === module.id ? module : m)))
  }

  return (
    <Flex gap="4" style={{ height: '100%', minHeight: 0 }}>
      <Box
        style={{ width: 260, flexShrink: 0, minHeight: 0, overflowY: 'auto' }}
      >
        <Flex justify="between" align="center" mb="2">
          <Text size="2" weight="bold">
            Modules
          </Text>
          {!readOnly && (
            <Button size="1" onClick={addModule}>
              <Plus width={14} height={14} />
              Add
            </Button>
          )}
        </Flex>
        <Flex direction="column" gap="1">
          {sorted.map((module, index) => (
            <Flex
              key={module.id}
              align="start"
              gap="1"
              p="2"
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                background:
                  selected?.id === module.id
                    ? 'var(--accent-a3)'
                    : 'var(--gray-a2)',
              }}
              onClick={() => onSelectModule(module.id)}
            >
              <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                <Text size="2" weight="medium" truncate>
                  {module.title || 'Untitled module'}
                </Text>
                <Text size="1" color="gray" as="div">
                  {BASIS_TYPE_LABELS[module.basis_type]}
                </Text>
              </Flex>
              {!readOnly && (
                <Flex gap="0">
                  <IconButton
                    size="1"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveModule(module.id, -1)
                    }}
                  >
                    <NavArrowUp width={14} height={14} />
                  </IconButton>
                  <IconButton
                    size="1"
                    variant="ghost"
                    disabled={index === sorted.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveModule(module.id, 1)
                    }}
                  >
                    <NavArrowDown width={14} height={14} />
                  </IconButton>
                  <IconButton
                    size="1"
                    variant="ghost"
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeModule(module.id)
                    }}
                  >
                    <Trash width={14} height={14} />
                  </IconButton>
                </Flex>
              )}
            </Flex>
          ))}
          {sorted.length === 0 && (
            <Text size="2" color="gray">
              Add modules like Audio, Lights, or Rigging.
            </Text>
          )}
        </Flex>
      </Box>

      <Box style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
        {selected ? (
          <ModuleEditor
            module={selected}
            jobId={jobId}
            companyId={companyId}
            offerId={offerId}
            readOnly={readOnly}
            onChange={updateModule}
          />
        ) : (
          <Text size="2" color="gray">
            Select or add a module to edit.
          </Text>
        )}
      </Box>
    </Flex>
  )
}
