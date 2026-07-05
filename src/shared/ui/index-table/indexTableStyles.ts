import type * as React from 'react'

export const INDEX_TABLE_ROW_CLASS = 'index-table-row'
export const INDEX_TABLE_ROW_SELECTED_CLASS = 'index-table-row--selected'

export const containerStyle: React.CSSProperties = {
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}

export const horizontalScrollOuterStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  marginTop: 16,
}

export const horizontalScrollInnerStyle: React.CSSProperties = {
  minWidth: 'max-content',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

export const headerStyle = (
  gridTemplateColumns: string,
): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns,
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--gray-a2)',
  borderRadius: 'var(--radius-2)',
  flexShrink: 0,
})

export const headerCellStyle = (
  align?: 'start' | 'end' | 'center',
  sortable?: boolean,
): React.CSSProperties => ({
  fontSize: 'var(--font-size-1)',
  fontWeight: 600,
  cursor: sortable ? 'pointer' : undefined,
  userSelect: sortable ? 'none' : undefined,
  textAlign:
    align === 'end' ? 'right' : align === 'center' ? 'center' : undefined,
})

export const scrollBodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  marginTop: 8,
}

export const virtualSpacerStyle = (height: number): React.CSSProperties => ({
  height: `${height}px`,
  width: '100%',
  position: 'relative',
})

export const rowStyle = (
  gridTemplateColumns: string,
  virtualRow: { size: number; start: number },
  extra?: React.CSSProperties,
): React.CSSProperties => ({
  position: 'absolute',
  top: `${virtualRow.start}px`,
  left: 0,
  width: '100%',
  height: `${virtualRow.size}px`,
  display: 'grid',
  gridTemplateColumns,
  gap: 'var(--space-2)',
  alignItems: 'center',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-2)',
  ...extra,
})
