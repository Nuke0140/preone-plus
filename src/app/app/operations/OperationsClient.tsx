'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity, AlertTriangle, CheckCircle2, CalendarCheck, Users, RefreshCw, Siren,
  QrCode, ScanLine, ShieldCheck, ShieldAlert, KeyRound, Clock, HeartPulse,
  Utensils, Moon, Droplets, Sun, Sparkles, UserCheck, PhoneCall, ChevronRight,
  FileText, Search, Filter, Baby, Bath, Smile, Edit3, Trash2, X, Plus, AlertCircle,
  ArrowRight, Check, Eye, UserX, Thermometer, Shield, ExternalLink
} from 'lucide-react'
import { PageHead, StatusBadge, Skeleton, Avatar, EmptyState, Segmented, Field } from '@/components/preone/ui'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { Modal, Drawer } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { timeAgo, isoDate, fmtDate, enumLabel } from '@/lib/format'

interface FollowUpItem {
  id: string
  domain: string
  severity: string
  status: string
  title: string
  detail?: string | null
  student: string | null
  studentId?: string | null
  classroom: string | null
  responsibleRole?: string
  createdAt: string
  dueAt?: string | null
}

interface TodayData {
  today: string
  academicSession?: { id: string; name: string } | null
  branch?: { id: string; name: string } | null
  schoolStatus: { dayStatus: string; eventTitle: string | null; attendanceExpected: boolean; open: boolean }
  kpis: {
    totalStudents: number
    expectedChildren: number
    present: number
    absent: number
    late: number
    unmarked: number
    checkedIn: number
    checkedOut: number
    pickupPending: number
    healthAlerts: number
    openIncidents: number
    attendancePct: number
  }
  sections: {
    id: string; name: string; programType: string; teacher: string
    teacherId: string | null; capacity: number; expected: number
    present: number; absent: number; unmarked: number; attendancePct: number
    understaffed: boolean
  }[]
  exceptions: {
    criticalCount: number
    attentionCount: number
    unresolvedTotal: number
    critical: FollowUpItem[]
    attention: FollowUpItem[]
  }
}

const SEVERITY_BADGE: Record<string, string> = {
  EMERGENCY: 'b-danger',
  URGENT: 'b-orange',
  WARNING: 'b-warning',
  INFO: 'b-info',
}

const COMMON_SYMPTOMS = [
  'Fever',
  'Cough',
  'Runny Nose',
  'Rash',
  'Vomiting',
  'Lethargy',
  'Red Eyes',
  'Stomach Ache'
]

