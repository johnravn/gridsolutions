import * as React from 'react'
import { ArrowDown, ArrowUp } from 'iconoir-react'
import { Flex, Spinner, Text } from '@radix-ui/themes'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
  containerStyle,
  headerCellStyle,
  headerStyle,
  horizontalScrollInnerStyle,
  horizontalScrollOuterStyle,
  rowStyle,
  scrollBodyStyle,
  virtualSpacerStyle,
} from './indexTableStyles'
import { IndexTableBodySkeleton } from './IndexTableBodySkeleton'
import { useIndexTableSelectionKeyboard } from './useIndexTableSelectionKeyboard'
import type { FooterCount, SortDir, VirtualIndexTableProps } from './types'

function formatFooterCount(footerCount: FooterCount): string {
  if (typeof footerCount === 'number') {
    return String(footerCount)
  }
  const { shown, total, label } = footerCount
  if (total != null && total !== shown) {
    return `${shown} of ${total}`
  }
  if (label) return label(shown)
  return String(shown)
}

function isColumnSortable<TSort extends string>(
  col: VirtualIndexTableProps<unknown, TSort>['columns'][number],
  sortableColumns: Array<TSort> | undefined,
): boolean {
  if (col.sortable === false) return false
  if (col.sortable === true) return true
  if (!sortableColumns) return false
  const sortKey = (col.sortKey ?? col.id) as TSort
  return sortableColumns.includes(sortKey)
}

function SortIndicator({
  sortIndicator,
  isActive,
  sortDir,
}: {
  sortIndicator: 'arrow' | 'text'
  isActive: boolean
  sortDir: SortDir
}) {
  if (!isActive) return null
  if (sortIndicator === 'text') {
    return <>{sortDir === 'asc' ? ' ↑' : ' ↓'}</>
  }
  return sortDir === 'asc' ? (
    <ArrowUp width={12} height={12} />
  ) : (
    <ArrowDown width={12} height={12} />
  )
}

