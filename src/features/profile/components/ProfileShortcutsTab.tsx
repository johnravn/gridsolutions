import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Dialog,
  Flex,
  Heading,
  Kbd,
  Text,
} from '@radix-ui/themes'
import { formatForDisplay, useHotkeyRecorder } from '@tanstack/react-hotkeys'
import { NavArrowDown, NavArrowRight, WarningTriangle } from 'iconoir-react'
import {
  SHORTCUT_BY_ID,
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_REGISTRY,
  findShortcutConflict,
  isShortcutBound,
} from '@shared/hotkeys/shortcutRegistry'
import { useShortcutPreferences } from '@shared/hotkeys/ShortcutPreferencesProvider'
import { getSystemShortcutWarning } from '@shared/hotkeys/systemShortcutWarnings'
import type {
  ShortcutCategory,
  ShortcutDefinition,
  ShortcutId,
} from '@shared/hotkeys/shortcutRegistry'

const CATEGORY_ORDER: Array<ShortcutCategory> = [
  'navigation',
  'panels',
  'create',
]

function HotkeyKbds({ hotkey }: { hotkey: string }) {
  const parts = formatForDisplay(hotkey).split(/\s+/).filter(Boolean)
  return (
    <Flex gap="2" align="center" wrap="wrap">
      {parts.map((part, index) => (
        <Kbd key={`${part}-${index}`} size="3">
          {part}
        </Kbd>
      ))}
    </Flex>
  )
}

function ShortcutRow({
  item,
  hotkey,
  isCustom,
  busy,
  recording,
  onRecord,
  onReset,
}: {
  item: ShortcutDefinition
  hotkey: string | null
  isCustom: boolean
  busy: boolean
  recording: boolean
  onRecord: () => void
  onReset: () => void
}) {
  const isBound = isShortcutBound(hotkey)
  const resetLabel = SHORTCUT_BY_ID[item.id].defaultHotkey ? 'Reset' : 'Clear'

  return (
    <Flex
      align="center"
      justify="between"
      gap="4"
      py="3"
      style={{
        borderBottom: '1px solid var(--gray-a4)',
      }}
    >
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Text size="2" weight="medium">
          {item.label}
        </Text>
        <Text size="1" color="gray" as="div">
          {item.description}
        </Text>
      </Box>
      <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
        <Button
          size="2"
          variant={isBound ? 'ghost' : 'soft'}
          color="gray"
          disabled={busy || recording}
          onClick={onRecord}
          title={isBound ? 'Click to rebind' : 'Click to add'}
        >
          {isBound ? <HotkeyKbds hotkey={hotkey} /> : 'Add'}
        </Button>
        {isCustom ? (
          <Button
            size="1"
            variant="ghost"
            color="gray"
            disabled={busy}
            onClick={onReset}
          >
            {resetLabel}
          </Button>
        ) : null}
      </Flex>
    </Flex>
  )
}

function groupByCategory(
  items: ReadonlyArray<ShortcutDefinition>,
): Array<{ category: ShortcutCategory; items: Array<ShortcutDefinition> }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((s) => s.category === category),
  })).filter((group) => group.items.length > 0)
}

