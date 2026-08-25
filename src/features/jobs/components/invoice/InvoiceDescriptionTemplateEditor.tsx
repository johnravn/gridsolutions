// src/features/jobs/components/invoice/InvoiceDescriptionTemplateEditor.tsx
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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes'
import { DotsGrid3x3, Plus, Xmark } from 'iconoir-react'
import { DropdownMenuTrigger } from '@shared/ui/radixAsChild'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  applyTemplatesToLines,
  buildInvoiceLineDescription,
  countChangedDescriptions,
  countLinesByScope,
  getLinesAffectedByScope,
  loadInvoiceLineTemplates,
  saveInvoiceLineTemplates,
} from '../../utils/invoiceLineDescription'
import type {
  DescriptionTemplate,
  DescriptionToken,
  InvoiceLineDescriptionScope,
  InvoiceLineTemplateStore,
} from '../../utils/invoiceLineDescription'
import type { DragEndEvent } from '@dnd-kit/core'
import type { BookingInvoiceLine } from '../../api/invoiceQueries'

/** Above Radix Dialog overlay when used inside invoice preview modals */
const OVERLAY_Z_INDEX = 10000

const TOKEN_OPTIONS: Array<{ value: DescriptionToken['kind']; label: string }> =
  [
    { value: 'custom', label: 'Custom' },
    { value: 'job', label: 'Job' },
    { value: 'date', label: 'Date' },
    { value: 'crew', label: 'Crew' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'transport', label: 'Transport' },
    { value: 'timePeriod', label: 'Time period' },
    { value: 'type', label: 'Type' },
  ]

const SCOPE_OPTIONS: Array<{
  value: InvoiceLineDescriptionScope
  label: string
}> = [
  { value: 'all', label: 'All lines' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'crew', label: 'Crew' },
  { value: 'transport', label: 'Transport' },
]

type DraftTokenEntry = {
  id: string
  token: DescriptionToken
}

function emptyTemplate(): DescriptionTemplate {
  return { tokens: [{ kind: 'equipment' }] }
}

function templateToEntries(
  template: DescriptionTemplate,
): Array<DraftTokenEntry> {
  return template.tokens.map((token) => ({
    id: crypto.randomUUID(),
    token,
  }))
}

function entriesToTemplate(
  entries: Array<DraftTokenEntry>,
): DescriptionTemplate {
  return { tokens: entries.map((entry) => entry.token) }
}

function tokenLabel(token: DescriptionToken): string {
  if (token.kind === 'custom') {
    const t = token.text.trim()
    return t ? `"${t}"` : 'Custom'
  }
  return TOKEN_OPTIONS.find((o) => o.value === token.kind)?.label ?? token.kind
}

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  borderRadius: 'var(--radius-2)',
  fontSize: 'var(--font-size-1)',
  fontWeight: 500,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  border: '1px solid transparent',
}

function scopeChipStyle(active: boolean): React.CSSProperties {
  return {
    ...chipBase,
    padding: '4px 10px',
    background: active ? 'var(--accent-9)' : 'var(--gray-a3)',
    color: active ? 'white' : 'var(--gray-11)',
    borderColor: active ? 'var(--accent-9)' : 'var(--gray-a6)',
  }
}

function tokenChipStyle(): React.CSSProperties {
  return {
    ...chipBase,
    padding: '4px 8px',
    background: 'var(--indigo-a3)',
    color: 'var(--indigo-11)',
    borderColor: 'var(--indigo-a6)',
  }
}

function addChipStyle(): React.CSSProperties {
  return {
    ...chipBase,
    padding: '4px 8px',
    background: 'transparent',
    color: 'var(--gray-11)',
    border: '1px dashed var(--gray-a7)',
  }
}