export function VirtualIndexTable<TRow, TSort extends string = string>({
  rows,
  columns,
  gridTemplateColumns,
  getRowId,
  renderCell,
  selectedId,
  onSelect,
  selectable = true,
  isRowSelectable,
  getRowClassName,
  getRowStyle,
  sortBy,
  sortDir,
  onSort,
  sortableColumns,
  sortIndicator = 'text',
  scrollRef,
  rowVirtualizer,
  isLoading = false,
  loadingPlacement = 'inline',
  loadingVariant = 'skeleton',
  emptyMessage = 'No results',
  footerCount,
  toolbar,
  horizontalScroll,
  scrollBodyStyle: scrollBodyStyleOverride,
  infinite,
  renderRowActions,
  actionsColumnWidth = 'auto',
}: VirtualIndexTableProps<TRow, TSort>) {
  const effectiveGridColumns = renderRowActions
    ? `${gridTemplateColumns} ${actionsColumnWidth}`
    : gridTemplateColumns

  const useHorizontalScroll =
    horizontalScroll ?? columns.length + (renderRowActions ? 1 : 0) > 3

  useIndexTableSelectionKeyboard({
    enabled: selectable && onSelect != null,
    selectedId,
    getIds: () => rows.map((row) => getRowId(row)),
    isIndexSelectable: isRowSelectable
      ? (index) => {
          const row = rows[index]
          return row != null && isRowSelectable(row)
        }
      : undefined,
    onSelect: onSelect ?? (() => {}),
    scrollToIndex: (index) => {
      rowVirtualizer.scrollToIndex(index, { align: 'auto' })
    },
  })

  const loadingBody =
    loadingVariant === 'spinner' ? (
      <Flex align="center" justify="center" py="6">
        <Spinner size="2" />
      </Flex>
    ) : (
      <IndexTableBodySkeleton gridTemplateColumns={effectiveGridColumns} />
    )

  const tableContent = (
    <>
      <div style={headerStyle(effectiveGridColumns)}>
        {columns.map((col) => {
          const sortKey = (col.sortKey ?? col.id) as TSort
          const canSort = isColumnSortable(col, sortableColumns)
          const isActive = sortBy != null && sortBy === sortKey

          return (
            <div
              key={col.id}
              onClick={() => {
                if (canSort && onSort) onSort(sortKey)
              }}
              style={headerCellStyle(col.align, canSort)}
              title={canSort ? 'Click to sort' : undefined}
            >
              {canSort && sortIndicator === 'arrow' ? (
                <Flex align="center" gap="1">
                  {col.header}
                  {sortBy != null && sortDir != null && (
                    <SortIndicator
                      sortIndicator={sortIndicator}
                      isActive={isActive}
                      sortDir={sortDir}
                    />
                  )}
                </Flex>
              ) : (
                <>
                  {col.header}
                  {canSort && sortBy != null && sortDir != null && (
                    <SortIndicator
                      sortIndicator={sortIndicator}
                      isActive={isActive}
                      sortDir={sortDir}
                    />
                  )}
                </>
              )}
            </div>
          )
        })}
        {renderRowActions && (
          <div style={headerCellStyle('end', false)} aria-hidden />
        )}
      </div>

      <div
        ref={scrollRef}
        style={{ ...scrollBodyStyle, ...scrollBodyStyleOverride }}
      >
        {isLoading ? (
          loadingBody
        ) : rows.length === 0 && !infinite?.hasNextPage ? (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              {emptyMessage}
            </Text>
          </Flex>
        ) : (
          <div style={virtualSpacerStyle(rowVirtualizer.getTotalSize())}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const isLoaderRow = virtualRow.index >= rows.length

              if (isLoaderRow) {
                return (
                  <div
                    key={`loader-${virtualRow.index}`}
                    style={rowStyle(effectiveGridColumns, virtualRow, {
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 var(--space-3)',
                      color: 'var(--gray-10)',
                    })}
                  >
                    {infinite?.isFetchingNextPage
                      ? 'Loading more…'
                      : (infinite?.loaderLabel ?? 'Scroll to load more…')}
                  </div>
                )
              }

              const row = rows[virtualRow.index]
              const rowId = getRowId(row)
              const rowSelectable =
                selectable && (isRowSelectable ? isRowSelectable(row) : true)
              const isSelected =
                selectable && selectedId != null && rowId === selectedId
              const rowClassName = [
                INDEX_TABLE_ROW_CLASS,
                isSelected ? INDEX_TABLE_ROW_SELECTED_CLASS : undefined,
                getRowClassName?.(row),
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <div
                  key={rowId}
                  data-index={virtualRow.index}
                  className={rowClassName}
                  onClick={() => {
                    if (rowSelectable && onSelect) onSelect(rowId)
                  }}
                  style={rowStyle(effectiveGridColumns, virtualRow, {
                    cursor: rowSelectable ? 'pointer' : 'default',
                    ...getRowStyle?.(row),
                  })}
                >
                  {columns.map((col) => (
                    <div
                      key={col.id}
                      style={
                        col.align === 'end'
                          ? { textAlign: 'right' }
                          : col.align === 'center'
                            ? { textAlign: 'center' }
                            : undefined
                      }
                    >
                      {renderCell(row, col.id)}
                    </div>
                  ))}
                  {renderRowActions && (
                    <div style={{ textAlign: 'right' }}>
                      {renderRowActions(row)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )

  if (isLoading && loadingPlacement === 'fullscreen') {
    if (loadingVariant === 'spinner') {
      return (
        <Flex align="center" justify="center" py="8" style={{ height: '100%' }}>
          <Spinner size="3" />
        </Flex>
      )
    }

    return (
      <div style={containerStyle}>
        {toolbar}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            marginTop: toolbar ? 16 : 0,
          }}
        >
          {tableContent}
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {toolbar}

      {useHorizontalScroll ? (
        <div style={horizontalScrollOuterStyle}>
          <div style={horizontalScrollInnerStyle}>{tableContent}</div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            marginTop: toolbar ? 16 : 0,
          }}
        >
          {tableContent}
        </div>
      )}

      {footerCount !== false &&
        (typeof footerCount === 'number'
          ? footerCount > 0
          : footerCount != null && footerCount.shown > 0) && (
          <Flex align="center" mt="2">
            <Text size="2" color="gray">
              {formatFooterCount(footerCount as FooterCount)}
            </Text>
          </Flex>
        )}
    </div>
  )
}
