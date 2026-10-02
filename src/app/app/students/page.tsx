'use client'

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, ChevronRight, Users, GraduationCap, ArrowRightLeft, UserX,
  Activity, Calendar, Building, BookOpen, UserRound, CheckSquare2,
  Search, RefreshCw, School, CheckCircle2, AlertCircle, X,
  SlidersHorizontal, Sparkles, Filter, Phone, Eye, ArrowRight
} from 'lucide-react'
import { PageHead, StatusBadge, StatusPill, Avatar, Segmented, Field, Skeleton, EmptyState } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import { Modal } from '@/components/preone/Modal'
import { DatePicker, MaskedInput, EnterNav, useFormDraft } from '@/components/preone/forms'
import { useToast } from '@/components/preone/Toast'
import { fmtDate, enumLabel } from '@/lib/format'

interface StudentRow {
  id: string
  admissionNo: string
  seatNumber?: string | null
  photoUrl?: string | null
  name: string
  dob: string
  gender: string
  status: string
  classroom: { id: string; name: string; code: string; programType: string; teacher: string } | null
  programType: string | null
  branchName?: string | null
  academicSessionName?: string | null
  primaryGuardian: { name: string; phone: string; relationship: string } | null
  attendance?: { rate: number; totalTracked: number }
}

interface Classroom {
  id: string
  name: string
  programType: string
  capacity?: number
  programId?: string
}

interface DashboardStats {
  totalStudents: number
  activeStudents: number
  transferredStudents: number
  withdrawnStudents: number
  recentAdmissions30d: number
  averageAttendanceRate: number
}

interface ContextOption {
  id: string
  name: string
  isCurrent?: boolean
  isMain?: boolean
  programType?: string
}

// Helper: Calculate child age in human-readable preschool format
function formatAge(dobString: string): string {
  if (!dobString) return ''
  const birth = new Date(dobString)
  if (isNaN(birth.getTime())) return ''
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0) {
    years--
    months += 12
  }
  if (years <= 0) return `${months} mos`
  if (months === 0) return `${years} yrs`
  return `${years}y ${months}m`
}