function SortableTokenRow({
  id,
  token,
  onUpdateKind,
  onUpdateCustomText,
  onRemove,
}: {
  id: string
  token: DescriptionToken
  onUpdateKind: (kind: DescriptionToken['kind']) => void
  onUpdateCustomText: (text: string) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <Flex ref={setNodeRef} role="listitem" align="center" gap="1" style={style}>
      <IconButton
        ref={setActivatorNodeRef as React.Ref<HTMLButtonElement>}
        size="1"
        variant="ghost"
        color="gray"
        style={{ cursor: 'grab' }}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <DotsGrid3x3 width={14} height={14} />
      </IconButton>

      <DropdownMenu.Root>
        <DropdownMenuTrigger asChild>
          <button type="button" style={tokenChipStyle()}>
            {tokenLabel(token)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenu.Content style={{ zIndex: OVERLAY_Z_INDEX }}>
          {TOKEN_OPTIONS.map((opt) => (
            <DropdownMenu.Item
              key={opt.value}
              onSelect={() => onUpdateKind(opt.value)}
            >
              {opt.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {token.kind === 'custom' && (
        <TextField.Root
          size="1"
          value={token.text}
          placeholder="Text…"
          onChange={(e) => onUpdateCustomText(e.target.value)}
          style={{ width: 88, minWidth: 72 }}
        />
      )}

      <IconButton
        size="1"
        variant="ghost"
        color="gray"
        aria-label="Remove token"
        onClick={onRemove}
      >
        <Xmark width={12} height={12} />
      </IconButton>
    </Flex>
  )
}

type Props = {
  companyId: string
  lines: Array<BookingInvoiceLine>
  manualOverrides: Set<string>
  onApply: (lines: Array<BookingInvoiceLine>) => void
  /** When set, called whenever highlight mode or affected line set changes. */
  onHighlightChange?: (lineIds: ReadonlySet<string>) => void
}

export default function InvoiceDescriptionTemplateEditor({
  companyId,
  lines,
  manualOverrides,
  onApply,
  onHighlightChange,
}: Props) {
  const { success, info } = useToast()
  const [scope, setScope] = React.useState<InvoiceLineDescriptionScope>('all')
  const [highlightEnabled, setHighlightEnabled] = React.useState(false)
  const [store, setStore] = React.useState<InvoiceLineTemplateStore>(() =>
    loadInvoiceLineTemplates(companyId),
  )
  const [draftEntries, setDraftEntries] = React.useState<
    Array<DraftTokenEntry>
  >(() => {
    const loaded = loadInvoiceLineTemplates(companyId)
    return templateToEntries(loaded.all ?? emptyTemplate())
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  React.useEffect(() => {
    const loaded = loadInvoiceLineTemplates(companyId)
    setStore(loaded)
    setDraftEntries(templateToEntries(loaded.all ?? emptyTemplate()))
  }, [companyId])

  React.useEffect(() => {
    const template = scope === 'all' ? store.all : store[scope]
    setDraftEntries(templateToEntries(template ?? emptyTemplate()))
  }, [scope, store])

  const draft = React.useMemo(
    () => entriesToTemplate(draftEntries),
    [draftEntries],
  )

  const scopeCounts = React.useMemo(
    () => countLinesByScope(lines, manualOverrides),
    [lines, manualOverrides],
  )

  const affectedLines = React.useMemo(
    () => getLinesAffectedByScope(lines, manualOverrides, scope),
    [lines, manualOverrides, scope],
  )

  const affectedIds = React.useMemo(
    () => new Set(affectedLines.map((line) => line.id)),
    [affectedLines],
  )

  const onHighlightChangeRef = React.useRef(onHighlightChange)
  onHighlightChangeRef.current = onHighlightChange

  React.useEffect(() => {
    onHighlightChangeRef.current?.(highlightEnabled ? affectedIds : new Set())
  }, [highlightEnabled, affectedIds])

  const livePreviewText = React.useMemo(() => {
    const sampleLine =
      lines.find((l) => (scope === 'all' ? true : l.type === scope)) ?? lines[0]
    if (!sampleLine) return null
    return buildInvoiceLineDescription(sampleLine, draft)
  }, [draft, lines, scope])

  const updateToken = (id: string, kind: DescriptionToken['kind']) => {
    setDraftEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              token:
                kind === 'custom' ? { kind: 'custom', text: '' } : { kind },
            }
          : entry,
      ),
    )
  }

  const updateCustomText = (id: string, text: string) => {
    setDraftEntries((prev) =>
      prev.map((entry) =>
        entry.id === id && entry.token.kind === 'custom'
          ? { ...entry, token: { kind: 'custom', text } }
          : entry,
      ),
    )
  }

  const addToken = (kind: DescriptionToken['kind']) => {
    setDraftEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        token: kind === 'custom' ? { kind: 'custom', text: '' } : { kind },
      },
    ])
  }

  const removeToken = (id: string) => {
    setDraftEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setDraftEntries((prev) => {
      const oldIndex = prev.findIndex((entry) => entry.id === active.id)
      const newIndex = prev.findIndex((entry) => entry.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const handleApply = () => {
    const nextStore: InvoiceLineTemplateStore = { ...store }
    if (scope === 'all') {
      nextStore.all = draft
    } else {
      nextStore[scope] = draft
    }
    setStore(nextStore)
    saveInvoiceLineTemplates(companyId, nextStore)
    const updated = applyTemplatesToLines(
      lines,
      nextStore,
      manualOverrides,
      scope,
    )
    const changedCount = countChangedDescriptions(lines, updated)
    onApply(updated)
    setHighlightEnabled(true)
    if (changedCount === 0) {
      info(
        'No lines updated',
        affectedLines.length === 0
          ? 'No lines match this scope (or all are manually edited).'
          : 'Descriptions already match this pattern.',
      )
    } else {
      success(
        'Pattern applied',
        changedCount === 1
          ? '1 invoice line was updated.'
          : `${changedCount} invoice lines were updated.`,
      )
    }
  }

  return (
    <Box
      mb="4"
      p="3"
      style={{
        borderRadius: 8,
        border: '1px solid var(--gray-a6)',
        background: 'var(--gray-a2)',
      }}
    >
      <Text size="2" weight="medium" mb="2" as="p">
        Line description pattern
      </Text>

      <Flex
        gap="1"
        wrap="wrap"
        mb="3"
        align="center"
        role="group"
        aria-label="Apply to"
      >
        {SCOPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={scope === opt.value}
            style={scopeChipStyle(scope === opt.value)}
            onClick={() => setScope(opt.value)}
          >
            {opt.label}
            <span
              style={{
                marginLeft: 4,
                opacity: 0.85,
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 700,
              }}
            >
              {scopeCounts[opt.value]}
            </span>
          </button>
        ))}
      </Flex>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={draftEntries.map((entry) => entry.id)}
          strategy={horizontalListSortingStrategy}
        >
          <Flex
            gap="2"
            wrap="wrap"
            align="center"
            mb="3"
            role="list"
            aria-label="Description tokens"
          >
            {draftEntries.map((entry) => (
              <SortableTokenRow
                key={entry.id}
                id={entry.id}
                token={entry.token}
                onUpdateKind={(kind) => updateToken(entry.id, kind)}
                onUpdateCustomText={(text) => updateCustomText(entry.id, text)}
                onRemove={() => removeToken(entry.id)}
              />
            ))}

            <DropdownMenu.Root>
              <DropdownMenuTrigger asChild>
                <button type="button" style={addChipStyle()}>
                  <Plus width={12} height={12} />
                  Add
                </button>
              </DropdownMenuTrigger>
              <DropdownMenu.Content style={{ zIndex: OVERLAY_Z_INDEX }}>
                {TOKEN_OPTIONS.map((opt) => (
                  <DropdownMenu.Item
                    key={opt.value}
                    onSelect={() => addToken(opt.value)}
                  >
                    {opt.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
        </SortableContext>
      </DndContext>

      <Box
        mb="3"
        p="2"
        style={{
          borderRadius: 6,
          background: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-a5)',
        }}
      >
        <Text size="1" color="gray" as="p" mb="1">
          Live preview
        </Text>
        <Text
          size="2"
          weight="medium"
          as="p"
          style={{ wordBreak: 'break-word' }}
        >
          {livePreviewText || '—'}
        </Text>
      </Box>

      <Flex gap="2" align="center" wrap="wrap" mb="2">
        <Button size="1" variant="solid" onClick={handleApply}>
          Apply pattern
          {affectedLines.length > 0 ? ` (${affectedLines.length})` : ''}
        </Button>
        {onHighlightChange && (
          <Button
            size="1"
            variant={highlightEnabled ? 'soft' : 'outline'}
            color={highlightEnabled ? 'amber' : 'gray'}
            onClick={() => setHighlightEnabled((prev) => !prev)}
          >
            {highlightEnabled ? 'Hide highlights' : 'Highlight lines'}
          </Button>
        )}
      </Flex>

      <Text size="1" color="gray" as="p">
        Preview updates as you edit. Apply writes the pattern to the invoice
        lines below. Manually edited lines are kept.
      </Text>
    </Box>
  )
}

export { type Props as InvoiceDescriptionTemplateEditorProps }

/** Call when user edits a line description manually */
export function trackManualDescriptionEdit(
  set: Set<string>,
  lineId: string,
): Set<string> {
  const next = new Set(set)
  next.add(lineId)
  return next
}
