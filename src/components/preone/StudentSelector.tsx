'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Check, Baby, School, UserCheck } from 'lucide-react'

export interface SelectedStudent {
  id: string
  admissionNo: string
  name: string
  firstName?: string
  lastName?: string
  classroomName?: string
  branchName?: string
  programType?: string
  activeParentCount?: number
}

export interface StudentSelectorProps {
  onSelect?: (student: SelectedStudent | null) => void
  onChange?: (student: SelectedStudent | null) => void
  selectedStudent?: SelectedStudent | null
  value?: SelectedStudent | null
  branchId?: string
  disabled?: boolean
  required?: boolean
  label?: string
}

export function StudentSelector({
  onSelect,
  onChange,
  selectedStudent,
  value,
  branchId,
  disabled = false,
  required = false,
  label = 'Select Child / Student',
}: StudentSelectorProps) {
  const currentSelected = value !== undefined ? value : selectedStudent || null
  const handleSelection = (s: SelectedStudent | null) => {
    if (onChange) onChange(s)
    if (onSelect) onSelect(s)
  }
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('search', query.trim())
        params.set('pageSize', '10')
        if (branchId) params.set('branchId', branchId)

        const res = await fetch(`/api/v1/students?${params.toString()}`)
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setResults(json.data)
        } else {
          setResults([])
        }
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [query, branchId])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (s: any) => {
    handleSelection({
      id: s.id,
      admissionNo: s.admissionNo,
      name: s.name || `${s.firstName} ${s.lastName || ''}`.trim(),
      firstName: s.firstName,
      lastName: s.lastName,
      classroomName: s.classroom?.name,
      programType: s.classroom?.programType,
    })
    setOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    handleSelection(null)
    setQuery('')
  }

  return (
    <div className="field" ref={wrapperRef} style={{ position: 'relative' }}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>

      {currentSelected ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(124, 58, 237, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Baby size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--foreground)' }}>
                {currentSelected.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
                {currentSelected.admissionNo}
                {currentSelected.classroomName ? ` • ${currentSelected.classroomName}` : ''}
              </div>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-ghost btn-sm"
              style={{ padding: 4, height: 'auto' }}
              title="Remove selected student"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search by Admission No., student name, or phone..."
              disabled={disabled}
              style={{ paddingLeft: 34 }}
            />
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {open && (query.trim().length >= 2 || results.length > 0) && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                marginTop: 4,
                maxHeight: 220,
                overflowY: 'auto',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                boxShadow: 'var(--shadow-elevated)',
              }}
            >
              {loading ? (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Searching students...
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                  No students found matching "{query}"
                </div>
              ) : (
                results.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--foreground)' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{s.admissionNo}</span>
                        {s.classroom?.name && ` • ${s.classroom.name}`}
                        {s.primaryGuardian?.name && ` • Guardian: ${s.primaryGuardian.name}`}
                      </div>
                    </div>
                    <Check size={14} style={{ color: 'var(--primary)', opacity: 0.6 }} />
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