export default function StudentsPage() {
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<StudentRow[] | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filters & Context State
  const [q, setQ] = useState('')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [sessionFilter, setSessionFilter] = useState('ALL')
  const [programFilter, setProgramFilter] = useState('ALL')
  const [classFilter, setClassFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Master Dropdown data
  const [branches, setBranches] = useState<ContextOption[]>([])
  const [sessions, setSessions] = useState<ContextOption[]>([])
  const [programs, setPrograms] = useState<ContextOption[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrollClassroomId, setEnrollClassroomId] = useState('')

  // Enroll form enhancements (date picker, mask, draft autosave)
  const formRef = useRef<HTMLFormElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const [dob, setDob] = useState('')
  const [draftSaved, setDraftSaved] = useState(false)
  const draft = useFormDraft('preone.create-student.v1')

  useEffect(() => {
    if (createOpen && formRef.current) {
      draft.apply(formRef.current)
      const v = new FormData(formRef.current).get('dob')
      if (typeof v === 'string' && v) setDob(v)
    }
  }, [createOpen])

  const onDraftChange = () => {
    if (!formRef.current) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      draft.save(formRef.current as HTMLFormElement)
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2000)
    }, 400)
  }

  // Bulk operations
  const [selected, setSelected] = useState<(string | number)[]>([])
  const [bulkClassOpen, setBulkClassOpen] = useState(false)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [bulkNewClass, setBulkNewClass] = useState('')
  const [bulkNewStatus, setBulkNewStatus] = useState('ACTIVE')
  const [bulkReason, setBulkReason] = useState('')

  const openBulkClass = (targets?: (string | number)[]) => {
    if (targets && targets.length > 0) setSelected(targets)
    setBulkClassOpen(true)
  }

  const applyBulkClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!bulkNewClass || selected.length === 0) return
    setBulkAssigning(true)
    const reason = bulkReason || 'Bulk assignment'
    try {
      const results = await Promise.all(
        selected.map((id) =>
          fetch(`/api/v1/students/${id}/classroom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destinationClassroomId: bulkNewClass, reason }),
          }).then((r) => r.json()),
        ),
      )
      const okCount = results.filter((r) => r.success).length
      if (okCount === selected.length) {
        toast.success('Class assigned', `${okCount} child${okCount === 1 ? '' : 'ren'} moved`)
      } else {
        toast.error('Partial update', `${okCount} of ${selected.length} children updated`)
      }
      setBulkClassOpen(false)
      setBulkNewClass('')
      setBulkReason('')
      setSelected([])
      load()
    } catch (err: any) {
      toast.error('Could not assign class', err.message)
    } finally {
      setBulkAssigning(false)
    }
  }

  const applyBulkStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selected.length === 0) return
    setBulkAssigning(true)
    try {
      const results = await Promise.all(
        selected.map((id) =>
          fetch(`/api/v1/students/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: bulkNewStatus, reason: bulkReason || 'Bulk update' }),
          }).then((r) => r.json()),
        ),
      )
      const okCount = results.filter((r) => r.success).length
      if (okCount === selected.length) {
        toast.success('Status updated', `${okCount} child${okCount === 1 ? '' : 'ren'} updated`)
      } else {
        toast.error('Partial update', `${okCount} of ${selected.length} children updated`)
      }
      setBulkStatusOpen(false)
      setBulkNewStatus('ACTIVE')
      setBulkReason('')
      setSelected([])
      load()
    } catch (err: any) {
      toast.error('Could not update status', err.message)
    } finally {
      setBulkAssigning(false)
    }
  }

  // Load Setup Master Dropdowns
  useEffect(() => {
    async function loadMasters() {
      try {
        const [bRes, sRes, pRes, cRes] = await Promise.all([
          fetch('/api/v1/branches'),
          fetch('/api/v1/academic-years'),
          fetch('/api/v1/programs'),
          fetch('/api/v1/classrooms'),
        ])
        const [bJson, sJson, pJson, cJson] = await Promise.all([
          bRes.json(), sRes.json(), pRes.json(), cRes.json()
        ])
        if (bJson.success && Array.isArray(bJson.data)) setBranches(bJson.data)
        if (sJson.success && Array.isArray(sJson.data)) setSessions(sJson.data)
        if (pJson.success && Array.isArray(pJson.data)) setPrograms(pJson.data)
        if (cJson.success && Array.isArray(cJson.data)) setClassrooms(cJson.data)
      } catch (err) {
        console.error('Failed to load setup context masters:', err)
      }
    }
    loadMasters()
  }, [])

  // Load KPI Dashboard Stats
  const loadStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (branchFilter !== 'ALL') params.set('branchId', branchFilter)
      if (sessionFilter !== 'ALL') params.set('academicSessionId', sessionFilter)
      const res = await fetch(`/api/v1/students/dashboard?${params}`)
      const json = await res.json()
      if (json.success) setStats(json.data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [branchFilter, sessionFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (branchFilter !== 'ALL') params.set('branchId', branchFilter)
      if (sessionFilter !== 'ALL') params.set('academicSessionId', sessionFilter)
      if (programFilter !== 'ALL') params.set('programType', programFilter)
      if (classFilter !== 'ALL') params.set('classroomId', classFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)

      const [sRes, cRes] = await Promise.all([
        fetch(`/api/v1/students?${params}`),
        fetch('/api/v1/classrooms'),
      ])
      const sJson = await sRes.json()
      const cJson = await cRes.json()
      if (sJson.success) setRows(sJson.data)
      if (cJson.success) setClassrooms(cJson.data)
    } catch (err: any) {
      console.error('Failed to load students:', err)
      setLoadError(err.message || 'Unable to load students')
      toast.error('Failed to load students', err.message)
    } finally {
      setLoading(false)
    }
  }, [q, branchFilter, sessionFilter, programFilter, classFilter, statusFilter, toast])

  useEffect(() => {
    const t = setTimeout(() => {
      load()
      loadStats()
    }, 250)
    return () => clearTimeout(t)
  }, [load, loadStats])

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries())
    try {
      const res = await fetch('/api/v1/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Child admitted', `${payload.firstName} joined with ID ${json.data.admissionNo}`)
        setCreateOpen(false)
        setDob('')
        setEnrollClassroomId('')
        draft.clear()
        load()
        loadStats()
      } else {
        toast.error('Could not add child', json.error?.message || 'Check form fields and retry')
      }
    } catch (err: any) {
      toast.error('Error saving child', err.message)
    } finally {
      setSaving(false)
    }
  }

  // Selected enroll classroom helper for capacity display
  const selectedEnrollClass = useMemo(() => {
    return classrooms.find((c) => c.id === enrollClassroomId)
  }, [classrooms, enrollClassroomId])

  // Selected destination classroom helper for bulk transfer
  const selectedBulkClass = useMemo(() => {
    return classrooms.find((c) => c.id === bulkNewClass)
  }, [classrooms, bulkNewClass])

  // Context current session label
  const currentSessionObj = useMemo(() => {
    return sessions.find((s) => s.id === sessionFilter || s.isCurrent)
  }, [sessions, sessionFilter])

  // Calculate active filter count for responsive badge
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (branchFilter !== 'ALL') count++
    if (sessionFilter !== 'ALL') count++
    if (programFilter !== 'ALL') count++
    if (classFilter !== 'ALL') count++
    if (statusFilter !== 'ALL') count++
    if (q.trim()) count++
    return count
  }, [branchFilter, sessionFilter, programFilter, classFilter, statusFilter, q])

  const clearAllFilters = () => {
    setQ('')
    setBranchFilter('ALL')
    setSessionFilter('ALL')
    setProgramFilter('ALL')
    setClassFilter('ALL')
    setStatusFilter('ALL')
  }

  const columns: Column<StudentRow>[] = [
    {
      key: 'name',
      header: 'Child',
      sortable: true,
      sortValue: (s) => s.name.toLowerCase(),
      export: (s) => s.name,
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.name} src={s.photoUrl} size="md" />
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white text-sm hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              {s.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                {s.admissionNo}
              </span>
              {s.seatNumber && (
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/50">
                  {s.seatNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'classroom',
      header: 'Class / Section',
      sortable: true,
      sortValue: (s) => s.classroom?.name || '',
      export: (s) => s.classroom ? `${s.classroom.name} (${s.classroom.code})` : 'Unassigned',
      render: (s) =>
        s.classroom ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                {s.classroom.name}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                {enumLabel(s.classroom.programType)}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {s.classroom.teacher ? `Educator: ${s.classroom.teacher}` : 'No primary teacher'}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            Unassigned
          </span>
        ),
    },
    {
      key: 'dob',
      header: 'Age & DOB',
      sortable: true,
      sortValue: (s) => new Date(s.dob).getTime(),
      export: (s) => `${fmtDate(s.dob)} (${formatAge(s.dob)})`,
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {formatAge(s.dob)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {fmtDate(s.dob)}
          </span>
        </div>
      ),
    },
    {
      key: 'primaryGuardian',
      header: 'Primary Guardian',
      export: (s) => (s.primaryGuardian ? `${s.primaryGuardian.name} (${s.primaryGuardian.relationship}) ${s.primaryGuardian.phone}` : 'None'),
      render: (s) =>
        s.primaryGuardian ? (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {s.primaryGuardian.name}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {enumLabel(s.primaryGuardian.relationship)} · Primary
            </span>
            {s.primaryGuardian.phone && (
              <span className="text-[11px] font-mono text-slate-400 mt-0.5">
                {s.primaryGuardian.phone}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
    {
      key: 'attendance',
      header: 'Attendance',
      sortable: true,
      sortValue: (s) => s.attendance?.rate ?? 100,
      render: (s) => {
        const rate = s.attendance?.rate ?? 100
        const isGood = rate >= 85
        const isWarning = rate >= 70 && rate < 85
        const dotBg = isGood ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
        return (
          <div className="flex flex-col gap-1 w-20">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dotBg} shrink-0`} />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{rate}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${dotBg}`}
                style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
              />
            </div>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filter: {
        placeholder: 'Filter by status',
        get: (s) => s.status,
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
          { value: 'TRANSFERRED', label: 'Transferred' },
          { value: 'WITHDRAWN', label: 'Withdrawn' },
          { value: 'SUSPENDED', label: 'Suspended' },
          { value: 'GRADUATED', label: 'Graduated' },
        ],
      },
      render: (s) => <StatusPill status={s.status} size="sm" />,
    },
    {
      key: 'actions',
      header: '',
      width: 52,
      hideable: false,
      render: (s) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/app/students/${s.id}`)
          }}
          className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          title="View Student 360° Profile"
          aria-label={`View Student 360° Profile for ${s.name}`}
        >
          <Eye size={17} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 max-w-[1460px] mx-auto px-3 sm:px-5 lg:px-6">
      {/* ── 1. COMPACT HERO STRIP ── */}
      <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          {/* Eyebrow & Session Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              STUDENTS • M02
            </span>
            {currentSessionObj?.name && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {currentSessionObj.name}
              </span>
            )}
            <span className="text-[11px] text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
              Student Control Plane
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-[28px] lg:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
              <GraduationCap size={18} />
            </span>
            <span>Students & Child Records</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Manage children, classroom placement, guardians, attendance and day-to-day preschool information.
          </p>
        </div>

        {/* Action Controls: Refresh + Primary CTA */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            type="button"
            onClick={() => { load(); loadStats(); }}
            title="Refresh list"
            className="p-2 sm:p-2.5 min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            aria-label="Refresh student list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white px-4 py-2 sm:py-2.5 min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] flex-1 sm:flex-initial focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          >
            <Plus size={16} />
            <span>Enroll Child</span>
          </button>
        </div>
      </div>

      {/* ── OPTIONAL ERROR BANNER ── */}
      {loadError && (!rows || rows.length === 0) && (
        <div className="bg-white/95 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/50 rounded-2xl p-6 sm:p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Unable to load students</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Please refresh and try again.
          </p>
          <button
            type="button"
            onClick={() => { setLoadError(null); load(); loadStats(); }}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary-hover transition-colors"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* ── 2. COMPACT SMARTER KPI CARDS (RESPONSIVE AUTO-GRID) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Students */}
        <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between h-full transition-colors hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Students
            </span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Users size={13} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
              {stats ? stats.totalStudents : (loading ? <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">Across all classes</div>
          </div>
        </div>

        {/* Metric 2: Active */}
        <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between h-full transition-colors hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Active
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <GraduationCap size={13} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">
              {stats ? stats.activeStudents : (loading ? <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">Currently enrolled</div>
          </div>
        </div>

        {/* Metric 3: New Admissions */}
        <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between h-full transition-colors hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              New Admissions
            </span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Activity size={13} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
              {stats ? stats.recentAdmissions30d : (loading ? <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">Last 30 days</div>
          </div>
        </div>

        {/* Metric 4: Attendance Rate with mini progress */}
        <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between h-full transition-colors hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Attendance Rate
            </span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Calendar size={13} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 leading-none">
              {stats?.averageAttendanceRate != null ? `${stats.averageAttendanceRate}%` : (loading ? <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : '—')}
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, stats?.averageAttendanceRate || 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 5: Transferred (Zero visually quiet) */}
        <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between h-full transition-colors hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Transferred
            </span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${stats?.transferredStudents ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <ArrowRightLeft size={13} />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold leading-none ${stats?.transferredStudents ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {stats ? stats.transferredStudents : (loading ? <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">Branch transfers</div>
          </div>
        </div>

        {/* Metric 6: Withdrawn (Zero visually quiet) */}
        <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between h-full transition-colors hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Withdrawn
            </span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${stats?.withdrawnStudents ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <UserX size={13} />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold leading-none ${stats?.withdrawnStudents ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {stats ? stats.withdrawnStudents : (loading ? <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">Archived records</div>
          </div>
        </div>
      </div>

      {/* ── 3. SEARCH & FILTER WORKSPACE ── */}
      <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* ROW 1: Large prominent search field */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              className="w-full h-11 pl-11 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-2xs"
              placeholder="Search students, admission no., guardian, phone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search students"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                aria-label="Clear search query"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className="md:hidden flex items-center gap-1.5 h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0"
            aria-label="Toggle filters"
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* ROW 2: Desktop Filter Dropdowns */}
        <div className="hidden md:grid grid-cols-4 gap-2.5">
          <select
            className="h-9 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            aria-label="Filter by Campus"
          >
            <option value="ALL">All Campuses</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} {b.isMain ? '★' : ''}</option>
            ))}
          </select>

          <select
            className="h-9 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            aria-label="Filter by Academic Session"
          >
            <option value="ALL">All Academic Sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name} {s.isCurrent ? '★ (Current)' : ''}</option>
            ))}
          </select>

          <select
            className="h-9 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            aria-label="Filter by Program"
          >
            <option value="ALL">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.programType || p.id}>{p.name}</option>
            ))}
          </select>

          <select
            className="h-9 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Lifecycle Status"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="GRADUATED">Graduated</option>
          </select>
        </div>

        {/* Mobile Filter Drawer / Collapsible */}
        {mobileFiltersOpen && (
          <div className="md:hidden grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Campus</label>
              <select
                className="w-full h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-slate-700 dark:text-slate-200"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="ALL">All Campuses</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Session</label>
              <select
                className="w-full h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-slate-700 dark:text-slate-200"
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
              >
                <option value="ALL">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Program</label>
              <select
                className="w-full h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-slate-700 dark:text-slate-200"
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
              >
                <option value="ALL">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.programType || p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Status</label>
              <select
                className="w-full h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-slate-700 dark:text-slate-200"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="GRADUATED">Graduated</option>
              </select>
            </div>
          </div>
        )}

        {/* ROW 3: Compact Metro Chips for Classroom Quick-Switch */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none flex items-center gap-1.5 pb-0.5">
          <button
            onClick={() => setClassFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              classFilter === 'ALL'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium'
            }`}
          >
            All Classrooms
          </button>
          {classrooms.map((c) => (
            <button
              key={c.id}
              onClick={() => setClassFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap flex items-center gap-1.5 transition-all ${
                classFilter === c.id
                  ? 'bg-purple-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium'
              }`}
            >
              <span>{c.name}</span>
              <span className={`text-[10px] px-1 rounded ${classFilter === c.id ? 'bg-purple-700 text-purple-100' : 'bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {enumLabel(c.programType)}
              </span>
            </button>
          ))}
        </div>

        {/* ROW 4: Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap text-xs">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {q && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                Search: &ldquo;{q}&rdquo;
                <button onClick={() => setQ('')} className="hover:text-purple-900 dark:hover:text-white" aria-label="Remove search filter">
                  <X size={12} />
                </button>
              </span>
            )}
            {branchFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Campus: {branches.find(b => b.id === branchFilter)?.name || branchFilter}
                <button onClick={() => setBranchFilter('ALL')} className="hover:text-slate-900" aria-label="Remove campus filter">
                  <X size={12} />
                </button>
              </span>
            )}
            {sessionFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Session: {sessions.find(s => s.id === sessionFilter)?.name || sessionFilter}
                <button onClick={() => setSessionFilter('ALL')} className="hover:text-slate-900" aria-label="Remove session filter">
                  <X size={12} />
                </button>
              </span>
            )}
            {programFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Program: {enumLabel(programFilter)}
                <button onClick={() => setProgramFilter('ALL')} className="hover:text-slate-900" aria-label="Remove program filter">
                  <X size={12} />
                </button>
              </span>
            )}
            {classFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Class: {classrooms.find(c => c.id === classFilter)?.name || classFilter}
                <button onClick={() => setClassFilter('ALL')} className="hover:text-slate-900" aria-label="Remove classroom filter">
                  <X size={12} />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Status: {enumLabel(statusFilter)}
                <button onClick={() => setStatusFilter('ALL')} className="hover:text-slate-900" aria-label="Remove status filter">
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-purple-600 dark:text-purple-400 hover:underline font-semibold ml-auto text-xs"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* ── 4. CONTEXTUAL BULK ACTIONS TOOLBAR ── */}
      {selected.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-purple-900 dark:text-purple-200 shadow-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckSquare2 size={16} className="text-purple-600 dark:text-purple-400" />
            <span>{selected.length} child{selected.length === 1 ? '' : 'ren'} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openBulkClass()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft size={13} />
              <span>Assign Class</span>
            </button>
            <button
              onClick={() => setBulkStatusOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center gap-1.5 transition-colors"
            >
              <CheckSquare2 size={13} />
              <span>Change Status</span>
            </button>
            <button
              onClick={() => setSelected([])}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── 5. STUDENT DIRECTORY WORKSPACE CARD ── */}
      <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Workspace Header Strip */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100/80 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-200/50 dark:border-purple-800/40 shadow-2xs">
              <Users size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Students
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100/70 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
                  {rows ? rows.length : (stats?.totalStudents ?? 0)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                View and manage all student records across your preschool.
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Table View (≥ 768px) */}
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            onRowClick={(s) => router.push(`/app/students/${s.id}`)}
            emptyIcon={<Users size={36} className="text-purple-500" />}
            emptyTitle={activeFiltersCount > 0 ? "No students found" : "No students yet"}
            emptyMessage={activeFiltersCount > 0 ? "Try changing your filters or search." : "Enroll your first child to begin."}
            emptyAction={
              activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold shadow-sm"
                >
                  + Enroll Child
                </button>
              )
            }
            paginate
            defaultPageSize={10}
            showExport
            exportFileName="students-roster.csv"
            showColumnsMenu
            rowSelection
            selectedKeys={selected}
            onSelectionChange={setSelected}
            rowActions={(s) => [
              {
                label: 'View 360° Profile',
                icon: <UserRound size={15} />,
                onClick: () => router.push(`/app/students/${s.id}`),
              },
              {
                label: 'Assign Classroom',
                icon: <ArrowRightLeft size={15} />,
                onClick: () => openBulkClass([s.id]),
              },
            ]}
            footer={
              rows ? (
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>Total Shown: <b className="text-slate-800 dark:text-slate-200">{rows.length}</b></span>
                  <span>·</span>
                  <span>Active: <b className="text-emerald-600 dark:text-emerald-400">{rows.filter((r) => r.status === 'ACTIVE').length}</b></span>
                  <span>·</span>
                  <span>Transferred: <b className="text-amber-600 dark:text-amber-400">{rows.filter((r) => r.status === 'TRANSFERRED').length}</b></span>
                  <span>·</span>
                  <span>Withdrawn: <b className="text-rose-600 dark:text-rose-400">{rows.filter((r) => r.status === 'WITHDRAWN').length}</b></span>
                  <span>·</span>
                  <span>Unassigned: <b className="text-slate-600 dark:text-slate-300">{rows.filter((r) => !r.classroom).length}</b></span>
                </div>
              ) : null
            }
          />
        </div>

        {/* Mobile View: High-Fidelity Child Cards (< 768px) */}
        <div className="md:hidden p-3.5 space-y-3">
          {loading ? (
            <div className="space-y-3">
              <Skeleton h={140} />
              <Skeleton h={140} />
              <Skeleton h={140} />
            </div>
          ) : rows && rows.length > 0 ? (
            rows.map((s) => {
              const rate = s.attendance?.rate ?? 100
              return (
                <div
                  key={s.id}
                  onClick={() => router.push(`/app/students/${s.id}`)}
                  className="bg-white dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs space-y-3 cursor-pointer active:scale-[0.99] transition-all"
                >
                  {/* Top Row: Avatar + Name + Admission No + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} src={s.photoUrl} size="md" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {s.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.2 rounded font-medium">
                            {s.admissionNo}
                          </span>
                          {s.seatNumber && (
                            <span className="font-mono text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded font-semibold border border-purple-200/50">
                              {s.seatNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={s.status} size="sm" />
                  </div>

                  {/* Classroom & Teacher */}
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {s.classroom?.name || 'Unassigned Classroom'}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {s.classroom?.teacher || 'No primary educator'}
                    </div>
                  </div>

                  {/* Guardian */}
                  <div className="text-xs space-y-0.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Guardian
                    </div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {s.primaryGuardian ? `${s.primaryGuardian.name} · ${enumLabel(s.primaryGuardian.relationship)}` : 'No guardian recorded'}
                    </div>
                    {s.primaryGuardian?.phone && (
                      <div className="text-slate-500 font-mono text-[11px]">
                        {s.primaryGuardian.phone}
                      </div>
                    )}
                  </div>

                  {/* Attendance & Age Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Age</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {formatAge(s.dob)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Attendance</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${rate >= 85 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        <span>{rate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* View Profile Action Link */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/app/students/${s.id}`)
                      }}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-purple-500/30 rounded-lg"
                      aria-label={`View profile for ${s.name}`}
                    >
                      <span>View Profile</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyState
              compact
              illustration="students"
              eyebrow="Students"
              title={activeFiltersCount > 0 ? "No students found" : "No students yet"}
              description={activeFiltersCount > 0 ? "Try changing your filters or search." : "Enroll your first child to begin."}
              action={
                activeFiltersCount > 0
                  ? {
                      label: 'Clear Filters',
                      onClick: clearAllFilters,
                    }
                  : {
                      label: '+ Enroll Child',
                      onClick: () => setCreateOpen(true),
                    }
              }
            />
          )}
        </div>
      </div>

      {/* ── 6. ENROLL CHILD MODAL ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Enroll Child"
        subtitle="Add a new child directly to the preschool student register"
        icon={<Plus size={22} />}
        wide
      >
        <form id="create-student" onSubmit={onCreate} onInput={onDraftChange} ref={formRef}>
          <EnterNav>
            <div className="space-y-5">
              {/* Section 1: Child Identity */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>1. Child Demographics & Identity</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="firstName"
                      required
                      placeholder="e.g. Aarav"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Last Name</label>
                    <input
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="lastName"
                      placeholder="e.g. Patil"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>Date of Birth <span className="text-rose-500">*</span></span>
                      {dob && <span className="text-purple-600 font-bold text-xs">Age: {formatAge(dob)}</span>}
                    </label>
                    <DatePicker name="dob" value={dob} onChange={setDob} placeholder="Select birth date" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="gender"
                      required
                      defaultValue="MALE"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Classroom & Capacity */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-1.5">
                  <School size={14} />
                  <span>2. Classroom Placement & Seating</span>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Classroom / Section</label>
                  <select
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    name="classroomId"
                    value={enrollClassroomId}
                    onChange={(e) => setEnrollClassroomId(e.target.value)}
                  >
                    <option value="">- Unassigned -</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({enumLabel(c.programType)}) {c.capacity ? `· Capacity: ${c.capacity} seats` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedEnrollClass && (
                    <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200">
                      <div className="flex items-center gap-2">
                        <School size={15} className="text-purple-600" />
                        <span><b>{selectedEnrollClass.name}</b> ({enumLabel(selectedEnrollClass.programType)})</span>
                      </div>
                      <span>Room Capacity: <b>{selectedEnrollClass.capacity || 20} seats</b></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Guardian Details */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-1.5">
                  <Users size={14} />
                  <span>3. Parent / Primary Guardian</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Guardian Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="guardianName"
                      required
                      placeholder="e.g. Priya Patil"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Relationship <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="guardianRelationship"
                      defaultValue="MOTHER"
                    >
                      <option value="MOTHER">Mother</option>
                      <option value="FATHER">Father</option>
                      <option value="GRANDPARENT">Grandparent</option>
                      <option value="LEGAL_GUARDIAN">Legal Guardian</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Guardian Phone <span className="text-rose-500">*</span>
                    </label>
                    <MaskedInput name="guardianPhone" mask="phone" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Guardian Email</label>
                    <input
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="guardianEmail"
                      type="email"
                      placeholder="e.g. priya@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Health & Residence */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-1.5">
                  <Activity size={14} />
                  <span>4. Health & Residence</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Blood Group</label>
                    <select
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="bloodGroup"
                      defaultValue=""
                    >
                      <option value="">- Unknown / Not recorded -</option>
                      {['A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE'].map((b) => (
                        <option key={b} value={b}>{b.replace('_POSITIVE','+').replace('_NEGATIVE','-')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Residential Address</label>
                    <input
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      name="address"
                      placeholder="Flat 402, Green Valley Apartments, Pune"
                    />
                  </div>
                </div>
              </div>
            </div>
          </EnterNav>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              {draftSaved ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Draft autosaved</span>
                </>
              ) : (
                'Autosaves as you type'
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm flex items-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Admitting...</span>
                  </>
                ) : (
                  <span>Complete Enrollment</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── 7. BULK ASSIGN CLASSROOM MODAL ── */}
      <Modal
        open={bulkClassOpen}
        onClose={() => setBulkClassOpen(false)}
        title="Assign Classroom Section"
        subtitle={`Move ${selected.length} child${selected.length === 1 ? '' : 'ren'} to a new section`}
        icon={<ArrowRightLeft size={22} />}
      >
        <form onSubmit={applyBulkClass} className="space-y-4">
          <Field label="Destination class / section" required helper="Classroom capacity is strictly enforced on the server.">
            <select
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              value={bulkNewClass}
              onChange={(e) => setBulkNewClass(e.target.value)}
              required
            >
              <option value="">- Select classroom -</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({enumLabel(c.programType)}) {c.capacity ? `· Capacity: ${c.capacity} seats` : ''}
                </option>
              ))}
            </select>
          </Field>

          {selectedBulkClass && (
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200">
              <span>Moving to <b>{selectedBulkClass.name}</b></span>
              <span>Capacity: <b>{selectedBulkClass.capacity || 20} seats</b></span>
            </div>
          )}

          <Field label="Reason (for audit trail)">
            <input
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="e.g. Sibling placement, cohort regrouping, teacher request"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              onClick={() => setBulkClassOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkAssigning || !bulkNewClass || selected.length === 0}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {bulkAssigning ? 'Moving...' : `Assign ${selected.length} child${selected.length === 1 ? '' : 'ren'}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── 8. BULK CHANGE STATUS MODAL ── */}
      <Modal
        open={bulkStatusOpen}
        onClose={() => setBulkStatusOpen(false)}
        title="Update Student Lifecycle Status"
        subtitle={`Update status for ${selected.length} selected child${selected.length === 1 ? '' : 'ren'}`}
        icon={<CheckSquare2 size={22} />}
      >
        <form onSubmit={applyBulkStatus} className="space-y-4">
          <Field label="New lifecycle status" required>
            <select
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              value={bulkNewStatus}
              onChange={(e) => setBulkNewStatus(e.target.value)}
              required
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="WITHDRAWN">Withdrawn</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="GRADUATED">Graduated</option>
            </select>
          </Field>
          <Field label="Reason for change" required helper="Required for administrative compliance and immutable audit trail.">
            <input
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              required
              placeholder="Why is this status being applied?"
            />
          </Field>

          {bulkNewStatus === 'WITHDRAWN' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>Withdrawal is non-destructive. Financial and academic records are preserved.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              onClick={() => setBulkStatusOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkAssigning || selected.length === 0}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {bulkAssigning ? 'Updating...' : `Update ${selected.length} child${selected.length === 1 ? '' : 'ren'}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
