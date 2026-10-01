'use client'

import React from 'react'
import { Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterField {
  id: string
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

export interface ActiveChip {
  id: string
  label: string
  valueLabel: string
  onRemove: () => void
}

export interface FilterBarProps {
  search?: string
  onSearchChange?: (val: string) => void
  searchPlaceholder?: string
  filters?: FilterField[]
  activeChips?: ActiveChip[]
  onReset?: () => void
  extraActions?: React.ReactNode
  className?: string
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [],
  activeChips = [],
  onReset,
  extraActions,
  className = '',
}: FilterBarProps) {
  const hasActiveFilters = activeChips.length > 0 || (search && search.trim().length > 0)

  return (
    <div className={`filter-bar-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {/* Primary Toolbar */}
      <div
        className="school-context-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '10px 14px',
          background: 'var(--surface, #FFFFFF)',
          borderRadius: 'var(--radius-lg, 16px)',
          border: '1px solid var(--border-default, #E2E8F0)',
        }}
      >
        {/* Search input */}
        {onSearchChange !== undefined && (
          <div className="context-item" style={{ flex: '1 1 200px', minWidth: 180 }}>
            <div className="input-search" style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  color: 'var(--text-muted, #64748B)',
                  pointerEvents: 'none',
                }}
              />
              <input
                className="input"
                type="text"
                placeholder={searchPlaceholder}
                value={search || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: 32,
                  height: 36,
                  fontSize: 13,
                  borderRadius: 'var(--radius-md, 12px)',
                }}
              />
            </div>
          </div>
        )}

        {/* Filter Dropdowns */}
        {filters.map((f) => (
          <div key={f.id} className="context-item" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {f.label}:
            </label>
            <select
              className="select"
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              style={{ height: 36, fontSize: 13, borderRadius: 'var(--radius-md, 12px)' }}
            >
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Reset Action */}
        {onReset && hasActiveFilters && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onReset}
            title="Reset all filters"
            style={{ fontSize: 12, height: 36, gap: 5 }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}

        {/* Extra actions (Export, More buttons) */}
        {extraActions && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {extraActions}
          </div>
        )}
      </div>

      {/* Applied Filter Chips Bar */}
      {activeChips.length > 0 && (
        <FilterChips chips={activeChips} onClearAll={onReset} />
      )}
    </div>
  )
}

export interface FilterChipsProps {
  chips: ActiveChip[]
  onClearAll?: () => void
  className?: string
}

export function FilterChips({ chips, onClearAll, className = '' }: FilterChipsProps) {
  if (!chips || chips.length === 0) return null

  return (
    <div
      className={`filter-chips ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        padding: '2px 4px',
      }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Active ({chips.length}):
      </span>

      {chips.map((chip) => (
        <span
          key={chip.id}
          className="badge b-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 8px',
            fontSize: 12,
            borderRadius: '999px',
          }}
        >
          <span>
            <strong>{chip.label}:</strong> {chip.valueLabel}
          </span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter ${chip.label}`}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {onClearAll && (
        <button
          type="button"
          className="clear"
          onClick={onClearAll}
          style={{
            fontSize: 11.5,
            color: 'var(--primary)',
            fontWeight: 650,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginLeft: 4,
          }}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
