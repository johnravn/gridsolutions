import * as React from 'react'
import {
  Box,
  Checkbox,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes'
import { useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { Filter } from 'iconoir-react'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useRegisterShortcutAction } from '@shared/hotkeys'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import ScrollToTopButton from '@shared/ui/components/ScrollToTopButton'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import { SPLIT_LEFT_WIDTH, SplitPage, SplitPageSkeleton, useSplitLayout } from '@app/layout/split'
import InventoryTable from '../components/InventoryTable'
import InventoryInspector from '../components/InventoryInspector'
import { inventoryIndexQuery } from '../api/queries'
import { INVENTORY_INDEX_DEFAULTS } from '../inventoryIndexDefaults'

export default function InventoryPage() {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const { isLarge, hasSlots } = useSplitLayout()
  const createInventoryItemShortcutRef = React.useRef<(() => void) | null>(null)
  useRegisterShortcutAction(
    'create.inventoryItem',
    () => createInventoryItemShortcutRef.current?.(),
    canWrite,
  )
  const location = useLocation()
  const search = location.search as { inventoryId?: string }
  const inventoryId = search.inventoryId

  const [selectedId, setSelectedId] = React.useState<string | null>(
    inventoryId || null,
  )

  React.useEffect(() => {
    if (inventoryId) {
      setSelectedId(inventoryId)
    }
  }, [inventoryId])

  const [showActive, setShowActive] = React.useState(true)
  const [showInactive, setShowInactive] = React.useState(false)
  const [showStock, setShowStock] = React.useState(true)
  const [showSubrental, setShowSubrental] = React.useState(true)
  const [showGroupOnlyItems, setShowGroupOnlyItems] = React.useState(false)
  const [showGroups, setShowGroups] = React.useState(true)
  const [showItems, setShowItems] = React.useState(true)

  const inspectorRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    if (!isLarge && selectedId != null && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [isLarge, selectedId])

  const clearSelection = React.useCallback(() => {
    setSelectedId(null)
  }, [])

  useMobileDetailBack(!isLarge, selectedId != null, clearSelection)

  const { isLoading: inventoryIndexLoading } = useQuery({
    ...inventoryIndexQuery({
      companyId: companyId ?? '__none__',
      ...INVENTORY_INDEX_DEFAULTS,
    }),
    enabled: !!companyId,
  })
  const showInitialSkeleton = useInitialPageLoad(inventoryIndexLoading)

  if (!companyId || (showInitialSkeleton && !hasSlots)) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.inventory}
        title="Overview"
      />
    )
  }

  const filter = (
    <InventoryFilter
      showActive={showActive}
      showInactive={showInactive}
      showStock={showStock}
      showSubrental={showSubrental}
      showGroupOnlyItems={showGroupOnlyItems}
      showGroups={showGroups}
      showItems={showItems}
      onShowActiveChange={setShowActive}
      onShowInactiveChange={setShowInactive}
      onShowStockChange={setShowStock}
      onShowSubrentalChange={setShowSubrental}
      onShowGroupOnlyItemsChange={setShowGroupOnlyItems}
      onShowGroupsChange={setShowGroups}
      onShowItemsChange={setShowItems}
    />
  )

  const table = (
    <InventoryTable
      createShortcutRef={createInventoryItemShortcutRef}
      selectedId={selectedId}
      onSelect={setSelectedId}
      showActive={showActive}
      showInactive={showInactive}
      showStock={showStock}
      showSubrental={showSubrental}
      showGroupOnlyItems={showGroupOnlyItems}
      showGroups={showGroups}
      showItems={showItems}
    />
  )

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.inventory}
      title="Overview"
      leftToolbar={filter}
      mobileLeftToolbar={null}
      left={table}
      leftBodyStyle={{ overflowY: 'auto' }}
      right={<InventoryInspector id={selectedId} />}
      mobileLeftCardStyle={{ height: MOBILE_CARD_HEIGHT, minWidth: 0 }}
      mobileLeftBodyStyle={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      mobileRightCardStyle={{
        height: MOBILE_CARD_HEIGHT,
        overflow: 'hidden',
        maxWidth: '100%',
      }}
      mobileSectionRef={listRef}
      mobileRightWrapper={(card) => (
        <div
          ref={inspectorRef}
          style={{
            minHeight: 0,
            maxWidth: '100%',
            width: '100%',
            height: MOBILE_CARD_HEIGHT,
          }}
        >
          {card}
        </div>
      )}
      mobileFooter={
        <ScrollToTopButton
          listRef={listRef}
          inspectorRef={inspectorRef}
          visible={!isLarge && selectedId != null}
        />
      }
    />
  )
}

function InventoryFilter({
  showActive,
  showInactive,
  showStock,
  showSubrental,
  showGroupOnlyItems,
  showGroups,
  showItems,
  onShowActiveChange,
  onShowInactiveChange,
  onShowStockChange,
  onShowSubrentalChange,
  onShowGroupOnlyItemsChange,
  onShowGroupsChange,
  onShowItemsChange,
}: {
  showActive: boolean
  showInactive: boolean
  showStock: boolean
  showSubrental: boolean
  showGroupOnlyItems: boolean
  showGroups: boolean
  showItems: boolean
  onShowActiveChange: (v: boolean) => void
  onShowInactiveChange: (v: boolean) => void
  onShowStockChange: (v: boolean) => void
  onShowSubrentalChange: (v: boolean) => void
  onShowGroupOnlyItemsChange: (v: boolean) => void
  onShowGroupsChange: (v: boolean) => void
  onShowItemsChange: (v: boolean) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedCount = [
    showActive,
    showInactive,
    showStock,
    showSubrental,
    showGroupOnlyItems,
    showGroups,
    showItems,
  ].filter(Boolean).length
  const activeFiltersCount = selectedCount < 7 ? selectedCount : 0

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger>
        <Box style={{ position: 'relative', display: 'inline-block' }}>
          <IconButton variant="soft" size="2">
            <Filter width={16} height={16} />
          </IconButton>
          {activeFiltersCount > 0 && (
            <Box
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-9)',
                color: 'white',
                fontSize: 'var(--font-size-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeFiltersCount}
            </Box>
          )}
        </Box>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>Status</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowActiveChange(!showActive)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showActive}
              onCheckedChange={onShowActiveChange}
            />
            <Text>Active</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowInactiveChange(!showInactive)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showInactive}
              onCheckedChange={onShowInactiveChange}
            />
            <Text>Inactive</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Kind</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowStockChange(!showStock)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showStock} onCheckedChange={onShowStockChange} />
            <Text>Stock</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowSubrentalChange(!showSubrental)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showSubrental}
              onCheckedChange={onShowSubrentalChange}
            />
            <Text>Subrental</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Type</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowGroupOnlyItemsChange(!showGroupOnlyItems)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showGroupOnlyItems}
              onCheckedChange={onShowGroupOnlyItemsChange}
            />
            <Text>Group-only items</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowGroupsChange(!showGroups)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showGroups}
              onCheckedChange={onShowGroupsChange}
            />
            <Text>Groups</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowItemsChange(!showItems)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showItems} onCheckedChange={onShowItemsChange} />
            <Text>Items</Text>
          </Flex>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
