'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye,
  Search, Filter, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download,
  AlertCircle, MoreVertical, Columns3, Rows3, X, ArrowUpDown,
} from 'lucide-react'
import { Skeleton, EmptyState, IconButton, ZenTableSkeleton } from './ui'

export interface ColumnFilterOption {
  value: string
  label: string
}

export interface ColumnFilterDef<T> {
  options: ColumnFilterOption[]
  get: (row: T) => string | string[]
  placeholder?: string
}

export interface RowAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export interface Column<T> {
  key: string
  header: string
  render?: (row: T, index: number) => React.ReactNode
  sortable?: boolean
  sortValue?: (row: T) => string | number
  align?: 'left' | 'center' | 'right'
  width?: string | number
  hideable?: boolean
  filter?: ColumnFilterDef<T>
  export?: (row: T) => string | number | null | undefined
}

export interface DataTableProps<T extends { id?: string | number }> {
  columns: Column<T>[]
  data: T[] | null
  loading?: boolean
  error?: string | null
  emptyTitle?: string
  emptyMessage?: string
  emptyAction?: React.ReactNode
  emptyIcon?: React.ReactNode
  searchPlaceholder?: string
  onSearch?: (q: string) => void
  searchValue?: string
  toolbarActions?: React.ReactNode
  filters?: React.ReactNode
  onRowClick?: (row: T) => void
  /** Local sort by default; pass onSort to drive server-side sorting. */
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc'
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  /** Client-side row pagination (pages that fetch the full list). */
  paginate?: boolean
  defaultPageSize?: number
  pageSizeOptions?: number[]
  /** Server-side pagination contract (existing pages). */
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (p: number) => void
    onPageSizeChange?: (n: number) => void
  }
  /** Sticky summary/totals row rendered above the pagination bar. */
  footer?: React.ReactNode
  rowSelection?: boolean
  selectedKeys?: (string | number)[]
  onSelectionChange?: (keys: (string | number)[]) => void
  bulkActions?: React.ReactNode
  showExport?: boolean
  exportFileName?: string
  rowActions?: (row: T) => RowAction[]
  density?: 'cozy' | 'compact'
  onDensityChange?: (density: 'cozy' | 'compact') => void
  showToolbar?: boolean
  showColumnsMenu?: boolean
  /** Persist density, page size and hidden columns under this key (localStorage). */
  tableKey?: string
  /** Extra context shown next to the selection count in the bulk bar. */
  selectionSummary?: React.ReactNode
  /** Keep the selection checkbox column pinned while scrolling horizontally. */
  stickyCheckColumn?: boolean
}

type MenuState = { kind: 'cols' } | { kind: 'kebab'; rowId: string } | { kind: 'filter'; colKey: string } | null

function cellText<T>(col: Column<T>, row: T): string {
  if (col.export) return String(col.export(row) ?? '')
  const raw = (row as Record<string, unknown>)[col.key]
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'object') return ''
  return String(raw)
}

