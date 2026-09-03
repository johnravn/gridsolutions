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
  COMMON_TOKEN_OPTIONS,
  applyTemplatesToLines,
  buildInvoiceLineDescription,
  countChangedDescriptions,
  countLinesByScope,
  defaultTemplateForScope,
  getLinesAffectedByScope,
  loadInvoiceLineTemplates,
  saveInvoiceLineTemplates,
  tokenLabel,
  tokenOptionsForScope,
} from '../../utils/invoiceLineDescription'
import type {
  DescriptionTemplate,
  DescriptionToken,
  DescriptionTokenKind,
  InvoiceLineDescriptionScope,
  InvoiceLineTemplateStore,
  TokenOption,
} from '../../utils/invoiceLineDescription'
import type { DragEndEvent } from '@dnd-kit/core'
import type { BookingInvoiceLine } from '../../api/invoiceQueries'

/** Above Radix Dialog overlay when used inside invoice preview modals */
const OVERLAY_Z_INDEX = 10000
export const INVOICE_LINE_HIGHLIGHT_HOLD_MS = 5000

const SCOPE_OPTIONS: Array<{
  value: InvoiceLineDescriptionScope
  label: string
}> = [
  { value: 'other', label: 'Other' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'crew', label: 'Crew' },
  { value: 'transport', label: 'Transport' },
]

type DraftTokenEntry = {
  id: string
  token: DescriptionToken
}

function emptyTemplate(
  scope: InvoiceLineDescriptionScope,
): DescriptionTemplate {
  return defaultTemplateForScope(scope)
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
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 4px 2px 8px',
    borderRadius: 'var(--radius-2)',
    fontSize: 'var(--font-size-1)',
    fontWeight: 500,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    background: 'var(--indigo-a3)',
    color: 'var(--indigo-11)',
    border: '1px solid var(--indigo-a6)',
  }
}

const tokenChipLabelStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '2px 0',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 500,
  cursor: 'pointer',
  lineHeight: 1.2,
}

const tokenChipRemoveStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  padding: 0,
  border: 'none',
  borderRadius: 'var(--radius-1)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  opacity: 0.7,
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

function TokenKindMenuItems({
  options,
  onSelect,
}: {
  options: Array<TokenOption>
  onSelect: (kind: DescriptionTokenKind) => void
}) {
  const specificValues = new Set(
    options
      .filter(
        (opt) =>
          !COMMON_TOKEN_OPTIONS.some((common) => common.value === opt.value),
      )
      .map((opt) => opt.value),
  )
  const specific = options.filter((opt) => specificValues.has(opt.value))
  const common = options.filter((opt) => !specificValues.has(opt.value))

  return (
    <>
      {specific.map((opt) => (
        <DropdownMenu.Item key={opt.value} onSelect={() => onSelect(opt.value)}>
          {opt.label}
        </DropdownMenu.Item>
      ))}
      {specific.length > 0 && common.length > 0 ? (
        <DropdownMenu.Separator />
      ) : null}
      {common.map((opt) => (
        <DropdownMenu.Item key={opt.value} onSelect={() => onSelect(opt.value)}>
          {opt.label}
        </DropdownMenu.Item>
      ))}
    </>
  )
}