export function OperationsClient() {
  const toast = useToast()
  const [data, setData] = useState<TodayData | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  const [tab, setTab] = useState<'COMMAND' | 'CLASSROOM' | 'PICKUP_QUEUE' | 'GATE_SCANNER'>('COMMAND')

  // Classroom workspace state
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('')
  const [classroomData, setClassroomData] = useState<any>(null)
  const [classLoading, setClassLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'UNMARKED'>('ALL')

  // Pickup queue workspace state
  const [pickupQueue, setPickupQueue] = useState<any[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueSearch, setQueueSearch] = useState('')
  const [queueStatusFilter, setQueueStatusFilter] = useState<'ALL' | 'WAITING' | 'RELEASED' | 'NOT_PRESENT'>('ALL')
  const [queueClassFilter, setQueueClassFilter] = useState<string>('ALL')

  // Gate Scanner state (Used in both Workspace and Modal)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanCode, setScanCode] = useState('')
  const [scanMode, setScanMode] = useState<'ARRIVAL' | 'PICKUP'>('ARRIVAL')
  const [scannedStudent, setScannedStudent] = useState<any>(null)
  const [selectedGuardianId, setSelectedGuardianId] = useState('')
  const [pickupPin, setPickupPin] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string; details?: any } | null>(null)

  // Care intake and history drawer state
  const [careDrawerOpen, setCareDrawerOpen] = useState(false)
  const [activeCareStudent, setActiveCareStudent] = useState<any>(null)
  const [careDrawerTab, setCareDrawerTab] = useState<'LOG' | 'HISTORY'>('LOG')
  const [careType, setCareType] = useState<'MEAL' | 'NAP' | 'BATHROOM' | 'WATER' | 'MOOD'>('MEAL')
  const [careQuantity, setCareQuantity] = useState('Full')
  const [careNotes, setCareNotes] = useState('')
  const [careMood, setCareMood] = useState('Happy')
  const [editingCareEvent, setEditingCareEvent] = useState<any | null>(null)
  const [careMutationLoading, setCareMutationLoading] = useState(false)

  // Health check modal state
  const [healthModalOpen, setHealthModalOpen] = useState(false)
  const [activeHealthStudent, setActiveHealthStudent] = useState<any>(null)
  const [healthOutcome, setHealthOutcome] = useState<'CLEAR' | 'ATTENTION' | 'ISOLATE'>('CLEAR')
  const [healthTemp, setHealthTemp] = useState('')
  const [healthSymptoms, setHealthSymptoms] = useState('')

  // Incident modal state
  const [incidentModalOpen, setIncidentModalOpen] = useState(false)
  const [activeIncidentStudent, setActiveIncidentStudent] = useState<any>(null)
  const [incidentCategory, setIncidentCategory] = useState<'INJURY' | 'FALL' | 'ILLNESS' | 'BEHAVIOR' | 'SAFETY'>('INJURY')
  const [incidentSeverity, setIncidentSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [incidentTitle, setIncidentTitle] = useState('')
  const [incidentDesc, setIncidentDesc] = useState('')

  // Daily report preview modal state
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [activeReportStudent, setActiveReportStudent] = useState<any>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Load Dashboard Data
  const loadToday = useCallback(async () => {
    try {
      setBusy(true)
      const res = await fetch('/api/v1/operations/today')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        if (json.data.sections?.length > 0 && !selectedClassroomId) {
          setSelectedClassroomId(json.data.sections[0].id)
        }
      }
    } catch (e: any) {
      toast.error('Failed to load operations data', e.message)
    } finally {
      setBusy(false)
    }
  }, [selectedClassroomId, toast])

  // Load Single Classroom Board
  const loadClassroom = useCallback(async (cId: string) => {
    if (!cId) return
    setClassLoading(true)
    try {
      const res = await fetch(`/api/v1/operations/classrooms/${cId}`)
      const json = await res.json()
      if (json.success) {
        setClassroomData(json.data)
        // If the active care student is open, refresh their data from the updated classroom sheet
        if (activeCareStudent) {
          const updated = json.data.students?.find((s: any) => s.id === activeCareStudent.id)
          if (updated) setActiveCareStudent(updated)
        }
      }
    } catch (e: any) {
      toast.error('Failed to load classroom operational board', e.message)
    } finally {
      setClassLoading(false)
    }
  }, [activeCareStudent, toast])

  // Load Pickup Queue
  const loadPickupQueue = useCallback(async () => {
    setQueueLoading(true)
    try {
      const url = selectedClassroomId && queueClassFilter !== 'ALL'
        ? `/api/v1/operations/pickup?classroomId=${selectedClassroomId}`
        : '/api/v1/operations/pickup'
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) setPickupQueue(json.data.items || [])
    } catch (e: any) {
      toast.error('Failed to load pickup release queue', e.message)
    } finally {
      setQueueLoading(false)
    }
  }, [selectedClassroomId, queueClassFilter, toast])

  // Live Auto-Polling (45s)
  useEffect(() => {
    loadToday()
    const timer = setInterval(loadToday, 45_000)
    return () => clearInterval(timer)
  }, [loadToday])

  // Tab change triggers
  useEffect(() => {
    if (tab === 'CLASSROOM' && selectedClassroomId) {
      loadClassroom(selectedClassroomId)
    } else if (tab === 'PICKUP_QUEUE') {
      loadPickupQueue()
    }
  }, [tab, selectedClassroomId, loadClassroom, loadPickupQueue])

  // Gate Scanner Lookup
  const handleLookup = async (code: string) => {
    if (!code.trim()) return
    setScanLoading(true)
    setScanMessage(null)
    try {
      const res = await fetch(`/api/v1/operations/scan?code=${encodeURIComponent(code.trim())}`)
      const json = await res.json()
      if (json.success && json.data?.student) {
        setScannedStudent(json.data.student)
        const primary = json.data.student.guardians?.find((g: any) => g.canPickup)
        if (primary) setSelectedGuardianId(primary.id)
        else if (json.data.student.guardians?.length > 0) {
          setSelectedGuardianId(json.data.student.guardians[0].id)
        }
      } else {
        setScannedStudent(null)
        setScanMessage({ type: 'error', text: json.error?.message || 'Child not found for the provided credential.' })
      }
    } catch (e: any) {
      setScanMessage({ type: 'error', text: e.message })
    } finally {
      setScanLoading(false)
    }
  }

  // Gate Scanner Action Execution
  const handleExecuteScan = async () => {
    if (!scannedStudent) return
    setScanLoading(true)
    setScanMessage(null)
    try {
      const res = await fetch('/api/v1/operations/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: scannedStudent.admissionNo || scannedStudent.id,
          studentId: scannedStudent.id,
          eventType: scanMode,
          guardianId: scanMode === 'PICKUP' ? selectedGuardianId : undefined,
          pin: scanMode === 'PICKUP' ? pickupPin : undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setScanMessage({
          type: 'success',
          text: scanMode === 'ARRIVAL'
            ? `Gate check-in recorded for ${json.data.studentName} at ${json.data.time} (${json.data.status})`
            : `Authorized pickup released for ${json.data.studentName} to ${json.data.guardianName} at ${json.data.time}`,
          details: json.data,
        })
        toast.success(scanMode === 'ARRIVAL' ? 'Arrival Confirmed' : 'Pickup Released')
        setPickupPin('')
        loadToday()
        if (tab === 'CLASSROOM' && selectedClassroomId) loadClassroom(selectedClassroomId)
        if (tab === 'PICKUP_QUEUE') loadPickupQueue()
      } else {
        setScanMessage({
          type: 'error',
          text: json.error?.message || 'Security check failed. Release blocked.',
        })
        toast.error('Release Blocked', json.error?.message)
        loadToday()
      }
    } catch (e: any) {
      setScanMessage({ type: 'error', text: e.message })
    } finally {
      setScanLoading(false)
    }
  }

  // Quick Classroom Attendance Marking
  const handleMarkClassAttendance = async (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    try {
      const res = await fetch('/api/v1/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: selectedClassroomId,
          date: isoDate(),
          entries: [{ studentId, status }],
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Marked as ${status}`)
        loadClassroom(selectedClassroomId)
        loadToday()
      } else {
        toast.error('Failed to mark attendance', json.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    }
  }

  // Submit Care Intake (Create or Edit)
  const handleSubmitCare = async () => {
    if (!activeCareStudent) return
    setCareMutationLoading(true)
    try {
      if (editingCareEvent) {
        // Edit existing care record via PATCH /api/v1/care
        const res = await fetch('/api/v1/care', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingCareEvent.id,
            title: `${careType.charAt(0) + careType.slice(1).toLowerCase()} Log`,
            body: careNotes || undefined,
            mood: careMood,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success('Care log updated')
          setEditingCareEvent(null)
          setCareNotes('')
          loadClassroom(selectedClassroomId)
          setCareDrawerTab('HISTORY')
        } else {
          toast.error('Update failed', json.error?.message)
        }
      } else {
        // Create new care record via POST /api/v1/care
        const res = await fetch('/api/v1/care', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: activeCareStudent.id,
            type: careType,
            title: `${careType.charAt(0) + careType.slice(1).toLowerCase()} Log`,
            body: careNotes || undefined,
            quantity: careQuantity,
            mood: careMood,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success('Recorded to Daily Timeline')
          setCareNotes('')
          loadClassroom(selectedClassroomId)
          setCareDrawerTab('HISTORY')
        } else {
          toast.error('Failed to log care event', json.error?.message)
        }
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setCareMutationLoading(false)
    }
  }

  // Delete Care Event
  const handleDeleteCareEvent = async (eventId: string) => {
    if (!window.confirm('Delete this care record from today’s daily sheet?')) return
    setCareMutationLoading(true)
    try {
      const res = await fetch(`/api/v1/care?id=${eventId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Care entry removed')
        loadClassroom(selectedClassroomId)
      } else {
        toast.error('Failed to delete', json.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setCareMutationLoading(false)
    }
  }

  // Submit Health Check
  const handleSubmitHealth = async () => {
    if (!activeHealthStudent) return
    setBusy(true)
    try {
      const res = await fetch('/api/v1/operations/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: activeHealthStudent.id,
          outcome: healthOutcome,
          temperature: healthTemp ? parseFloat(healthTemp) : null,
          symptoms: healthSymptoms ? healthSymptoms.split(',').map((s) => s.trim()).filter(Boolean) : [],
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Health observation recorded')
        if (healthOutcome === 'ISOLATE') {
          toast.warning('Urgent Follow-Up Dispatched', 'Child isolated. Administrative staff alerted.')
        }
        setHealthModalOpen(false)
        setHealthTemp('')
        setHealthSymptoms('')
        loadClassroom(selectedClassroomId)
        loadToday()
      } else {
        toast.error('Health log failed', json.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  // Submit Safety Incident
  const handleSubmitIncident = async () => {
    if (!activeIncidentStudent) return
    if (!incidentTitle.trim() || !incidentDesc.trim()) {
      toast.error('Missing Required Fields', 'Title and description are required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/v1/operations/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: activeIncidentStudent.id,
          category: incidentCategory,
          severity: incidentSeverity,
          title: incidentTitle.trim(),
          description: incidentDesc.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Incident logged & safety exception escalated')
        setIncidentModalOpen(false)
        setIncidentTitle('')
        setIncidentDesc('')
        loadClassroom(selectedClassroomId)
        loadToday()
      } else {
        toast.error('Incident logging failed', json.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  // View Daily Report
  const handleViewReport = async (student: any) => {
    setActiveReportStudent(student)
    setReportModalOpen(true)
    setReportLoading(true)
    try {
      const res = await fetch(`/api/v1/operations/reports/daily?studentId=${student.id}`)
      const json = await res.json()
      if (json.success) setReportData(json.data)
    } catch (e: any) {
      toast.error('Failed to load parent daily report', e.message)
    } finally {
      setReportLoading(false)
    }
  }

  // Follow-up resolution
  const actFollowUp = async (id: string, action: string) => {
    let outcome: string | null = null
    if (action === 'resolve') {
      outcome = window.prompt('Resolution outcome / action taken (Mandatory audit trail note):', '')
      if (!outcome || !outcome.trim()) return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/operations/follow-ups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, outcome: outcome?.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Safety follow-up resolved')
        loadToday()
      } else {
        toast.error('Failed', json.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  // Filtered Classroom Students
  const filteredStudents = useMemo(() => {
    if (!classroomData?.students) return []
    return classroomData.students.filter((st: any) => {
      const matchesSearch = !studentSearch.trim() ||
        st.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        st.admissionNo?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (st.seatNumber && String(st.seatNumber).toLowerCase().includes(studentSearch.toLowerCase()))

      const matchesStatus =
        attendanceFilter === 'ALL' ||
        st.attendance === attendanceFilter

      return matchesSearch && matchesStatus
    })
  }, [classroomData, studentSearch, attendanceFilter])

  // Filtered Pickup Queue
  const filteredPickupQueue = useMemo(() => {
    return pickupQueue.filter((item: any) => {
      const matchesSearch = !queueSearch.trim() ||
        item.name.toLowerCase().includes(queueSearch.toLowerCase()) ||
        item.admissionNo?.toLowerCase().includes(queueSearch.toLowerCase()) ||
        (item.classroom && item.classroom.toLowerCase().includes(queueSearch.toLowerCase()))

      const matchesClass = queueClassFilter === 'ALL' || item.classroomId === queueClassFilter

      let matchesStatus = true
      if (queueStatusFilter === 'WAITING') matchesStatus = !item.isPickedUp && item.isPresent
      else if (queueStatusFilter === 'RELEASED') matchesStatus = item.isPickedUp
      else if (queueStatusFilter === 'NOT_PRESENT') matchesStatus = !item.isPresent

      return matchesSearch && matchesClass && matchesStatus
    })
  }, [pickupQueue, queueSearch, queueClassFilter, queueStatusFilter])

  if (!data) {
    return (
      <div className="w-full space-y-6 pb-12">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/app' }, { label: 'Operations' }]} />
        <PageHead title="Operations Control Room" sub="Synchronizing daily operational execution layer..." />
        <div className="metric-strip">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="metric-cell">
              <Skeleton h={80} />
            </div>
          ))}
        </div>
        <Skeleton h={400} />
      </div>
    )
  }

  const k = data.kpis
  const ex = data.exceptions
  const schoolStatus = data.schoolStatus

  return (
    <div className="w-full space-y-6 pb-12">
      {/* ── Breadcrumbs ── */}
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/app' }, { label: 'Operations' }]} />

      {/* ── 1. Page Header & Operational Context ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Daily School Operations Control
            </h1>
            <span className="badge b-primary text-xs font-semibold px-2 py-0.5">
              M06 Control Room
            </span>
            <span className={`badge ${schoolStatus.open ? 'b-success' : 'b-warning'} text-xs font-semibold`}>
              {enumLabel(schoolStatus.dayStatus)} {schoolStatus.eventTitle ? `· ${schoolStatus.eventTitle}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground">
              {data.today ? fmtDate(data.today) : 'Today'}
            </span>
            <span>•</span>
            <span>Campus: <b className="text-foreground">{data.branch?.name || 'Main Campus'}</b></span>
            <span>•</span>
            <span>Session: <b className="text-foreground">{data.academicSession?.name || 'Active Session'}</b></span>
          </div>
        </div>

        {/* Live Indicator & Quick Gate Action */}
        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <div className="text-right hidden sm:block">
            <div className="text-[11.5px] text-muted-foreground flex items-center gap-1.5 justify-end">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Polling (45s)
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              {lastSyncTime ? `Updated ${lastSyncTime}` : 'Connected'}
            </div>
          </div>

          <button
            className="btn btn-outline btn-sm flex items-center gap-1.5"
            onClick={loadToday}
            disabled={busy}
            title="Refresh All Operations Data"
          >
            <RefreshCw size={13} className={busy ? 'animate-spin text-primary' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
            onClick={() => {
              setScanModalOpen(true)
              setScanMessage(null)
              setScannedStudent(null)
              setScanCode('')
            }}
          >
            <QrCode size={15} />
            <span>Gate Scanner</span>
          </button>
        </div>
      </div>

      {/* ── 2. Canonical PreOne Metric Strip ── */}
      <div className="metric-strip">
        {/* Present Today */}
        <div
          className="metric-cell cursor-pointer"
          onClick={() => {
            setTab('CLASSROOM')
            setAttendanceFilter('PRESENT')
          }}
          title="Click to view present students"
        >
          <div className="m-top">
            <span className="m-lbl">Present Today</span>
            <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <UserCheck size={14} />
            </span>
          </div>
          <div className="m-val m-success">
            {k.present}
            <span style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 600, marginLeft: 2 }}>
              /{k.totalStudents}
            </span>
          </div>
          <div className="m-meta truncate">
            {k.attendancePct}% attendance • <span className="text-rose-500 font-medium">{k.absent} absent</span>
          </div>
        </div>

        {/* Gate Checked In */}
        <div
          className="metric-cell cursor-pointer"
          onClick={() => {
            setTab('PICKUP_QUEUE')
            setQueueStatusFilter('ALL')
          }}
          title="Click to view gate arrival queue"
        >
          <div className="m-top">
            <span className="m-lbl">Gate Checked In</span>
            <span className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ScanLine size={14} />
            </span>
          </div>
          <div className="m-val m-highlight">
            {k.checkedIn}
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }}>
              at campus
            </span>
          </div>
          <div className="m-meta truncate">
            {Math.max(0, k.totalStudents - k.checkedIn)} pending gate • <span className="text-primary font-medium">Queue →</span>
          </div>
        </div>

        {/* Pending Pickup */}
        <div
          className="metric-cell cursor-pointer"
          onClick={() => {
            setTab('PICKUP_QUEUE')
            setQueueStatusFilter('WAITING')
          }}
          title="Click to view pending dismissal queue"
        >
          <div className="m-top">
            <span className="m-lbl">Pending Pickup</span>
            <span className={`w-6 h-6 rounded-md flex items-center justify-center ${k.pickupPending > 0 ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
              <Clock size={14} />
            </span>
          </div>
          <div className={`m-val ${k.pickupPending > 0 ? 'm-warning' : ''}`}>
            {k.pickupPending}
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }}>
              in rooms
            </span>
          </div>
          <div className="m-meta truncate">
            {k.checkedOut} released so far • <span className="text-amber-600 font-medium">{k.pickupPending > 0 ? 'Release now' : 'All clear'}</span>
          </div>
        </div>

        {/* Safety & Critical Exceptions */}
        <div
          className="metric-cell cursor-pointer"
          onClick={() => {
            setTab('COMMAND')
            const el = document.getElementById('critical-exceptions-section')
            if (el) el.scrollIntoView({ behavior: 'smooth' })
          }}
          title="Click to view open safety alerts"
        >
          <div className="m-top">
            <span className="m-lbl">Safety Alerts</span>
            <span className={`w-6 h-6 rounded-md flex items-center justify-center ${ex.criticalCount > 0 ? 'bg-rose-500/15 text-rose-600 animate-pulse' : 'bg-emerald-500/10 text-emerald-600'}`}>
              {ex.criticalCount > 0 ? <Siren size={14} /> : <ShieldCheck size={14} />}
            </span>
          </div>
          <div className={`m-val ${ex.criticalCount > 0 ? 'm-danger' : 'm-success'}`}>
            {ex.criticalCount}
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }}>
              critical
            </span>
          </div>
          <div className="m-meta truncate">
            {ex.attentionCount} attention items • <span className={ex.criticalCount > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
              {ex.criticalCount > 0 ? 'Action required' : 'Optimal'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Workspace Navigation (Segmented Control) ── */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <Segmented
          value={tab}
          onChange={(val) => setTab(val as any)}
          options={[
            { key: 'COMMAND', label: `Command Center (${ex.criticalCount + ex.attentionCount})` },
            { key: 'CLASSROOM', label: 'Classroom Daily Sheet' },
            { key: 'PICKUP_QUEUE', label: `Gate & Dismissal (${k.pickupPending} Pending)` },
            { key: 'GATE_SCANNER', label: 'High-Speed Scanner' },
          ]}
        />
      </div>

      {/* ── 4. WORKSPACE 1: COMMAND CENTER & ALERTS ── */}
      {tab === 'COMMAND' && (
        <div className="space-y-6">
          {/* Critical Safety Exceptions Section */}
          <div
            id="critical-exceptions-section"
            className="card"
            style={{
              background: 'var(--surface)',
              border: `1px solid ${ex.criticalCount > 0 ? 'var(--danger, var(--danger))' : 'var(--border-default)'}`,
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 1px 3px rgba(21, 37, 74, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: ex.criticalCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Siren size={18} style={{ color: ex.criticalCount > 0 ? 'var(--danger)' : 'var(--success)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Critical Safety Exceptions</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Real-time health isolations, safety incidents, and late arrivals requiring immediate escalation</p>
                </div>
              </div>
              <span className={`badge ${ex.criticalCount > 0 ? 'b-danger' : 'b-success'}`} style={{ fontWeight: 700 }}>
                {ex.criticalCount} Open
              </span>
            </div>

            {ex.critical.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <ShieldCheck size={36} style={{ margin: '0 auto 8px auto', color: 'var(--success)', opacity: 0.8 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Zero Critical Alerts Active</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>All gate arrivals, health triages, and classroom isolations are clear.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {ex.critical.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: '14px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 260 }}>
                      <Avatar name={f.student || f.title} size="md" />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{f.title}</span>
                          <span className={`badge ${SEVERITY_BADGE[f.severity] || 'b-neutral'}`} style={{ fontSize: 10 }}>{f.severity}</span>
                          <StatusBadge status={f.status} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {f.student && <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.student}</span>}
                          {f.classroom && <span>• {f.classroom}</span>}
                          <span>• {f.domain}</span>
                          <span>• {timeAgo(f.createdAt)}</span>
                        </div>
                        {f.detail && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                            {f.detail}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {f.status === 'OPEN' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => actFollowUp(f.id, 'acknowledge')}
                          disabled={busy}
                        >
                          Acknowledge
                        </button>
                      )}
                      {!['RESOLVED', 'CLOSED'].includes(f.status) && (
                        <button
                          type="button"
                          className="btn btn-success btn-sm flex items-center gap-1.5"
                          onClick={() => actFollowUp(f.id, 'resolve')}
                          disabled={busy}
                        >
                          <CheckCircle2 size={13} /> Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section Attendance Meters Grid + Attention Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Section Roster Status (7 Cols) */}
            <div
              className="lg:col-span-7 card"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 16,
                padding: 20,
                boxShadow: '0 1px 3px rgba(21, 37, 74, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(106, 53, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Users size={18} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Section Attendance Meters</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Classroom capacity, active staffing, and live check-in percentage</p>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{data.sections.length} Sections</span>
              </div>

              <div className="flex flex-col gap-3">
                {data.sections.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-all hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{s.name}</span>
                        <span className="badge b-neutral text-[10px]">{s.programType}</span>
                        {s.understaffed && <span className="badge b-warning text-[10px]">Understaffed</span>}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                        Teacher: <span className="font-semibold text-[var(--text-primary)]">{s.teacher}</span> • Capacity: {s.capacity}
                      </div>
                      {/* Meter bar */}
                      <div className="mt-2 flex items-center gap-2.5">
                        <div className="flex-1 h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${s.attendancePct}%`,
                              backgroundColor: s.attendancePct >= 75 ? 'var(--success)' : s.attendancePct >= 40 ? 'var(--warning)' : 'var(--danger)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono font-semibold text-[var(--text-primary)] w-11 text-right shrink-0">
                          {s.attendancePct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-default)] shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-bold font-mono text-[var(--text-primary)]">
                          {s.present} <span className="text-xs font-normal text-[var(--text-muted)]">/ {s.expected}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">{s.absent} absent</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm flex items-center gap-1 shrink-0"
                        onClick={() => {
                          setSelectedClassroomId(s.id)
                          setTab('CLASSROOM')
                        }}
                      >
                        <span>Open Sheet</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attention Follow-ups (5 Cols) */}
            <div
              className="lg:col-span-5 card"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 16,
                padding: 20,
                boxShadow: '0 1px 3px rgba(21, 37, 74, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(245, 158, 11, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Attention Queue</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Non-critical follow-ups & guardian calls</p>
                  </div>
                </div>
                <span className="badge b-warning" style={{ fontWeight: 600 }}>{ex.attentionCount} Open</span>
              </div>

              {ex.attention.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <CheckCircle2 size={32} style={{ margin: '0 auto 8px auto', color: 'var(--success)', opacity: 0.8 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No Attention Items</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>All day-to-day administrative items are up to date.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {ex.attention.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{f.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {f.student && <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.student} • </span>}
                          <span>{timeAgo(f.createdAt)}</span>
                        </div>
                        {f.detail && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{f.detail}</p>}
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-xs shrink-0"
                        onClick={() => actFollowUp(f.id, 'resolve')}
                        disabled={busy}
                      >
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. WORKSPACE 2: CLASSROOM DAILY SHEET ── */}
      {tab === 'CLASSROOM' && (
        <div className="space-y-4">
          {/* Classroom Selection & Live Stats Bar */}
          <div
            className="card flex flex-col md:flex-row md:items-center justify-between gap-4"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 16,
              padding: 16,
              boxShadow: '0 1px 3px rgba(21, 37, 74, 0.04)',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                Active Section:
              </label>
              <select
                className="select max-w-sm font-medium"
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
              >
                {data.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.programType}) — Teacher: {s.teacher}
                  </option>
                ))}
              </select>
            </div>

            {classroomData && (
              <div className="flex items-center gap-2 flex-wrap border-t md:border-t-0 pt-2 md:pt-0" style={{ borderColor: 'var(--border-default)' }}>
                <span className="counter-chip">Enrolled: <b>{classroomData.summary.total}</b></span>
                <span className="counter-chip c-present">Present: <b>{classroomData.summary.present}</b></span>
                <span className="counter-chip c-absent">Absent: <b>{classroomData.summary.absent}</b></span>
                <span className="counter-chip c-late">Late: <b>{classroomData.summary.late || 0}</b></span>
                <span className="counter-chip">Unmarked: <b>{classroomData.summary.unmarked}</b></span>
              </div>
            )}
          </div>

          {/* Roster Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                className="input text-xs"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search child by name, admission #, or seat..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              {studentSearch && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setStudentSearch('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="overflow-x-auto pb-1 sm:pb-0">
              <Segmented
                value={attendanceFilter}
                onChange={(st) => setAttendanceFilter(st as any)}
                options={[
                  { key: 'ALL', label: 'All' },
                  { key: 'PRESENT', label: 'Present' },
                  { key: 'ABSENT', label: 'Absent' },
                  { key: 'LATE', label: 'Late' },
                  { key: 'UNMARKED', label: 'Unmarked' },
                ]}
              />
            </div>
          </div>

          {/* Student Cards Grid */}
          {classLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} h={210} />)}
            </div>
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={<Users size={36} />}
              title="No children found"
              message={studentSearch || attendanceFilter !== 'ALL' ? 'No children match the active filters.' : 'Students allocated to this classroom will appear here.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map((st: any) => {
                const isPresent = st.attendance === 'PRESENT'
                const isAbsent = st.attendance === 'ABSENT'
                const isLate = st.attendance === 'LATE'

                return (
                  <div
                    key={st.id}
                    className="card hover:shadow-md transition-all duration-200"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 16,
                      padding: 16,
                      boxShadow: '0 1px 3px rgba(21, 37, 74, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      {/* Top Child Identity Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar name={st.name} size="lg" />
                          <div>
                            <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              <span>{st.name}</span>
                              {st.seatNumber && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  #{st.seatNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                              {st.admissionNo}
                              {st.primaryGuardian && ` · ${st.primaryGuardian.name}`}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={st.attendance} />
                      </div>

                      {/* Care Activity Chips Strip */}
                      <div className="mt-3.5 flex flex-wrap gap-1.5 text-xs">
                        <span className={`badge ${st.careSummary.mealsCount > 0 ? 'b-primary' : 'b-neutral'} flex items-center gap-1 text-[11px]`}>
                          <Utensils size={11} /> {st.careSummary.mealsCount} Meals
                        </span>
                        <span className={`badge ${st.careSummary.napCount > 0 ? 'b-primary' : 'b-neutral'} flex items-center gap-1 text-[11px]`}>
                          <Moon size={11} /> {st.careSummary.napCount} Naps
                        </span>
                        <span className={`badge ${st.careSummary.bathroomCount > 0 ? 'b-primary' : 'b-neutral'} flex items-center gap-1 text-[11px]`}>
                          <Bath size={11} /> {st.careSummary.bathroomCount} Toilet
                        </span>
                        {st.careSummary.healthFlag && (
                          <span className="badge b-danger flex items-center gap-1 text-[11px] animate-pulse">
                            <HeartPulse size={11} /> Health Flag
                          </span>
                        )}
                        {st.isPickedUp ? (
                          <span className="badge b-success flex items-center gap-1 text-[11px]">
                            <ShieldCheck size={11} /> Released ({st.pickedUpAt})
                          </span>
                        ) : st.arrivedAt ? (
                          <span className="badge b-info flex items-center gap-1 text-[11px]">
                            <Clock size={11} /> Arrived {st.arrivedAt}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Operational Action Controls: Roll Call + Modal Triggers */}
                    <div className="mt-4 pt-3 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                      {/* 1-Tap Attendance Roll Call (44px touch target) */}
                      <div className="flex gap-1.5 bg-muted/40 p-1 rounded-xl" style={{ border: '1px solid var(--border-default)' }}>
                        <button
                          type="button"
                          className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                            isPresent
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                          }`}
                          onClick={() => handleMarkClassAttendance(st.id, 'PRESENT')}
                          title="Mark Present"
                        >
                          P
                        </button>
                        <button
                          type="button"
                          className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                            isAbsent
                              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                          }`}
                          onClick={() => handleMarkClassAttendance(st.id, 'ABSENT')}
                          title="Mark Absent"
                        >
                          A
                        </button>
                        <button
                          type="button"
                          className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                            isLate
                              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                          }`}
                          onClick={() => handleMarkClassAttendance(st.id, 'LATE')}
                          title="Mark Late"
                        >
                          L
                        </button>
                      </div>

                      {/* Toolset: Care Drawer, Health, Incident, Daily Report, 360 */}
                      <div className="flex items-center gap-1">
                        <button
                          className="btn btn-ghost btn-sm h-9 w-9 p-0 flex items-center justify-center text-primary"
                          title="Care Sheet (Meals, Nap, Hydration & History)"
                          onClick={() => {
                            setActiveCareStudent(st)
                            setCareNotes('')
                            setEditingCareEvent(null)
                            setCareDrawerTab(st.careSummary?.events?.length > 0 ? 'HISTORY' : 'LOG')
                            setCareDrawerOpen(true)
                          }}
                        >
                          <Utensils size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm h-9 w-9 p-0 flex items-center justify-center text-rose-500"
                          title="Triage Health Check"
                          onClick={() => {
                            setActiveHealthStudent(st)
                            setHealthOutcome('CLEAR')
                            setHealthTemp('')
                            setHealthSymptoms('')
                            setHealthModalOpen(true)
                          }}
                        >
                          <HeartPulse size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm h-9 w-9 p-0 flex items-center justify-center text-amber-600"
                          title="Report Safety Incident"
                          onClick={() => {
                            setActiveIncidentStudent(st)
                            setIncidentTitle('')
                            setIncidentDesc('')
                            setIncidentCategory('INJURY')
                            setIncidentSeverity('LOW')
                            setIncidentModalOpen(true)
                          }}
                        >
                          <AlertTriangle size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm h-9 w-9 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title="View Daily Parent Report"
                          onClick={() => handleViewReport(st)}
                        >
                          <FileText size={15} />
                        </button>
                        <Link
                          href={`/app/students/${st.id}`}
                          className="btn btn-ghost btn-sm h-9 w-9 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title="Open Student 360 Profile"
                        >
                          <ExternalLink size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 6. WORKSPACE 3: GATE & PICKUP RELEASE QUEUE ── */}
      {tab === 'PICKUP_QUEUE' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div
            className="card flex flex-col md:flex-row md:items-center justify-between gap-4"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 16,
              padding: 16,
              boxShadow: '0 1px 3px rgba(21, 37, 74, 0.04)',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  className="input text-xs"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Search child or classroom..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                />
                {queueSearch && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setQueueSearch('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                className="select text-xs max-w-xs"
                value={queueClassFilter}
                onChange={(e) => setQueueClassFilter(e.target.value)}
              >
                <option value="ALL">All Classrooms</option>
                {data.sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Queue Status Pills */}
            <div className="overflow-x-auto pb-1 md:pb-0">
              <Segmented
                value={queueStatusFilter}
                onChange={(qf) => setQueueStatusFilter(qf as any)}
                options={[
                  { key: 'ALL', label: 'All Queue' },
                  { key: 'WAITING', label: 'Waiting Pickup' },
                  { key: 'RELEASED', label: 'Released' },
                  { key: 'NOT_PRESENT', label: 'Not Present' },
                ]}
              />
            </div>
          </div>

          {/* Queue Container */}
          <div
            className="card overflow-hidden"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 16,
              padding: 0,
              boxShadow: '0 1px 3px rgba(21, 37, 74, 0.04)',
            }}
          >
            {queueLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} h={50} />)}
              </div>
            ) : filteredPickupQueue.length === 0 ? (
              <EmptyState
                icon={<Clock size={36} />}
                title="No students in queue"
                message="No student matches the active dismissal queue filter."
              />
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="op-desktop-only overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                      <tr>
                        <th className="p-3.5">Child</th>
                        <th className="p-3.5">Section</th>
                        <th className="p-3.5">Today Attendance</th>
                        <th className="p-3.5">Authorized Guardians</th>
                        <th className="p-3.5">Dismissal Status</th>
                        <th className="p-3.5 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                      {filteredPickupQueue.map((item: any) => (
                        <tr key={item.id} className="hover:bg-muted/15 transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="p-3.5 flex items-center gap-3">
                            <Avatar name={item.name} size="md" />
                            <div>
                              <div className="font-semibold text-foreground">{item.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{item.admissionNo}</div>
                            </div>
                          </td>
                          <td className="p-3.5 text-xs text-foreground font-medium">
                            {item.classroom}
                          </td>
                          <td className="p-3.5">
                            <StatusBadge status={item.attendance} />
                          </td>
                          <td className="p-3.5">
                            <div className="text-xs space-y-1">
                              {item.guardians?.map((g: any) => (
                                <div key={g.id} className="flex items-center gap-1.5">
                                  <span className={g.canPickup ? 'text-foreground font-medium' : 'text-rose-500 line-through'}>
                                    {g.name} ({g.relationship})
                                  </span>
                                  {g.canPickup ? (
                                    <span className="badge b-success text-[9px] px-1 py-0">Auth</span>
                                  ) : (
                                    <span className="badge b-danger text-[9px] px-1 py-0">Blocked</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5">
                            {item.isPickedUp ? (
                              <span className="badge b-success flex items-center gap-1 w-fit">
                                <CheckCircle2 size={12} /> Released
                              </span>
                            ) : item.isPresent ? (
                              <span className="badge b-warning flex items-center gap-1 w-fit animate-pulse">
                                <Clock size={12} /> Waiting Pickup
                              </span>
                            ) : (
                              <span className="badge b-neutral w-fit">Not Present</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {!item.isPickedUp && item.isPresent ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm flex items-center gap-1.5 ml-auto shadow-sm shadow-primary/20"
                                onClick={() => {
                                  setScannedStudent(item)
                                  setScanMode('PICKUP')
                                  if (item.guardians?.length > 0) {
                                    const authGuardian = item.guardians.find((g: any) => g.canPickup) || item.guardians[0]
                                    setSelectedGuardianId(authGuardian.id)
                                  }
                                  setScanModalOpen(true)
                                }}
                              >
                                <ShieldCheck size={14} />
                                <span>Release</span>
                              </button>
                            ) : item.isPickedUp ? (
                              <span className="text-xs text-emerald-600 font-medium">Dismissed</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card List */}
                <div className="op-mobile-only divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {filteredPickupQueue.map((item: any) => (
                    <div key={item.id} className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar name={item.name} size="md" />
                          <div>
                            <div className="font-semibold text-sm text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {item.admissionNo} • {item.classroom}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={item.attendance} />
                      </div>

                      <div className="space-y-1 text-xs">
                        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
                          Guardians:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {item.guardians?.map((g: any) => (
                            <span
                              key={g.id}
                              className={`badge text-[10px] ${g.canPickup ? 'b-neutral' : 'b-danger line-through'}`}
                            >
                              {g.name} ({g.relationship})
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          {item.isPickedUp ? (
                            <span className="badge b-success flex items-center gap-1">
                              <CheckCircle2 size={12} /> Released
                            </span>
                          ) : item.isPresent ? (
                            <span className="badge b-warning flex items-center gap-1">
                              <Clock size={12} /> Waiting Pickup
                            </span>
                          ) : (
                            <span className="badge b-neutral">Not Present</span>
                          )}
                        </div>

                        {!item.isPickedUp && item.isPresent && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm shadow-primary/20"
                            onClick={() => {
                              setScannedStudent(item)
                              setScanMode('PICKUP')
                              if (item.guardians?.length > 0) {
                                const authGuardian = item.guardians.find((g: any) => g.canPickup) || item.guardians[0]
                                setSelectedGuardianId(authGuardian.id)
                              }
                              setScanModalOpen(true)
                            }}
                          >
                            <ShieldCheck size={14} />
                            <span>Release</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 7. WORKSPACE 4: DEDICATED HIGH-SPEED GATE SCANNER MODE ── */}
      {tab === 'GATE_SCANNER' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="card rounded-3xl p-6 bg-card border border-border shadow-md space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <ScanLine size={26} />
              </div>
              <h2 className="text-xl font-bold text-foreground">Gate Mode Control</h2>
              <p className="text-xs text-muted-foreground">High-throughput barcode scanning, PIN authorization & arrival intake</p>
            </div>

            <Segmented
              value={scanMode}
              onChange={(m) => { setScanMode(m as any); setScanMessage(null) }}
              options={[
                { key: 'ARRIVAL', label: 'Morning Gate Check-In' },
                { key: 'PICKUP', label: 'Afternoon Dismissal & Release' },
              ]}
            />

            {/* High-Contrast Input Bar */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Scan Barcode, Student QR, or Type Admission #
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <QrCode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="input pl-10 h-12 text-base font-mono"
                    placeholder="Scan QR or code (e.g. STU-2026-0001)..."
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup(scanCode)}
                    autoFocus
                  />
                  {scanCode && (
                    <button
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setScanCode(''); setScannedStudent(null); setScanMessage(null) }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary h-12 px-5 font-semibold"
                  onClick={() => handleLookup(scanCode)}
                  disabled={scanLoading || !scanCode.trim()}
                >
                  {scanLoading ? 'Checking…' : 'Lookup'}
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {scanMessage && (
              <div
                className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 ${
                  scanMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-700 border border-rose-500/30'
                }`}
              >
                {scanMessage.type === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> : <ShieldAlert size={20} className="shrink-0" />}
                <div className="flex-1">
                  <div>{scanMessage.text}</div>
                  {scanMessage.details?.lateFeeAmount && (
                    <div className="text-xs font-normal mt-1 opacity-90">
                      Late pickup fee calculated: ₹{scanMessage.details.lateFeeAmount} (Invoice dispatched)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scanned Child Preview Card */}
            {scannedStudent && (
              <div className="border border-border/80 rounded-2xl p-5 bg-muted/20 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar name={scannedStudent.name} size="lg" />
                  <div>
                    <div className="font-bold text-lg text-foreground">{scannedStudent.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {scannedStudent.admissionNo} • Classroom: {scannedStudent.classroom}
                    </div>
                  </div>
                </div>

                {scanMode === 'PICKUP' && (
                  <div className="space-y-4 pt-3 border-t border-border">
                    <Field label="Authorized Guardian Collection" required>
                      <select
                        className="select"
                        value={selectedGuardianId}
                        onChange={(e) => setSelectedGuardianId(e.target.value)}
                      >
                        {scannedStudent.guardians?.map((g: any) => (
                          <option key={g.id} value={g.id} disabled={!g.canPickup}>
                            {g.name} ({g.relationship}) {g.canPickup ? '— [AUTHORIZED]' : '— [RESTRICTED / BLOCKED]'}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Security PIN Authorization" helper="Required when guardian security PIN policy is active">
                      <div className="relative">
                        <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          className="input pl-10"
                          type="password"
                          placeholder="Enter 4-digit pickup PIN..."
                          value={pickupPin}
                          onChange={(e) => setPickupPin(e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    className={`btn w-full h-12 text-base font-bold flex items-center justify-center gap-2 ${
                      scanMode === 'ARRIVAL' ? 'btn-primary' : 'btn-success'
                    }`}
                    onClick={handleExecuteScan}
                    disabled={scanLoading}
                  >
                    {scanLoading ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : scanMode === 'ARRIVAL' ? (
                      <><CheckCircle2 size={18} /> Confirm Arrival & Mark Present</>
                    ) : (
                      <><ShieldCheck size={18} /> Authorize & Release Child</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 8. DRAWER: CARE INTAKE & HISTORY (WITH PATCH / DELETE) ── */}
      <Drawer
        open={careDrawerOpen}
        onClose={() => setCareDrawerOpen(false)}
        title={`Daily Care — ${activeCareStudent?.name}`}
        subtitle={`Classroom: ${activeCareStudent?.classroom || 'Active Section'}`}
        icon={<Utensils size={20} />}
        iconClass="ic-purple"
      >
        <div className="space-y-4">
          <Segmented
            value={careDrawerTab}
            onChange={(t) => setCareDrawerTab(t as any)}
            options={[
              { key: 'HISTORY', label: `Today's Log (${activeCareStudent?.careSummary?.events?.length || 0})` },
              { key: 'LOG', label: editingCareEvent ? 'Edit Care Record' : '+ New Entry' },
            ]}
          />

          {careDrawerTab === 'HISTORY' ? (
            <div className="space-y-3">
              {activeCareStudent?.careSummary?.events?.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Utensils size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium text-foreground">No Care Events Recorded Today</p>
                  <p className="text-xs">Use the "+ New Entry" tab to record meals, naps, toilet, or hydration.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeCareStudent?.careSummary?.events?.map((ev: any) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl border border-border bg-muted/15 flex items-start justify-between gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="badge b-primary text-[10px]">{ev.type}</span>
                          <span className="font-semibold text-xs text-foreground">{ev.title}</span>
                          <span className="text-[11px] font-mono text-muted-foreground">{ev.time}</span>
                        </div>
                        {ev.body && <p className="text-xs text-muted-foreground mt-1.5">{ev.body}</p>}
                        {ev.mood && (
                          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <span>Mood:</span> <b className="text-foreground">{ev.mood}</b>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="btn btn-ghost btn-sm h-8 w-8 p-0"
                          title="Edit Care Note"
                          onClick={() => {
                            setEditingCareEvent(ev)
                            setCareType(ev.type as any)
                            setCareNotes(ev.body || '')
                            setCareMood(ev.mood || 'Happy')
                            setCareDrawerTab('LOG')
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm h-8 w-8 p-0 text-rose-500"
                          title="Delete Entry"
                          onClick={() => handleDeleteCareEvent(ev.id)}
                          disabled={careMutationLoading}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Log / Edit Care Form */
            <div className="space-y-4 pt-1">
              {editingCareEvent && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 flex items-center justify-between">
                  <span>Editing record from {editingCareEvent.time}</span>
                  <button
                    className="font-semibold underline"
                    onClick={() => { setEditingCareEvent(null); setCareNotes('') }}
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              <Field label="Care Event Type" required>
                <select
                  className="select"
                  value={careType}
                  onChange={(e) => setCareType(e.target.value as any)}
                  disabled={Boolean(editingCareEvent)}
                >
                  <option value="MEAL">Meal (Breakfast / Lunch / Snack)</option>
                  <option value="NAP">Nap / Rest Period</option>
                  <option value="BATHROOM">Bathroom / Diaper / Toilet</option>
                  <option value="WATER">Water / Hydration</option>
                  <option value="MOOD">Mood & Temperament</option>
                </select>
              </Field>

              {careType === 'MEAL' && (
                <Field label="Portion Finished">
                  <select className="select" value={careQuantity} onChange={(e) => setCareQuantity(e.target.value)}>
                    <option value="Full">Full Portion Finished (100%)</option>
                    <option value="Half">Half Portion Finished (~50%)</option>
                    <option value="Bites">Few Bites / Minimal Intake</option>
                    <option value="Refused">Refused / Did Not Eat</option>
                  </select>
                </Field>
              )}

              <Field label="Child Mood / Demeanor">
                <select className="select" value={careMood} onChange={(e) => setCareMood(e.target.value)}>
                  <option value="Happy">Happy & Active</option>
                  <option value="Calm">Calm & Content</option>
                  <option value="Sleepy">Sleepy / Fatigued</option>
                  <option value="Cranky">Fussy / Cranky</option>
                  <option value="Energetic">Very Energetic</option>
                </select>
              </Field>

              <Field label="Observation & Teacher Notes" helper="Shared with guardians on daily summary">
                <textarea
                  className="textarea"
                  placeholder="e.g. Finished vegetable khichdi, drank water after play, pleasant mood..."
                  value={careNotes}
                  onChange={(e) => setCareNotes(e.target.value)}
                  rows={3}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="btn btn-outline"
                  onClick={() => setCareDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitCare}
                  disabled={careMutationLoading}
                >
                  {careMutationLoading ? 'Saving…' : editingCareEvent ? 'Update Record' : 'Log to Sheet'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* ── 9. MODAL: HEALTH CHECK TRIAGE ── */}
      <Modal
        open={healthModalOpen}
        onClose={() => setHealthModalOpen(false)}
        title={`Health Triage — ${activeHealthStudent?.name}`}
        subtitle="Morning wellness intake & isolation protocol dispatch"
        icon={<HeartPulse size={20} />}
        iconClass="ic-danger"
      >
        <div className="space-y-4">
          <Field label="Health Outcome & Action" required>
            <select
              className="select font-semibold"
              value={healthOutcome}
              onChange={(e) => setHealthOutcome(e.target.value as any)}
            >
              <option value="CLEAR">Clear — Normal Classroom Participation</option>
              <option value="ATTENTION">Attention — Mild Symptoms / Under Close Observation</option>
              <option value="ISOLATE">Isolate — High Fever / Contagious Symptoms (Action Required)</option>
            </select>
          </Field>

          {healthOutcome === 'ISOLATE' && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>Warning: Selecting "Isolate" automatically creates an URGENT administrative exception.</span>
            </div>
          )}

          <Field label="Temperature (°F)" helper="Normal threshold is < 99.5°F. Fever flag triggers at ≥ 100.4°F">
            <div className="relative">
              <Thermometer size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input pl-10"
                type="number"
                step="0.1"
                placeholder="e.g. 98.6"
                value={healthTemp}
                onChange={(e) => setHealthTemp(e.target.value)}
              />
            </div>
          </Field>

          {/* Quick Symptom Chips */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Common Symptoms</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SYMPTOMS.map((symptom) => {
                const isSelected = healthSymptoms.includes(symptom)
                return (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => {
                      const current = healthSymptoms.split(',').map((s) => s.trim()).filter(Boolean)
                      if (isSelected) {
                        setHealthSymptoms(current.filter((s) => s !== symptom).join(', '))
                      } else {
                        setHealthSymptoms([...current, symptom].join(', '))
                      }
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 font-semibold'
                        : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {symptom}
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Observed Symptoms & Notes">
            <input
              className="input"
              placeholder="e.g. Mild cough, flushed cheeks, requested water"
              value={healthSymptoms}
              onChange={(e) => setHealthSymptoms(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button className="btn btn-outline" onClick={() => setHealthModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmitHealth} disabled={busy}>
              {busy ? 'Submitting…' : 'Record Health Check'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 10. MODAL: REPORT SAFETY INCIDENT ── */}
      <Modal
        open={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        title={`Safety Incident — ${activeIncidentStudent?.name}`}
        subtitle="Log incident with automatic escalation & guardian audit record"
        icon={<AlertTriangle size={20} />}
        iconClass="ic-danger"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" required>
              <select
                className="select"
                value={incidentCategory}
                onChange={(e) => setIncidentCategory(e.target.value as any)}
              >
                <option value="INJURY">Minor Injury / Scrape</option>
                <option value="FALL">Fall / Slip</option>
                <option value="ILLNESS">Sudden Illness</option>
                <option value="BEHAVIOR">Behavioral Episode</option>
                <option value="SAFETY">Safety Hazard</option>
              </select>
            </Field>
            <Field label="Severity Escalation" required>
              <select
                className="select font-semibold"
                value={incidentSeverity}
                onChange={(e) => setIncidentSeverity(e.target.value as any)}
              >
                <option value="LOW">Low (First-aid only)</option>
                <option value="MEDIUM">Medium (Supervision follow-up)</option>
                <option value="HIGH">High (Mandatory phone call)</option>
                <option value="CRITICAL">Critical (Emergency procedure)</option>
              </select>
            </Field>
          </div>

          <Field label="Incident Headline" required>
            <input
              className="input"
              placeholder="Brief summary (e.g. Scraped left knee on playground slide)"
              value={incidentTitle}
              onChange={(e) => setIncidentTitle(e.target.value)}
            />
          </Field>

          <Field label="Detailed Chronology & First Aid Applied" required>
            <textarea
              className="textarea"
              placeholder="Explain exactly what happened, staff witness, and immediate antiseptic applied..."
              value={incidentDesc}
              onChange={(e) => setIncidentDesc(e.target.value)}
              rows={3}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button className="btn btn-outline" onClick={() => setIncidentModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleSubmitIncident} disabled={busy}>
              {busy ? 'Logging…' : 'Log Incident & Escalate'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 11. MODAL: GATE SCANNER QUICK ACTION ── */}
      <Modal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        title="Gate Scanner — Arrival & Release"
        subtitle="Real-time child identity lookup and secure release authorization"
        icon={<ScanLine size={22} />}
        iconClass="ic-primary"
      >
        <div className="space-y-4">
          <Segmented
            value={scanMode}
            onChange={(m) => { setScanMode(m as any); setScanMessage(null) }}
            options={[
              { key: 'ARRIVAL', label: 'Morning Arrival (Check-In)' },
              { key: 'PICKUP', label: 'Afternoon Dismissal (Release)' },
            ]}
          />

          <Field label="Scan Barcode / Enter Admission No" required helper="Supports QR code, barcode, or student ID">
            <div className="flex gap-2">
              <input
                className="input font-mono"
                placeholder="Scan QR or code (e.g. STU-2026-0001)..."
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup(scanCode)}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleLookup(scanCode)}
                disabled={scanLoading || !scanCode.trim()}
              >
                {scanLoading ? 'Checking…' : 'Lookup'}
              </button>
            </div>
          </Field>

          {scanMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                scanMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              {scanMessage.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
              <span>{scanMessage.text}</span>
            </div>
          )}

          {scannedStudent && (
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={scannedStudent.name} size="lg" />
                <div>
                  <div className="font-bold text-base text-foreground">{scannedStudent.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {scannedStudent.admissionNo} · {scannedStudent.classroom}
                  </div>
                </div>
              </div>

              {scanMode === 'PICKUP' && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <Field label="Select Authorized Pickup Guardian" required>
                    <select
                      className="select"
                      value={selectedGuardianId}
                      onChange={(e) => setSelectedGuardianId(e.target.value)}
                    >
                      {scannedStudent.guardians?.map((g: any) => (
                        <option key={g.id} value={g.id} disabled={!g.canPickup}>
                          {g.name} ({g.relationship}) {g.canPickup ? '— Authorized' : '— [BLOCKED]'}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Security PIN Verification" helper="Required if guardian PIN policy is active">
                    <input
                      className="input"
                      type="password"
                      placeholder="Enter 4-digit pickup PIN..."
                      value={pickupPin}
                      onChange={(e) => setPickupPin(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExecuteScan}
                  disabled={scanLoading}
                >
                  {scanMode === 'ARRIVAL' ? (
                    <><CheckCircle2 size={14} /> Confirm Arrival</>
                  ) : (
                    <><ShieldCheck size={14} /> Authorize Pickup & Release</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── 12. MODAL: DAILY PARENT REPORT PREVIEW ── */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={`Parent Daily Sheet — ${activeReportStudent?.name}`}
        subtitle="Real-time parent portal view (privacy-filtered)"
        icon={<FileText size={20} />}
        iconClass="ic-primary"
      >
        {reportLoading ? (
          <div className="space-y-3">
            <Skeleton h={40} />
            <Skeleton h={80} />
            <Skeleton h={80} />
          </div>
        ) : reportData ? (
          <div className="space-y-4 text-sm">
            <div className="p-3.5 bg-muted/40 rounded-xl border border-border flex justify-between items-center text-xs">
              <div>Class: <b className="text-foreground">{reportData.student.classroom}</b></div>
              <div>Attendance: <StatusBadge status={reportData.attendance} /></div>
            </div>

            <div>
              <div className="font-semibold text-xs text-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Utensils size={13} className="text-primary" /> Meals & Nutrition:
              </div>
              {reportData.meals?.length ? (
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {reportData.meals.map((m: string, i: number) => <li key={i}>{m}</li>)}
                </ul>
              ) : <p className="text-xs text-muted-foreground italic">No meal logs recorded for today.</p>}
            </div>

            <div>
              <div className="font-semibold text-xs text-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Moon size={13} className="text-primary" /> Rest & Nap:
              </div>
              {reportData.naps?.length ? (
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {reportData.naps.map((n: string, i: number) => <li key={i}>{n}</li>)}
                </ul>
              ) : <p className="text-xs text-muted-foreground italic">No nap logs recorded for today.</p>}
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Dismissal Status:</span>
              <span className="font-medium text-foreground">{reportData.pickup}</span>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