function toCsv(rows: { label: string; cell: string }[][]): string {
  const esc = (v: string) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map((c) => esc(c.cell)).join(',')).join('\r\n')
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading,
  error,
  emptyTitle = 'No records found',
  emptyMessage = 'No records are currently available matching your criteria.',
  emptyAction,
  emptyIcon,
  searchPlaceholder,
  onSearch,
  searchValue,
  toolbarActions,
  filters,
  onRowClick,
  defaultSortKey,
  defaultSortDir = 'asc',
  onSort,
  paginate,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  pagination,
  footer,
  rowSelection,
  selectedKeys,
  onSelectionChange,
  bulkActions,
  showExport = true,
  exportFileName = 'export.csv',
  rowActions,
  density: controlledDensity,
  onDensityChange,
  showToolbar = true,
  showColumnsMenu = true,
  tableKey,
  selectionSummary,
  stickyCheckColumn,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState(searchValue || '')
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({})
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [density, setDensity] = useState<'cozy' | 'compact'>(controlledDensity || 'cozy')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (controlledDensity) setDensity(controlledDensity)
  }, [controlledDensity])

  const changeDensity = (newDensity: 'cozy' | 'compact') => {
    setDensity(newDensity)
    onDensityChange?.(newDensity)
  }
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [selection, setSelection] = useState<Set<string | number>>(
    new Set((selectedKeys || []) as (string | number)[]),
  )
  const [menu, setMenu] = useState<MenuState>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Remembered table preferences (density / page size / hidden columns)
  const prefKey = tableKey ? `preone:dt:${tableKey}` : null
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!prefKey) {
      hydratedRef.current = true
      return
    }
    try {
      const raw = localStorage.getItem(prefKey)
      if (raw) {
        const p = JSON.parse(raw)
        /* eslint-disable react-hooks/set-state-in-effect */
        if (p?.density && !controlledDensity) {
          setDensity(p.density)
          onDensityChange?.(p.density as 'cozy' | 'compact')
        }
        if (typeof p?.pageSize === 'number') {
          if (pagination?.onPageSizeChange) {
            if (pagination.pageSize !== p.pageSize) pagination.onPageSizeChange(p.pageSize)
          } else {
            setPageSize(p.pageSize)
          }
        }
        if (Array.isArray(p?.hiddenCols)) setHiddenCols(new Set(p.hiddenCols as string[]))
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // ignore corrupt prefs
    }
    hydratedRef.current = true
  }, [])

  useEffect(() => {
    if (!prefKey || !hydratedRef.current) return
    try {
      localStorage.setItem(prefKey, JSON.stringify({
        density,
        pageSize: pagination ? pagination.pageSize : pageSize,
        hiddenCols: [...hiddenCols],
      }))
    } catch {
      // ignore write failures
    }
  }, [prefKey, density, pageSize, pagination?.pageSize, hiddenCols])

  const allRows = data || []

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedKeys) setSelection(new Set(selectedKeys))
  }, [selectedKeys])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (wrapRef.current && !wrapRef.current.contains(t)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const toggleMenu = (next: MenuState) => setMenu((cur) => (cur?.kind === next?.kind && (cur as any)?.rowId === (next as any)?.rowId ? null : next))

  const setSearch = useCallback((val: string) => {
    setLocalSearch(val)
    if (onSearch) onSearch(val)
    setPage(1)
  }, [onSearch])

  // column filters
  const toggleColFilter = useCallback((key: string, value: string) => {
    setColFilters((prev) => {
      const next = new Map(Object.entries(prev || {}))
      const set = new Set(next.get(key) || [])
      if (set.has(value)) set.delete(value)
      else set.add(value)
      if (set.size === 0) next.delete(key)
      else next.set(key, set)
      return Object.fromEntries(next)
    })
    setPage(1)
  }, [])

  const filtered = useMemo(() => {
    let rows = allRows
    const filterDefs = new Map(columns.filter((c) => c.filter).map((c) => [c.key, c.filter!]))
    const active = Object.entries(colFilters || {})
    if (active.length > 0) {
      rows = rows.filter((row) =>
        active.every(([key, values]) => {
          const def = filterDefs.get(key)
          if (!def) return true
          const got = def.get(row)
          const list = Array.isArray(got) ? got : [got]
          return list.some((v) => values.has(v))
        }),
      )
    }
    if (sortKey && sortDir) {
      const col = columns.find((c) => c.key === sortKey)
      if (col) {
        const sv = col.sortValue || ((r: T) => (r as Record<string, unknown>)[sortKey] as string | number)
        rows = [...rows].sort((a, b) => {
          const av = sv(a)
          const bv = sv(b)
          let cmp = 0
          if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
          else cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
          return sortDir === 'asc' ? cmp : -cmp
        })
      }
    }
    return rows
  }, [allRows, columns, colFilters, sortKey, sortDir])

  const visibleCols = useMemo(
    () => columns.filter((c) => !(c.key !== 'actions' && hiddenCols.has(c.key))),
    [columns, hiddenCols],
  )

  const totalPagesDecided = pagination ? Math.ceil(pagination.total / pagination.pageSize) : paginate ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1
  const currentPage = pagination ? pagination.page : page
  const paged = useMemo(() => {
    if (pagination || !paginate) return filtered
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, paginate, pagination, page, pageSize])

  const allSelected = rowSelection && allRows.length > 0 && allRows.every((r) => r.id !== undefined && selection.has(r.id))
  const someSelected = rowSelection && allRows.some((r) => r.id !== undefined && selection.has(r.id))

  const toggleAll = () => {
    if (!rowSelection) return
    const next = new Set(selection)
    if (allSelected) {
      allRows.forEach((r) => { if (r.id !== undefined) next.delete(r.id) })
    } else {
      allRows.forEach((r) => { if (r.id !== undefined) next.add(r.id) })
    }
    setSelection(next)
    if (onSelectionChange) onSelectionChange([...next])
  }

  const toggleRow = (id: string | number | undefined) => {
    if (!rowSelection || id === undefined) return
    const next = new Set(selection)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelection(next)
    if (onSelectionChange) onSelectionChange([...next])
  }

  const clearSelection = () => {
    setSelection(new Set())
    if (onSelectionChange) onSelectionChange([])
  }

  const exportSelected = () => {
    const targets = selection.size > 0 ? filtered.filter((r) => r.id !== undefined && selection.has(r.id)) : filtered
    const header = visibleCols.filter((c) => c.key !== 'actions').map((c) => ({ label: c.header, cell: c.header }))
    const body = targets.map((row) =>
      visibleCols.filter((c) => c.key !== 'actions').map((c) => ({ label: c.header, cell: cellText(c, row) })),
    )
    const csv = toCsv([header, ...body])
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const selectionOrder = visibleCols.filter((c) => c.key !== 'actions')

  const handleSort = (key: string) => {
    setPage(1)
    const nextDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    setSortKey(key)
    setSortDir(nextDir)
    if (onSort) onSort(key, nextDir)
  }

  const rangeLabel = pagination || paginate
    ? `Showing ${currentPage === 0 ? 0 : ((currentPage - 1) * (pagination ? pagination.pageSize : pageSize)) + 1}-${Math.min(currentPage * (pagination ? pagination.pageSize : pageSize), pagination ? pagination.total : filtered.length)} of ${pagination ? pagination.total : filtered.length}`
    : `${filtered.length} row${filtered.length === 1 ? '' : 's'}`

  return (
    <div className="dtable-wrap" ref={wrapRef}>
      {showToolbar && (searchPlaceholder || filters || toolbarActions || rowSelection || showExport) && (
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
            {searchPlaceholder && (
              <div className="input-search" style={{ maxWidth: 280, width: '100%' }}>
                <Search size={15} />
                <input
                  className="input"
                  placeholder={searchPlaceholder}
                  value={localSearch}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={searchPlaceholder}
                />
              </div>
            )}
            {filters}
          </div>
          <div className="table-tool-actions" role="toolbar" aria-label="Table tools">
            {rowSelection && selection.size > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
                <X size={14} /> Clear ({selection.size})
              </button>
            )}
            {bulkActions}
            {footer !== undefined && (
              <span className="t-caption" style={{ whiteSpace: 'nowrap' }}>{rangeLabel}</span>
            )}
            {showExport && (
              <button className="btn btn-ghost btn-sm" onClick={exportSelected} title="Export CSV">
                <Download size={14} /> CSV
              </button>
            )}
            {showColumnsMenu && (
              <div className="menu-anchor">
                <IconButton
                  icon={<Columns3 size={14} />}
                  label="Columns and density"
                  onClick={() => setMenu((m) => (m?.kind === 'cols' ? null : { kind: 'cols' }))}
                  variant="ghost"
                  size="sm"
                  className="dt-icon-btn"
                  aria-haspopup="menu"
                  aria-expanded={menu?.kind === 'cols'}
                />
                {menu?.kind === 'cols' && (
                  <div className="menu" role="menu" style={{ right: 0 }}>
                    <div className="menu-group">
                      <div className="menu-item menu-row-action" onClick={() => changeDensity(density === 'cozy' ? 'compact' : 'cozy')} role="menuitem">
                        <Rows3 size={14} />
                        {density === 'cozy' ? 'Compact rows' : 'Cozy rows'}
                      </div>
                    </div>
                    <div className="menu-label">Visible columns</div>
                    {columns.filter((c) => c.hideable !== false && c.key !== 'actions').map((c) => (
                      <label key={c.key} className="menu-item menu-check" role="menuitemcheckbox" aria-checked={!hiddenCols.has(c.key)}>
                        <input
                          type="checkbox"
                          checked={!hiddenCols.has(c.key)}
                          onChange={() =>
                            setHiddenCols((prev) => {
                              const next = new Set(prev)
                              if (next.has(c.key)) next.delete(c.key)
                              else next.add(c.key)
                              return next
                            })
                          }
                        />
                        <span>{c.header}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {rowSelection && selection.size > 0 && (
        <div className="bulk-bar" role="status">
          <span className="bulk-count">{selection.size} selected</span>
          {selectionSummary && (
            <span className="bulk-summary">{selectionSummary}</span>
          )}
          {showExport && (
            <button className="btn btn-sm btn-ghost" onClick={exportSelected}>
              <Download size={14} /> Export selected CSV
            </button>
          )}
          {bulkActions}
          <button className="btn btn-sm btn-ghost" onClick={clearSelection}>Clear</button>
        </div>
      )}

      <div className="dtable-scroll">
        <table
          className={`dtable density-${density}${stickyCheckColumn ? ' bdt-sticky' : ''}`}
          style={stickyCheckColumn ? { borderCollapse: 'separate' } : undefined}
        >
          <thead>
            <tr>
              {rowSelection && (
                <th style={{ width: 38 }} className="dt-col-check">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={!!allSelected}
                    ref={someSelected ? (el) => { if (el) el.indeterminate = true } : undefined}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {visibleCols.map((col) => {
                const activeFilter = colFilters[col.key]?.size
                const sorting = col.sortable && sortKey === col.key
                const filterOpen = menu?.kind === 'filter' && menu.colKey === col.key
                return (
                  <th
                    key={col.key}
                    style={{ textAlign: col.align || 'left', width: col.width }}
                    aria-sort={
                      col.sortable && sortKey === col.key
                        ? (sortDir === 'asc' ? 'ascending' : 'descending')
                        : undefined
                    }
                  >
                    <span className="th-inline">
                      {col.header}
                      {col.sortable && (
                        <button
                          className="th-sort"
                          onClick={() => handleSort(col.key)}
                          aria-label={`Sort by ${col.header}`}
                        >
                          {sorting ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} />}
                        </button>
                      )}
                      {col.filter && (
                        <span className="menu-anchor">
                          <button
                            className={`th-filter${activeFilter ? ' active' : ''}`}
                            onClick={() => setMenu((m) => (m?.kind === 'filter' && m.colKey === col.key ? null : { kind: 'filter', colKey: col.key }))}
                            aria-label={`Filter ${col.header}`}
                            aria-haspopup="menu"
                            aria-expanded={filterOpen}
                          >
                            <Filter size={12} />
                          </button>
                          {filterOpen && col.filter && (
                            <div className="menu menu-filter" role="menu">
                              <div className="menu-label">{col.filter.placeholder || `Filter by ${col.header}`}</div>
                              {col.filter.options.map((o) => {
                                const on = !!colFilters[col.key]?.has(o.value)
                                return (
                                  <label key={o.value} className="menu-item menu-check" role="menuitemcheckbox" aria-checked={on}>
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggleColFilter(col.key, o.value)}
                                    />
                                    <span>{o.label}</span>
                                  </label>
                                )
                              })}
                              {activeFilter && (
                                <div className="menu-footer">
                                  <button className="btn btn-ghost btn-sm" onClick={() => {
                                    setColFilters((prev) => {
                                      const next = { ...prev }
                                      delete next[col.key]
                                      return next
                                    })
                                  }}>
                                    Clear filter
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                )
              })}
              {rowActions && <th style={{ width: 88, textAlign: 'right' }} aria-label="Row actions" />}
            </tr>
          </thead>
          <tbody>
            {paged.length > 0 && paged.map((row, idx) => {
              const rid = row.id
              const isSel = rid !== undefined && selection.has(rid)
              return (
                <tr
                  key={rid !== undefined ? String(rid) : idx}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.closest('button, input, a, label')) return
                    if (onRowClick) onRowClick(row)
                  }}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  className={isSel ? 'dt-selected' : ''}
                >
                  {rowSelection && (
                    <td className="dt-col-check">
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={isSel}
                        onChange={() => toggleRow(rid)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      style={{ textAlign: col.align || 'left' }}
                      className={col.align === 'right' ? 'cell-num' : undefined}
                    >
                      {col.render
                        ? col.render(row, idx)
                        : highlightText(cellText(col, row), localSearch)}
                    </td>
                  ))}
                  {rowActions && (() => {
                    const acts = rowActions(row) || []
                    const primaryActs = acts.slice(0, 2)
                    const overflowActs = acts.length > 2 ? acts.slice(2) : []
                    return (
                      <td className="dt-row-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="dt-quick-actions justify-end" style={{ gap: 4 }}>
                          {primaryActs.map((act, i) => (
                            <IconButton
                              key={i}
                              icon={act.icon || <Eye size={14} />}
                              label={act.label}
                              title={act.label}
                              onClick={act.onClick}
                              variant="ghost"
                              size="sm"
                              className={`dt-icon-btn ${act.danger ? 'text-rose-600' : ''}`}
                              disabled={act.disabled}
                            />
                          ))}
                          {overflowActs.length > 0 && (
                            <span className="menu-anchor">
                              <IconButton
                                icon={<MoreVertical size={15} />}
                                label="More actions"
                                title="More actions"
                                onClick={() => toggleMenu(rid === undefined ? null : { kind: 'kebab', rowId: String(rid) })}
                                variant="ghost"
                                size="sm"
                                className="dt-icon-btn kebab"
                                aria-haspopup="menu"
                                aria-expanded={menu?.kind === 'kebab' && menu.rowId === String(rid)}
                              />
                              {menu?.kind === 'kebab' && rid !== undefined && menu.rowId === String(rid) && (
                                <div className="menu" role="menu" style={{ right: 0 }}>
                                  {overflowActs.map((act, i) => (
                                    <button
                                      key={i}
                                      className={`menu-item${act.danger ? ' menu-danger' : ''}${act.disabled ? ' menu-disabled' : ''}`}
                                      role="menuitem"
                                      disabled={act.disabled}
                                      onClick={() => { setMenu(null); act.onClick() }}
                                    >
                                      {act.icon}
                                      {act.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })()}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Mobile Card List Transformation (DS v4.1 Section 20 & 63: <760px) */}
        <div className="dt-mobile-cards" role="region" aria-label="Mobile records view">
          {paged.length > 0 && paged.map((row, idx) => {
            const rid = row.id
            const isSel = rid !== undefined && selection.has(rid)
            const primaryCol = visibleCols[0]
            const remainingCols = visibleCols.slice(1)

            return (
              <div
                key={rid !== undefined ? String(rid) : idx}
                className={`dt-card${isSel ? ' dt-selected' : ''}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (target.closest('button, input, a, label')) return
                  if (onRowClick) onRowClick(row)
                }}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {/* Card Header: Checkbox + First Column + Actions */}
                <div className="dt-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {rowSelection && (
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={isSel}
                        onChange={() => toggleRow(rid)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {primaryCol && (
                        primaryCol.render
                          ? primaryCol.render(row, idx)
                          : highlightText(cellText(primaryCol, row), localSearch)
                      )}
                    </div>
                  </div>

                  {rowActions && (
                    <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
                      <span className="menu-anchor">
                        <IconButton
                          icon={<MoreVertical size={15} />}
                          label="Row actions"
                          onClick={() => toggleMenu(rid === undefined ? null : { kind: 'kebab', rowId: `m-${String(rid)}` })}
                          variant="ghost"
                          size="sm"
                          className="dt-icon-btn kebab"
                          aria-haspopup="menu"
                          aria-expanded={menu?.kind === 'kebab' && menu.rowId === `m-${String(rid)}`}
                        />
                        {menu?.kind === 'kebab' && rid !== undefined && menu.rowId === `m-${String(rid)}` && (
                          <div className="menu" role="menu" style={{ right: 0 }}>
                            {(rowActions(row) || []).map((act, i) => (
                              <button
                                key={i}
                                className={`menu-item${act.danger ? ' menu-danger' : ''}${act.disabled ? ' menu-disabled' : ''}`}
                                role="menuitem"
                                disabled={act.disabled}
                                onClick={() => { setMenu(null); act.onClick() }}
                              >
                                {act.icon}
                                {act.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Body: Remaining columns as labeled key-value fields */}
                {remainingCols.length > 0 && (
                  <div className="dt-card-body">
                    {remainingCols.map((col) => {
                      const isWide = ['children', 'email', 'contact', 'notes', 'bio', 'description', 'address'].includes(col.key)
                      return (
                        <div key={col.key} className={`dt-card-field${isWide ? ' dt-card-field-wide' : ''}`}>
                          <span className="dt-card-lbl">{col.header}</span>
                          <div className="dt-card-val">
                            {col.render
                              ? col.render(row, idx)
                              : highlightText(cellText(col, row), localSearch)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {loading && (
          <ZenTableSkeleton
            rows={5}
            columns={visibleCols.length + (rowSelection ? 1 : 0) + (rowActions ? 1 : 0)}
          />
        )}

        {!loading && error && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: 'var(--danger)', margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, color: 'var(--danger)' }}>Failed to load data</div>
            <div className="t-caption" style={{ marginTop: 4 }}>{error}</div>
          </div>
        )}

        {!loading && !error && data && data.length === 0 && (
          <EmptyState
            illustration={emptyIcon || (localSearch ? 'search' : 'filter')}
            title={emptyTitle || (localSearch ? `No results for "${localSearch}"` : 'No matching records found')}
            description={emptyMessage || (localSearch ? 'Check for typos or try clearing your search query.' : 'Try adjusting your filters, search terms, or role selection.')}
            action={
              emptyAction ||
              (localSearch ? {
                label: 'Clear Search',
                onClick: () => {
                  setLocalSearch('')
                  onSearch?.('')
                },
                variant: 'secondary' as const,
              } : undefined)
            }
          />
        )}
      </div>

      {(pagination || paginate) && data && data.length > 0 && (
        <div className="dtable-foot">
          <span className="t-caption">
            {rangeLabel}
          </span>
          <div className="dtable-foot-right">
            {(pagination?.onPageSizeChange || paginate) && (
              <label className="dtable-page-size">
                <span className="t-caption">Rows</span>
                <select
                  className="select"
                  value={pagination ? pagination.pageSize : pageSize}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (pagination?.onPageSizeChange) pagination.onPageSizeChange(n)
                    else setPageSize(n)
                    setPage(1)
                  }}
                >
                  {pageSizeOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="btn btn-ghost btn-sm" disabled={currentPage <= 1} onClick={() => (pagination ? pagination.onPageChange(1) : setPage(1))} aria-label="First page">
              <ChevronLeft size={14} />
              <ChevronLeft size={14} style={{ marginLeft: -8 }} />
            </button>
            <button className="btn btn-ghost btn-sm" disabled={currentPage <= 1} onClick={() => (pagination ? pagination.onPageChange(currentPage - 1) : setPage(currentPage - 1))}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="dtable-page-jump">
              <input
                type="number"
                min={1}
                max={totalPagesDecided}
                value={currentPage}
                aria-label="Jump to page"
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!v || v < 1) return
                  const clamped = Math.min(v, totalPagesDecided)
                  if (pagination) pagination.onPageChange(clamped)
                  else setPage(clamped)
                }}
              />
              <span className="t-caption">/ {totalPagesDecided}</span>
            </span>
            <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPagesDecided} onClick={() => (pagination ? pagination.onPageChange(currentPage + 1) : setPage(currentPage + 1))}>
              Next <ChevronRight size={14} />
            </button>
            <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPagesDecided} onClick={() => (pagination ? pagination.onPageChange(totalPagesDecided) : setPage(totalPagesDecided))} aria-label="Last page">
              <ChevronRight size={14} />
              <ChevronRight size={14} style={{ marginLeft: -8 }} />
            </button>
          </div>
        </div>
      )}

      {footer && (
        <div className="dtable-totals" role="row">
          {footer}
        </div>
      )}
    </div>
  )
}

function highlightText(text: string, search: string): React.ReactNode {
  const q = search.trim()
  if (!q || !text) return text
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}