export default function ProfileShortcutsTab() {
  const {
    resolved,
    overrides,
    isLoading,
    setOverride,
    resetOverride,
    resetAll,
  } = useShortcutPreferences()

  const [recordingId, setRecordingId] = React.useState<ShortcutId | null>(null)
  const [conflictId, setConflictId] = React.useState<ShortcutId | null>(null)
  const [pendingHotkey, setPendingHotkey] = React.useState<string | null>(null)
  const [systemWarning, setSystemWarning] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [unassignedOpen, setUnassignedOpen] = React.useState(false)

  const recordingIdRef = React.useRef(recordingId)
  recordingIdRef.current = recordingId

  const closeRecorder = React.useCallback(() => {
    setRecordingId(null)
    setConflictId(null)
    setPendingHotkey(null)
    setSystemWarning(null)
  }, [])

  const saveHotkey = React.useCallback(
    async (id: ShortcutId, hotkey: string) => {
      setBusy(true)
      try {
        await setOverride(id, hotkey)
        closeRecorder()
      } finally {
        setBusy(false)
      }
    },
    [closeRecorder, setOverride],
  )

  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      const id = recordingIdRef.current
      if (!id) return
      if (!hotkey.trim()) return

      const conflict = findShortcutConflict(resolved, id, hotkey)
      if (conflict) {
        setConflictId(conflict)
        setPendingHotkey(null)
        setSystemWarning(null)
        queueMicrotask(() => recorder.startRecording())
        return
      }

      const warning = getSystemShortcutWarning(hotkey)
      if (warning) {
        setConflictId(null)
        setPendingHotkey(hotkey)
        setSystemWarning(warning.reason)
        return
      }

      void saveHotkey(id, hotkey)
    },
    onCancel: () => {
      closeRecorder()
    },
  })

  React.useEffect(() => {
    if (recordingId && !pendingHotkey) {
      recorder.startRecording()
      return () => {
        recorder.stopRecording()
      }
    }
    recorder.stopRecording()
  }, [recordingId, pendingHotkey]) // recorder methods are stable enough

  const { assigned, unassigned } = React.useMemo(() => {
    const assignedItems: Array<ShortcutDefinition> = []
    const unassignedItems: Array<ShortcutDefinition> = []
    for (const item of SHORTCUT_REGISTRY) {
      if (isShortcutBound(resolved[item.id])) {
        assignedItems.push(item)
      } else {
        unassignedItems.push(item)
      }
    }
    return { assigned: assignedItems, unassigned: unassignedItems }
  }, [resolved])

  const assignedGroups = React.useMemo(
    () => groupByCategory(assigned),
    [assigned],
  )
  const unassignedGroups = React.useMemo(
    () => groupByCategory(unassigned),
    [unassigned],
  )

  const recordingLabel = recordingId
    ? SHORTCUT_REGISTRY.find((s) => s.id === recordingId)?.label
    : null

  const previewHotkey =
    pendingHotkey ??
    (typeof recorder.recordedHotkey === 'string'
      ? recorder.recordedHotkey
      : null)

  const renderRow = (item: ShortcutDefinition) => {
    const hotkey = resolved[item.id]
    return (
      <ShortcutRow
        key={item.id}
        item={item}
        hotkey={hotkey}
        isCustom={overrides[item.id] != null}
        busy={busy}
        recording={recordingId != null}
        onRecord={() => {
          setConflictId(null)
          setPendingHotkey(null)
          setSystemWarning(null)
          setRecordingId(item.id)
        }}
        onReset={() => {
          setBusy(true)
          void resetOverride(item.id).finally(() => setBusy(false))
        }}
      />
    )
  }

  return (
    <Card
      size="4"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        p="4"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <Flex direction="column" gap="5">
          <Flex justify="between" align="start" gap="3" wrap="wrap">
            <Box style={{ maxWidth: 520 }}>
              <Heading size="4">Keyboard shortcuts</Heading>
              <Text size="2" color="gray">
                Core navigation is ready to use. Expand unassigned shortcuts
                below to add your own. Click a binding to change it.
              </Text>
            </Box>
            <Button
              variant="soft"
              color="gray"
              disabled={busy || Object.keys(overrides).length === 0}
              onClick={() => {
                setBusy(true)
                void resetAll().finally(() => setBusy(false))
              }}
            >
              Reset all
            </Button>
          </Flex>

          {isLoading ? (
            <Text size="2" color="gray">
              Loading shortcuts…
            </Text>
          ) : null}

          {assignedGroups.map(({ category, items }) => (
            <Box key={category}>
              <Heading size="2" mb="1" color="gray">
                {SHORTCUT_CATEGORY_LABELS[category]}
              </Heading>
              <Box>{items.map(renderRow)}</Box>
            </Box>
          ))}

          {unassigned.length > 0 ? (
            <Box
              style={{
                borderRadius: 'var(--radius-3)',
                border: '1px solid var(--gray-a5)',
                overflow: 'hidden',
              }}
            >
              <Flex
                align="center"
                justify="between"
                gap="3"
                px="3"
                py="3"
                role="button"
                tabIndex={0}
                aria-expanded={unassignedOpen}
                onClick={() => setUnassignedOpen((open) => !open)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setUnassignedOpen((open) => !open)
                  }
                }}
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: 'var(--gray-a2)',
                }}
              >
                <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                  {unassignedOpen ? (
                    <NavArrowDown
                      width={16}
                      height={16}
                      color="var(--gray-11)"
                    />
                  ) : (
                    <NavArrowRight
                      width={16}
                      height={16}
                      color="var(--gray-11)"
                    />
                  )}
                  <Text size="2" weight="medium">
                    Unassigned shortcuts
                  </Text>
                  <Badge size="1" variant="soft" color="gray">
                    {unassigned.length}
                  </Badge>
                </Flex>
                <Text size="1" color="gray">
                  {unassignedOpen ? 'Hide' : 'Add your own'}
                </Text>
              </Flex>

              {unassignedOpen ? (
                <Box px="3" pb="2">
                  {unassignedGroups.map(({ category, items }) => (
                    <Box key={category} mt="3">
                      <Heading size="1" mb="1" color="gray">
                        {SHORTCUT_CATEGORY_LABELS[category]}
                      </Heading>
                      <Box>{items.map(renderRow)}</Box>
                    </Box>
                  ))}
                </Box>
              ) : null}
            </Box>
          ) : null}
        </Flex>
      </Box>

      <Dialog.Root
        open={recordingId != null}
        onOpenChange={(open) => {
          if (!open) closeRecorder()
        }}
      >
        <Dialog.Content
          maxWidth="440px"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title>Record shortcut</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            {recordingLabel
              ? `Choose a keyboard shortcut for “${recordingLabel}”.`
              : 'Choose a keyboard shortcut.'}
          </Dialog.Description>

          <Flex direction="column" gap="4">
            <Box
              p="4"
              style={{
                borderRadius: 'var(--radius-3)',
                background: 'var(--gray-a2)',
                border: '1px dashed var(--gray-a6)',
                textAlign: 'center',
              }}
            >
              {previewHotkey ? (
                <Flex direction="column" align="center" gap="2">
                  <Text size="2" color="gray">
                    {pendingHotkey ? 'Selected' : 'Captured'}
                  </Text>
                  <HotkeyKbds hotkey={previewHotkey} />
                </Flex>
              ) : (
                <Flex direction="column" align="center" gap="2">
                  <Text size="3" weight="medium">
                    Press the keys you want to use
                  </Text>
                  <Flex align="center" gap="2" justify="center" wrap="wrap">
                    <Text size="2" color="gray">
                      Press
                    </Text>
                    <Kbd size="3">Esc</Kbd>
                    <Text size="2" color="gray">
                      to cancel
                    </Text>
                  </Flex>
                </Flex>
              )}
            </Box>

            {conflictId ? (
              <Callout.Root color="red">
                <Callout.Icon>
                  <WarningTriangle width={16} height={16} />
                </Callout.Icon>
                <Callout.Text>
                  That combination is already used by{' '}
                  {SHORTCUT_REGISTRY.find((s) => s.id === conflictId)?.label}.
                  Try a different one.
                </Callout.Text>
              </Callout.Root>
            ) : null}

            {systemWarning && pendingHotkey ? (
              <Callout.Root color="amber">
                <Callout.Icon>
                  <WarningTriangle width={16} height={16} />
                </Callout.Icon>
                <Callout.Text>
                  <Text weight="medium">
                    Commonly used for {systemWarning}.
                  </Text>{' '}
                  Using it here can lead to unexpected behavior in the browser
                  or operating system.
                </Callout.Text>
              </Callout.Root>
            ) : null}

            <Flex gap="3" justify="end" wrap="wrap">
              <Dialog.Close>
                <Button variant="soft" color="gray" disabled={busy}>
                  Cancel
                </Button>
              </Dialog.Close>
              {pendingHotkey && recordingId ? (
                <>
                  <Button
                    variant="soft"
                    disabled={busy}
                    onClick={() => {
                      setPendingHotkey(null)
                      setSystemWarning(null)
                      setConflictId(null)
                    }}
                  >
                    Choose different
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      void saveHotkey(recordingId, pendingHotkey)
                    }}
                  >
                    {busy ? 'Saving…' : 'Use anyway'}
                  </Button>
                </>
              ) : null}
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Card>
  )
}