function SortableTokenRow({
  id,
  token,
  tokenOptions,
  onUpdateKind,
  onUpdateCustomText,
  onRemove,
}: {
  id: string
  token: DescriptionToken
  tokenOptions: Array<TokenOption>
  onUpdateKind: (kind: DescriptionTokenKind) => void
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

      <div style={tokenChipStyle()}>
        <DropdownMenu.Root>
          <DropdownMenuTrigger asChild>
            <button type="button" style={tokenChipLabelStyle}>
              {tokenLabel(token)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenu.Content style={{ zIndex: OVERLAY_Z_INDEX }}>
            <TokenKindMenuItems
              options={tokenOptions}
              onSelect={onUpdateKind}
            />
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

        <button
          type="button"
          aria-label="Remove token"
          style={tokenChipRemoveStyle}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <Xmark width={12} height={12} />
        </button>
      </div>
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
  /** Hide the built-in heading and outer panel chrome (e.g. inside a settings card). */
  embedded?: boolean
}

export default function InvoiceDescriptionTemplateEditor({
  companyId,
  lines,
  manualOverrides,
  onApply,
  onHighlightChange,
  embedded = false,
}: Props) {
  const { success, info } = useToast()
  const [scope, setScope] = React.useState<InvoiceLineDescriptionScope>('other')
  const [highlightEnabled, setHighlightEnabled] = React.useState(false)
  const [highlightPulse, setHighlightPulse] = React.useState(0)
  const [highlightSecondsLeft, setHighlightSecondsLeft] = React.useState(0)
  const highlightExpiresAtRef = React.useRef<number | null>(null)
  const [store, setStore] = React.useState<InvoiceLineTemplateStore>(() =>
    loadInvoiceLineTemplates(companyId),
  )
  const [draftEntries, setDraftEntries] = React.useState<
    Array<DraftTokenEntry>
  >(() => {
    const loaded = loadInvoiceLineTemplates(companyId)
    return templateToEntries(loaded.other ?? emptyTemplate('other'))
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
    setDraftEntries(templateToEntries(loaded.other ?? emptyTemplate('other')))
  }, [companyId])

  React.useEffect(() => {
    const template = store[scope]
    setDraftEntries(templateToEntries(template ?? emptyTemplate(scope)))
  }, [scope, store])

  const draft = React.useMemo(
    () => entriesToTemplate(draftEntries),
    [draftEntries],
  )

  const tokenOptions = React.useMemo(() => tokenOptionsForScope(scope), [scope])

  const scopeCounts = React.useMemo(
    () => countLinesByScope(lines, manualOverrides, store),
    [lines, manualOverrides, store],
  )

  const affectedLines = React.useMemo(
    () => getLinesAffectedByScope(lines, manualOverrides, scope, store),
    [lines, manualOverrides, scope, store],
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

  React.useEffect(() => {
    if (!highlightEnabled) {
      setHighlightSecondsLeft(0)
      highlightExpiresAtRef.current = null
      return
    }
    const tick = () => {
      const expiresAt = highlightExpiresAtRef.current
      if (expiresAt == null) return
      const secondsLeft = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000),
      )
      setHighlightSecondsLeft(secondsLeft)
    }
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [highlightEnabled, highlightPulse])

  React.useEffect(() => {
    if (!highlightEnabled) return
    const timer = window.setTimeout(() => {
      setHighlightEnabled(false)
    }, INVOICE_LINE_HIGHLIGHT_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [highlightEnabled, highlightPulse])

  const enableHighlights = () => {
    highlightExpiresAtRef.current = Date.now() + INVOICE_LINE_HIGHLIGHT_HOLD_MS
    setHighlightEnabled(true)
    setHighlightPulse((n) => n + 1)
  }

  const livePreviewText = React.useMemo(() => {
    const sampleLine = affectedLines[0] ?? lines[0]
    if (!sampleLine) return null
    return buildInvoiceLineDescription(sampleLine, draft)
  }, [affectedLines, draft, lines])

  const updateToken = (id: string, kind: DescriptionTokenKind) => {
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

  const addToken = (kind: DescriptionTokenKind) => {
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
    const nextStore: InvoiceLineTemplateStore = { ...store, [scope]: draft }
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
    enableHighlights()
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
      mb={embedded ? '0' : '4'}
      p={embedded ? '0' : '3'}
      pt={embedded ? '2' : '3'}
      style={
        embedded
          ? undefined
          : {
              borderRadius: 8,
              border: '1px solid var(--gray-a6)',
              background: 'var(--gray-a2)',
            }
      }
    >
      {!embedded && (
        <Text size="2" weight="medium" mb="2" as="p">
          Line description pattern
        </Text>
      )}

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
                tokenOptions={tokenOptions}
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
                <TokenKindMenuItems
                  options={tokenOptions}
                  onSelect={addToken}
                />
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
            onClick={() => {
              if (highlightEnabled) setHighlightEnabled(false)
              else enableHighlights()
            }}
          >
            {highlightEnabled
              ? `Hide highlights (${highlightSecondsLeft}s)`
              : 'Highlight lines'}
          </Button>
        )}
      </Flex>

      <Text size="1" color="gray" as="p">
        Preview updates as you edit. Equipment, crew, and transport patterns
        apply to those booking types; Other is the fallback. Manually edited
        lines are kept.
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
