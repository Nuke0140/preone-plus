'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  Users,
  Plus,
  BookOpen,
  Eye,
  History as HistoryIcon,
  Sparkles,
  Save,
  Filter,
  RefreshCw,
  Building2,
  CheckSquare,
  FileText,
  Calendar,
  Layers,
  Search,
  Check,
  Edit3,
  Trash2,
  Minus,
} from 'lucide-react'
import { PageHead, Avatar } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { isoDate, enumLabel } from '@/lib/format'

function getFormattedDayAndDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

interface UserContext {
  id: string
  name: string
  email: string
  role: string
  isTeacher: boolean
  isAdmin: boolean
}

interface ClassroomMeta {
  id: string
  name: string
  code: string
  programType: string
  capacity: number
  branchId: string
  academicSessionId: string
  primaryTeacherId: string | null
  teacherName: string
  studentCount: number
}

interface BranchMeta {
  id: string
  name: string
  code: string
  isMain: boolean
}

interface TeacherMeta {
  id: string
  fullName: string
  email: string | null
}

interface SubjectMeta {
  id: string
  name: string
  code: string
  shortName: string | null
  subjectType: string
}

interface ContextData {
  user: UserContext
  academicSession: { id: string; name: string; isCurrent: boolean } | null
  branches: BranchMeta[]
  classrooms: ClassroomMeta[]
  teachers: TeacherMeta[]
  subjects?: SubjectMeta[]
}

interface OverviewData {
  classroom: {
    id: string
    name: string
    code: string
    programType: string
    capacity: number
    teacherName: string
    teacherId: string | null
    branchName?: string
    sessionName?: string
  }
  date: string
  stats: {
    totalStudents: number
    present: number
    absent: number
    late: number
    halfDay: number
    unmarked: number
    totalActivities: number
    coreSubjectsCount?: number
    activitiesCount?: number
    completedActivities: number
    totalObservations: number
  }
  activities: {
    id: string
    title: string
    activityType: string
    startTime: string
    endTime: string
    teacherId?: string | null
    teacherName: string
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
    description: string | null
    actualOutcome: string | null
  }[]
  observations: {
    id: string
    studentId?: string | null
    studentName: string
    narrative: string
    category: string
    concern: string
    observedAt: string
  }[]
}

interface AttendanceStudent {
  studentId: string
  firstName: string
  lastName: string | null
  name: string
  admissionNo: string
  photoUrl: string | null
  gender: string | null
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | null
  notes: string
  markedAt: string | null
  markedById: string | null
}

interface HistoryData {
  attendance: {
    id: string
    date: string
    studentName: string
    admissionNo: string
    status: string
    notes: string | null
  }[]
  activities: {
    id: string
    date: string
    title: string
    activityType: string
    status: string
    actualOutcome: string | null
    teacherName: string
  }[]
  observations: {
    id: string
    date: string
    studentName: string
    narrative: string
    category: string
    concern: string
  }[]
}

interface ScheduleRow {
  id: string
  subjectName: string
  startTime: string
  endTime: string
  activityType: string
}

export default function DailyDiaryPage() {
  const toast = useToast()

  // Context & Selection States
  const [context, setContext] = useState<ContextData | null>(null)
  const [loadingContext, setLoadingContext] = useState(true)

  const [selectedDate, setSelectedDate] = useState<string>(isoDate())
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [adminViewMode, setAdminViewMode] = useState<'school' | 'class'>('class')

  // Active Tab: overview | subjects | builder | attendance | observations | history | timetable
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'builder' | 'attendance' | 'observations' | 'history' | 'timetable'>('overview')

  // Data States
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)

  // Attendance Register State
  const [attendanceRegister, setAttendanceRegister] = useState<AttendanceStudent[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)

  // Admin School Overview State
  const [adminOverview, setAdminOverview] = useState<any>(null)
  const [loadingAdminOverview, setLoadingAdminOverview] = useState(false)
  const [schoolOverviewSearch, setSchoolOverviewSearch] = useState('')

  // History State
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Report & Schedule Filters
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('ALL')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL')

  // Reusable Subjects State
  const [subjects, setSubjects] = useState<SubjectMeta[]>([])
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false)
  const [showEditSubjectModal, setShowEditSubjectModal] = useState<SubjectMeta | null>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectType, setNewSubjectType] = useState('CORE')
  const [editSubjectName, setEditSubjectName] = useState('')
  const [editSubjectType, setEditSubjectType] = useState('CORE')
  const [submittingSubject, setSubmittingSubject] = useState(false)

  // Daily Schedule Builder State (Multi-Row Table)
  const [showScheduleBuilderModal, setShowScheduleBuilderModal] = useState(false)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([
    { id: '1', subjectName: '', startTime: '09:00', endTime: '10:00', activityType: 'CORE_SUBJECT' },
  ])
  const [submittingScheduleBuilder, setSubmittingScheduleBuilder] = useState(false)

  // Single Edit / Complete / Observation Modals
  const [showEditActivityModal, setShowEditActivityModal] = useState(false)
  const [showObservationModal, setShowObservationModal] = useState(false)
  const [showCompleteActivityModal, setShowCompleteActivityModal] = useState<string | null>(null)
  const [activityNotesInput, setActivityNotesInput] = useState('')

  // Single Edit Activity Inputs
  const [editActId, setEditActId] = useState('')
  const [editActTitle, setEditActTitle] = useState('')
  const [editActType, setEditActType] = useState('CORE_SUBJECT')
  const [editActStartTime, setEditActStartTime] = useState('09:00')
  const [editActEndTime, setEditActEndTime] = useState('10:00')
  const [editActTeacherId, setEditActTeacherId] = useState('')
  const [editActDesc, setEditActDesc] = useState('')
  const [submittingEditAct, setSubmittingEditAct] = useState(false)

  // Form Inputs: Add Observation
  const [obsStudentId, setObsStudentId] = useState('')
  const [obsNarrative, setObsNarrative] = useState('')
  const [obsCategory, setObsCategory] = useState('General')
  const [obsConcern, setObsConcern] = useState('NORMAL')
  const [submittingObs, setSubmittingObs] = useState(false)

  // Load Context on Mount
  const fetchContext = useCallback(async () => {
    try {
      setLoadingContext(true)
      const res = await fetch('/api/v1/daily-diary/context')
      const json = await res.json()

      if (json.success && json.data) {
        const ctx: ContextData = json.data
        setContext(ctx)

        if (ctx.user.isAdmin && !ctx.user.isTeacher) {
          setAdminViewMode('school')
        }

        if (ctx.classrooms.length > 0) {
          setSelectedClassroomId(ctx.classrooms[0].id)
        }
        if (ctx.subjects) {
          setSubjects(ctx.subjects)
        }
      } else {
        toast.error('Error', json.error?.message || 'Failed to initialize Daily Diary')
      }
    } catch {
      toast.error('Error', 'Failed to load initial context')
    } finally {
      setLoadingContext(false)
    }
  }, [toast])

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/subjects')
      const json = await res.json()
      if (json.success && json.data) {
        setSubjects(json.data)
      }
    } catch {
      // quiet fallback
    }
  }, [])

  useEffect(() => {
    fetchContext()
    fetchSubjects()
  }, [fetchContext, fetchSubjects])

  // Load Overview whenever classroomId or selectedDate changes
  const loadOverview = useCallback(async () => {
    if (!selectedClassroomId || !selectedDate) return
    try {
      setLoadingOverview(true)
      const res = await fetch(`/api/v1/daily-diary/overview?classroomId=${selectedClassroomId}&date=${selectedDate}`)
      const json = await res.json()
      if (json.success && json.data) {
        setOverview(json.data)
      } else {
        toast.error('Failed to load overview', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Failed to fetch overview data')
    } finally {
      setLoadingOverview(false)
    }
  }, [selectedClassroomId, selectedDate, toast])

  // Load Attendance Register
  const loadAttendance = useCallback(async () => {
    if (!selectedClassroomId || !selectedDate) return
    try {
      setLoadingAttendance(true)
      const res = await fetch(`/api/v1/daily-diary/attendance?classroomId=${selectedClassroomId}&date=${selectedDate}`)
      const json = await res.json()
      if (json.success && json.data) {
        setAttendanceRegister(json.data)
      }
    } catch {
      toast.error('Error', 'Failed to fetch attendance register')
    } finally {
      setLoadingAttendance(false)
    }
  }, [selectedClassroomId, selectedDate, toast])

  // Load Admin School Overview
  const loadAdminOverview = useCallback(async () => {
    if (!selectedDate) return
    try {
      setLoadingAdminOverview(true)
      const url = `/api/v1/daily-diary/admin-overview?date=${selectedDate}${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && json.data) {
        setAdminOverview(json.data)
      }
    } catch {
      toast.error('Error', 'Failed to fetch school overview')
    } finally {
      setLoadingAdminOverview(false)
    }
  }, [selectedDate, selectedBranchId, toast])

  // Load History Data
  const loadHistory = useCallback(async () => {
    if (!selectedClassroomId) return
    try {
      setLoadingHistory(true)
      const res = await fetch(`/api/v1/daily-diary/history?classroomId=${selectedClassroomId}&startDate=${selectedDate}&endDate=${selectedDate}`)
      const json = await res.json()
      if (json.success && json.data) {
        setHistoryData(json.data)
      }
    } catch {
      toast.error('Error', 'Failed to fetch history')
    } finally {
      setLoadingHistory(false)
    }
  }, [selectedClassroomId, selectedDate, toast])

  // Trigger Data Fetching on Selection Changes
  useEffect(() => {
    if (adminViewMode === 'school') {
      loadAdminOverview()
    } else {
      if (activeTab === 'overview' || activeTab === 'timetable' || activeTab === 'builder') {
        loadOverview()
      }
      if (activeTab === 'subjects') {
        fetchSubjects()
      }
      if (activeTab === 'attendance') {
        loadAttendance()
        loadOverview()
      }
      if (activeTab === 'observations') {
        loadOverview()
      }
      if (activeTab === 'history') {
        loadHistory()
      }
    }
  }, [selectedClassroomId, selectedDate, activeTab, adminViewMode, selectedBranchId, loadOverview, loadAttendance, loadAdminOverview, loadHistory, fetchSubjects])

  // Sync builder rows whenever classroom overview activities change
  useEffect(() => {
    if (overview?.activities && overview.activities.length > 0) {
      setScheduleRows(
        overview.activities.map((act) => ({
          id: act.id,
          subjectName: act.title,
          startTime: act.startTime,
          endTime: act.endTime,
          activityType: act.activityType || 'CORE_SUBJECT',
        }))
      )
    } else {
      const initialSub = subjects[0]?.name || ''
      setScheduleRows([
        { id: '1', subjectName: initialSub, startTime: '09:00', endTime: '10:00', activityType: 'CORE_SUBJECT' },
      ])
    }
  }, [overview?.activities, selectedClassroomId, selectedDate, subjects])

  // Date Navigation Handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(isoDate(d))
  }

  const handleNextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(isoDate(d))
  }

  // Attendance Register Actions
  const handleMarkAllPresent = () => {
    setAttendanceRegister((prev) =>
      prev.map((s) => ({ ...s, status: 'PRESENT' }))
    )
  }

  const handleSetStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY') => {
    setAttendanceRegister((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    )
  }

  const handleSetStudentNotes = (studentId: string, notes: string) => {
    setAttendanceRegister((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, notes } : s))
    )
  }

  const handleSaveAttendance = async () => {
    if (!selectedClassroomId) return
    try {
      setSavingAttendance(true)
      const records = attendanceRegister.map((s) => ({
        studentId: s.studentId,
        status: s.status || 'PRESENT',
        notes: s.notes,
      }))

      const res = await fetch('/api/v1/daily-diary/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: selectedClassroomId,
          date: selectedDate,
          records,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Attendance Saved', `Updated attendance for ${json.data?.count || records.length} students.`)
        loadOverview()
      } else {
        toast.error('Save Failed', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Could not save attendance register')
    } finally {
      setSavingAttendance(false)
    }
  }

  // Manage Subjects Actions
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newSubjectName.trim()
    if (!name) {
      toast.error('Validation Error', 'Subject name is required')
      return
    }

    // Duplicate Check
    const exists = subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      toast.error('Duplicate Subject', `"${name}" already exists in your subject list.`)
      return
    }

    try {
      setSubmittingSubject(true)
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15) || 'SUB'
      const res = await fetch('/api/v1/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: `${code}_${Date.now().toString().slice(-4)}`,
          subjectType: newSubjectType,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Subject Created', `"${name}" added to reusable subjects list.`)
        setShowAddSubjectModal(false)
        setNewSubjectName('')
        fetchSubjects()
      } else {
        toast.error('Failed to Create Subject', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Could not create subject')
    } finally {
      setSubmittingSubject(false)
    }
  }

  const handleEditSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showEditSubjectModal || !editSubjectName.trim()) return

    try {
      setSubmittingSubject(true)
      const res = await fetch(`/api/v1/subjects/${showEditSubjectModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editSubjectName.trim(),
          subjectType: editSubjectType,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Subject Updated', `Subject renamed to "${editSubjectName.trim()}".`)
        setShowEditSubjectModal(null)
        fetchSubjects()
        loadOverview()
      } else {
        toast.error('Update Failed', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Failed to update subject')
    } finally {
      setSubmittingSubject(false)
    }
  }

  const handleRemoveSubject = async (sub: SubjectMeta) => {
    if (!confirm(`Remove "${sub.name}" from the subject list? Existing historical daily diary records will still retain this name.`)) return
    try {
      const res = await fetch(`/api/v1/subjects/${sub.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Subject Removed', `"${sub.name}" removed from subject list.`)
        fetchSubjects()
      } else {
        toast.error('Remove Failed', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Could not remove subject')
    }
  }

  // Daily Schedule Builder Actions (Multi-Row Table)
  const handleOpenScheduleBuilder = (targetClassId?: string) => {
    if (targetClassId) setSelectedClassroomId(targetClassId)
    const initialSub = subjects[0]?.name || ''
    setScheduleRows([
      { id: '1', subjectName: initialSub, startTime: '09:00', endTime: '10:00', activityType: 'CORE_SUBJECT' },
    ])
    setShowScheduleBuilderModal(true)
  }

  const handleAddScheduleRow = () => {
    const lastRow = scheduleRows[scheduleRows.length - 1]
    let nextStart = '10:00'
    let nextEnd = '11:00'
    if (lastRow && lastRow.endTime) {
      nextStart = lastRow.endTime
      const [h, m] = lastRow.endTime.split(':').map((n) => parseInt(n, 10) || 0)
      const endH = (h + 1) % 24
      nextEnd = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    const initialSub = subjects[0]?.name || ''
    setScheduleRows((prev) => [
      ...prev,
      { id: String(Date.now()), subjectName: initialSub, startTime: nextStart, endTime: nextEnd, activityType: 'CORE_SUBJECT' },
    ])
  }

  const handleRemoveScheduleRow = (index: number) => {
    setScheduleRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateScheduleRow = (index: number, field: keyof ScheduleRow, value: string) => {
    setScheduleRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleSaveScheduleBuilder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassroomId) {
      toast.error('Validation Error', 'Please select a classroom')
      return
    }

    // Validate rows
    for (let i = 0; i < scheduleRows.length; i++) {
      const row = scheduleRows[i]
      if (!row.subjectName.trim()) {
        toast.error('Validation Error', `Row ${i + 1}: Subject selection is required`)
        return
      }
      if (!row.startTime || !row.endTime) {
        toast.error('Validation Error', `Row ${i + 1}: Start and End times are required`)
        return
      }
    }

    try {
      setSubmittingScheduleBuilder(true)
      const res = await fetch('/api/v1/daily-diary/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: selectedClassroomId,
          date: selectedDate,
          activities: scheduleRows.map((r) => ({
            title: r.subjectName.trim(),
            activityType: r.activityType,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Schedule Saved', `Added ${scheduleRows.length} activity entries to today's timetable.`)
        setShowScheduleBuilderModal(false)
        if (activeTab === 'builder') setActiveTab('overview')
        loadOverview()
        if (adminViewMode === 'school') loadAdminOverview()
      } else {
        toast.error('Save Failed', json.error?.message || 'Failed to save schedule builder rows')
      }
    } catch {
      toast.error('Error', 'Failed to save daily schedule builder')
    } finally {
      setSubmittingScheduleBuilder(false)
    }
  }

  // Single Edit / Delete / Status Actions
  const handleOpenEditActivityModal = (act: any) => {
    setEditActId(act.id)
    setEditActTitle(act.title)
    setEditActType(act.activityType || 'CORE_SUBJECT')
    setEditActStartTime(act.startTime || '09:00')
    setEditActEndTime(act.endTime || '10:00')
    setEditActTeacherId(act.teacherId || '')
    setEditActDesc(act.description || '')
    setShowEditActivityModal(true)
  }

  const handleEditActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editActId || !editActTitle.trim()) return
    try {
      setSubmittingEditAct(true)
      const res = await fetch(`/api/v1/daily-diary/activities/${editActId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editActTitle,
          activityType: editActType,
          startTime: editActStartTime,
          endTime: editActEndTime,
          teacherId: editActTeacherId || undefined,
          description: editActDesc,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Activity Updated', `"${editActTitle}" updated successfully.`)
        setShowEditActivityModal(false)
        loadOverview()
        if (adminViewMode === 'school') loadAdminOverview()
      } else {
        toast.error('Update Failed', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Failed to update activity')
    } finally {
      setSubmittingEditAct(false)
    }
  }

  const handleDeleteActivity = async (activityId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return
    try {
      const res = await fetch(`/api/v1/daily-diary/activities/${activityId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Activity Deleted', `"${title}" removed from timetable.`)
        loadOverview()
        if (adminViewMode === 'school') loadAdminOverview()
      } else {
        toast.error('Failed to Delete', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Failed to delete activity')
    }
  }

  const handleUpdateActivityStatus = async (activityId: string, status: string, notes?: string) => {
    try {
      const res = await fetch(`/api/v1/daily-diary/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Activity Updated', `Activity status changed to ${status}.`)
        setShowCompleteActivityModal(null)
        setActivityNotesInput('')
        loadOverview()
      } else {
        toast.error('Update Failed', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Could not update activity status')
    }
  }

  // Observation Actions
  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!obsNarrative.trim() || !selectedClassroomId) return
    try {
      setSubmittingObs(true)
      const res = await fetch('/api/v1/daily-diary/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: obsStudentId || undefined,
          classroomId: selectedClassroomId,
          narrative: obsNarrative,
          category: obsCategory,
          concern: obsConcern,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Observation Recorded', 'Observation saved successfully.')
        setShowObservationModal(false)
        setObsNarrative('')
        loadOverview()
      } else {
        toast.error('Failed', json.error?.message)
      }
    } catch {
      toast.error('Error', 'Failed to save observation')
    } finally {
      setSubmittingObs(false)
    }
  }

  if (loadingContext) {
    return (
      <div className="space-y-6">
        <PageHead title="Daily Diary" sub="Loading daily classroom activities..." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="glass-panel p-6 animate-pulse h-28" />
          ))}
        </div>
        <div className="glass-panel p-8 animate-pulse h-64" />
      </div>
    )
  }

  const user = context?.user
  const classrooms = context?.classrooms || []
  const currentClass = classrooms.find((c) => c.id === selectedClassroomId) || classrooms[0]

  const totalSchoolStudents = adminOverview?.stats?.totalStudents || 0
  const presentCount = adminOverview?.stats?.present || 0
  const absentCount = adminOverview?.stats?.absent || 0
  const lateCount = adminOverview?.stats?.late || 0

  const presentPercent = totalSchoolStudents > 0 ? Math.round((presentCount / totalSchoolStudents) * 100) : 0
  const absentPercent = totalSchoolStudents > 0 ? Math.round((absentCount / totalSchoolStudents) * 100) : 0
  const latePercent = totalSchoolStudents > 0 ? Math.round((lateCount / totalSchoolStudents) * 100) : 0

  const filteredClasses = (adminOverview?.classes || []).filter((c: any) => {
    if (!schoolOverviewSearch.trim()) return true
    const q = schoolOverviewSearch.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.teacherName?.toLowerCase().includes(q) ||
      c.programType?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 pb-12">
      {/* ── PREONE PAGE HEADER ── */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Eyebrow & Academic Session Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              ACADEMICS • M04
            </span>
            {context?.academicSession && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
                {context.academicSession.name}
              </span>
            )}
          </div>

          {/* Main Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 shadow-2xs">
              <CalendarCheck size={20} className="stroke-[2.2]" />
            </span>
            Daily Diary
          </h1>

          {/* Secondary Description */}
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {user?.isTeacher ? (
              <>
                Teacher: <strong className="text-slate-800 dark:text-slate-200">{user.name}</strong> • Class:{' '}
                <strong className="text-slate-800 dark:text-slate-200">{currentClass?.name || 'Unassigned'}</strong>
              </>
            ) : (
              <>School-wide Daily Activity & Operational Command Center</>
            )}
          </p>
        </div>

        {/* Header Right Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Admin Mode Switcher: School Overview vs Class View */}
          {user?.isAdmin && (
            <div className="inline-flex p-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-2xs">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                  adminViewMode === 'school'
                    ? 'bg-purple-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
                onClick={() => setAdminViewMode('school')}
              >
                <Building2 size={13} /> School Overview
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                  adminViewMode === 'class'
                    ? 'bg-purple-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
                onClick={() => setAdminViewMode('class')}
              >
                <Users size={13} /> Class View
              </button>
            </div>
          )}

          {/* Compact Date Navigation: [←] [📅 Date] [→] [Today] */}
          <div className="inline-flex items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-1 shadow-xs">
            <button
              type="button"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={handlePrevDay}
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>

            <label className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors">
              <Calendar size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 select-none">
                {getFormattedDayAndDate(selectedDate)}
              </span>
              <input
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Select date"
              />
            </label>

            <button
              type="button"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={handleNextDay}
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="ml-1 px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors"
              onClick={() => setSelectedDate(isoDate())}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* ── ADMIN SCHOOL OVERVIEW WORKSPACE ── */}
      {adminViewMode === 'school' && user?.isAdmin ? (
        <div className="space-y-6">
          {/* Branch & Actions Bar */}
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {context?.branches && context.branches.length > 0 && (
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Branch:</span>
                  <div className="relative w-full sm:w-72">
                    <select
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer appearance-none pr-8"
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                      <option value="">🏫 All Branches</option>
                      {context.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▾
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs transition-colors"
                onClick={() => setActiveTab('subjects')}
              >
                <BookOpen size={14} className="text-purple-600 dark:text-purple-400" /> Manage Subjects
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-2xs hover:shadow-xs transition-all"
                onClick={() => handleOpenScheduleBuilder()}
              >
                <Plus size={15} /> Schedule Activity
              </button>
            </div>
          </div>

          {/* School Overview KPI Metric Rail (7 Cards) */}
          {loadingAdminOverview ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <div key={n} className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 animate-pulse h-28" />
              ))}
            </div>
          ) : adminOverview ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
              {/* 1. Classes */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                    <Building2 size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {adminOverview.stats.totalClasses}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Classes
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    Across all programs
                  </div>
                </div>
              </div>

              {/* 2. Total Students */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                    <Users size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {adminOverview.stats.totalStudents}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Total Students
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    Enrolled learners
                  </div>
                </div>
              </div>

              {/* 3. Present */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {presentCount}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Present
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {presentPercent}% attendance
                  </div>
                </div>
              </div>

              {/* 4. Absent (Calm zero styling) */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    absentCount > 0
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    <XCircle size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    absentCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {absentCount}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Absent
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {absentPercent}% absent
                  </div>
                </div>
              </div>

              {/* 5. Late (Calm zero styling) */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    lateCount > 0
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    <Clock size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    lateCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {lateCount}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Late
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {latePercent}% late
                  </div>
                </div>
              </div>

              {/* 6. Core Subjects */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                    <BookOpen size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
                    {adminOverview.stats.coreSubjectsCount || 0}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Core Subjects
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    Recorded today
                  </div>
                </div>
              </div>

              {/* 7. Activities */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300">
                    <Sparkles size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-pink-600 dark:text-pink-400">
                    {adminOverview.stats.activitiesCount || 0}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Activities
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    Recorded today
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── CLASSROOMS WORKSPACE CARD (TABLE & RESPONSIVE MOBILE CARDS) ── */}
          {adminOverview && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              {/* Workspace Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300">
                      <Building2 size={16} />
                    </span>
                    Classrooms Daily Overview
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    View attendance, activities and teaching plans for all classrooms at a glance • {getFormattedDayAndDate(selectedDate)}
                  </p>
                </div>

                {/* Table Search Input */}
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    className="w-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-2xs"
                    placeholder="Search class, teacher, program..."
                    value={schoolOverviewSearch}
                    onChange={(e) => setSchoolOverviewSearch(e.target.value)}
                  />
                  {schoolOverviewSearch && (
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                      onClick={() => setSchoolOverviewSearch('')}
                      aria-label="Clear search"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop & Tablet Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 min-w-[200px]">Classroom</th>
                      <th className="py-3.5 px-4 min-w-[170px]">Teacher</th>
                      <th className="py-3.5 px-4 text-center w-28">Students</th>
                      <th className="py-3.5 px-4 text-center w-28">Present</th>
                      <th className="py-3.5 px-4 text-center w-28">Absent</th>
                      <th className="py-3.5 px-4 text-center w-28">Late</th>
                      <th className="py-3.5 px-4 text-center min-w-[170px]">Core / Activities</th>
                      <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {filteredClasses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No classrooms found matching &quot;{schoolOverviewSearch}&quot;
                        </td>
                      </tr>
                    ) : (
                      filteredClasses.map((c: any) => (
                        <tr
                          key={c.id}
                          className="hover:bg-purple-50/25 dark:hover:bg-purple-950/20 transition-colors group"
                        >
                          {/* Classroom Identity */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-100/70 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                <Building2 size={16} />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                  {c.name}
                                </div>
                                {c.programType && (
                                  <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                    {enumLabel(c.programType)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Teacher Identity */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={c.teacherName} size="sm" />
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {c.teacherName || 'Unassigned'}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                  Class Teacher
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Students Number */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">
                                {c.studentCount}
                              </span>
                              <span className="text-[10px] text-slate-400">students</span>
                            </div>
                          </td>

                          {/* Present Mini-Card */}
                          <td className="py-3.5 px-4 text-center">
                            {c.present > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                {c.present}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400 border border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800/60 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                0
                              </span>
                            )}
                          </td>

                          {/* Absent Mini-Card (Calm zero) */}
                          <td className="py-3.5 px-4 text-center">
                            {c.absent > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                {c.absent}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400 border border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800/60 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                0
                              </span>
                            )}
                          </td>

                          {/* Late Mini-Card (Calm zero) */}
                          <td className="py-3.5 px-4 text-center">
                            {c.late > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                {c.late}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400 border border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800/60 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                0
                              </span>
                            )}
                          </td>

                          {/* Core / Activities */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center justify-center gap-2 text-xs font-mono">
                              <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                                <BookOpen size={12} className="stroke-[2.5]" />
                                {c.coreSubjectsCount || 0} Core
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                                <Sparkles size={12} className="stroke-[2.5]" />
                                {c.nonCoreActivitiesCount || 0} Act
                              </span>
                            </div>
                          </td>

                          {/* Actions: [ Open Class → ] */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-purple-600 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/60 dark:hover:bg-purple-950/40 transition-all shadow-2xs"
                              onClick={() => {
                                setSelectedClassroomId(c.id)
                                setAdminViewMode('class')
                                setActiveTab('overview')
                              }}
                            >
                              Open Class
                              <ChevronRight size={13} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards View (< 768px) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60 p-3 space-y-3">
                {filteredClasses.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    No classrooms found matching &quot;{schoolOverviewSearch}&quot;
                  </div>
                ) : (
                  filteredClasses.map((c: any) => (
                    <div
                      key={c.id}
                      className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                    >
                      {/* Card Top: Class info & Open Arrow */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-purple-100/70 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                              {c.name}
                            </h4>
                            {c.programType && (
                              <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-950/60 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                                {enumLabel(c.programType)}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg transition-colors"
                          onClick={() => {
                            setSelectedClassroomId(c.id)
                            setAdminViewMode('class')
                            setActiveTab('overview')
                          }}
                          aria-label={`Open ${c.name}`}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      {/* Teacher & Total Students */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                        <div className="flex items-center gap-2">
                          <Avatar name={c.teacherName} size="sm" />
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {c.teacherName || 'Unassigned'}
                            </div>
                            <div className="text-[10px] text-slate-400">Class Teacher</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">
                            {c.studentCount}
                          </div>
                          <div className="text-[10px] text-slate-400">Students</div>
                        </div>
                      </div>

                      {/* Attendance Mini-cards in 3 columns */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className={`p-2 rounded-xl text-center border ${
                          c.present > 0
                            ? 'bg-emerald-50/80 border-emerald-200/70 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-300'
                            : 'bg-slate-100/70 border-slate-200/60 text-slate-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-400'
                        }`}>
                          <div className="text-[10px] font-semibold uppercase tracking-wider">Present</div>
                          <div className="text-base font-extrabold font-mono mt-0.5">{c.present}</div>
                        </div>

                        <div className={`p-2 rounded-xl text-center border ${
                          c.absent > 0
                            ? 'bg-rose-50/80 border-rose-200/70 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800/50 dark:text-rose-300'
                            : 'bg-slate-100/70 border-slate-200/60 text-slate-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-400'
                        }`}>
                          <div className="text-[10px] font-semibold uppercase tracking-wider">Absent</div>
                          <div className="text-base font-extrabold font-mono mt-0.5">{c.absent}</div>
                        </div>

                        <div className={`p-2 rounded-xl text-center border ${
                          c.late > 0
                            ? 'bg-amber-50/80 border-amber-200/70 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-300'
                            : 'bg-slate-100/70 border-slate-200/60 text-slate-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-400'
                        }`}>
                          <div className="text-[10px] font-semibold uppercase tracking-wider">Late</div>
                          <div className="text-base font-extrabold font-mono mt-0.5">{c.late}</div>
                        </div>
                      </div>

                      {/* Core / Activities & Open Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {c.coreSubjectsCount || 0} Core
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {c.nonCoreActivitiesCount || 0} Activities
                          </span>
                        </div>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-purple-600 hover:border-purple-300 transition-all shadow-2xs"
                          onClick={() => {
                            setSelectedClassroomId(c.id)
                            setAdminViewMode('class')
                            setActiveTab('overview')
                          }}
                        >
                          Open Class
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* CLASSROOM VIEW (TEACHER OR SELECTED ADMIN CLASS) */
        <div className="space-y-6">
          {/* Class Selector Header */}
          <div className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Classroom:</span>
              <select
                className="select select-sm text-xs font-bold min-w-[200px]"
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.teacherName})
                  </option>
                ))}
              </select>
            </div>

            {/* Tab Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-1 bg-background/60 p-1 border border-border rounded-xl">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('overview')}
              >
                <BookOpen size={14} className="mr-1.5" /> Overview
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'subjects' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('subjects')}
              >
                <BookOpen size={14} className="mr-1.5" /> Manage Subjects
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'builder' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setActiveTab('builder')
                  fetchSubjects()
                }}
              >
                <Clock size={14} className="mr-1.5" /> Schedule Activity
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'attendance' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('attendance')}
              >
                <UserCheck size={14} className="mr-1.5" /> Attendance
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'observations' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('observations')}
              >
                <FileText size={14} className="mr-1.5" /> Observations
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('history')}
              >
                <HistoryIcon size={14} className="mr-1.5" /> History
              </button>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {overview && (
                <>

                  {/* Today's Activities & Quick Observations Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Visual Daily Schedule Chart & Timetable Widget */}
                    <div className="lg:col-span-2 glass-panel p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Clock size={18} className="text-primary" /> Daily Schedule & Activity Chart
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Visual daily timetable breakdown for {currentClass?.name} ({selectedDate})
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          onClick={() => handleOpenScheduleBuilder()}
                        >
                          <Plus size={13} /> Schedule Activity
                        </button>
                      </div>

                      {overview.activities.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-xl bg-card/20 space-y-2">
                          <Clock className="mx-auto text-muted-foreground/60" size={36} />
                          <p className="text-sm font-semibold text-foreground">No Schedule Chart Created Yet</p>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Build a multi-row daily timetable using your subject list to generate today&apos;s activity chart.
                          </p>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary mt-2"
                            onClick={() => handleOpenScheduleBuilder()}
                          >
                            <Plus size={14} /> Schedule Activity Now
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* VISUAL TIMELINE BAR CHART */}
                          <div className="p-4 rounded-xl border border-border bg-card/50 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              <span>Daily Schedule Progression Chart</span>
                              <span>{overview.activities.length} Scheduled Entries</span>
                            </div>
                            
                            {/* Horizontal Chart Bar */}
                            <div className="flex items-center gap-1.5 h-10 w-full bg-muted/60 p-1.5 rounded-lg border border-border overflow-x-auto">
                              {overview.activities.map((act) => {
                                const isCore = ['CORE_TEACHING', 'CORE_SUBJECT'].includes(act.activityType)
                                const isCompleted = act.status === 'COMPLETED'
                                return (
                                  <div
                                    key={act.id}
                                    className={`h-full min-w-[90px] flex-1 rounded px-2 flex items-center justify-between text-[11px] font-semibold text-white transition-all cursor-pointer shadow-sm hover:opacity-90 ${
                                      isCompleted
                                        ? 'bg-emerald-600 dark:bg-emerald-700'
                                        : isCore
                                        ? 'bg-indigo-600 dark:bg-indigo-700'
                                        : 'bg-purple-600 dark:bg-purple-700'
                                    }`}
                                    title={`${act.startTime} - ${act.endTime}: ${act.title} (${isCompleted ? 'Completed' : 'Planned'})`}
                                    onClick={() => handleOpenEditActivityModal(act)}
                                  >
                                    <span className="truncate">{act.title}</span>
                                    <span className="text-[9px] opacity-85 font-mono ml-1">{act.startTime}</span>
                                  </div>
                                )
                              })}
                            </div>
                            
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                              <span>08:00 AM</span>
                              <span>12:00 PM</span>
                              <span>04:00 PM</span>
                            </div>
                          </div>

                          {/* TIMETABLE SCHEDULE ROW LIST WITH EDIT/DELETE ACTIONS */}
                          <div className="space-y-2.5">
                            {overview.activities.map((act, idx) => (
                              <div
                                key={act.id}
                                className="p-3.5 rounded-xl border border-border bg-card/40 hover:bg-card/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                                      {act.startTime} – {act.endTime}
                                    </span>
                                    <span className={`badge text-[10px] font-semibold uppercase ${['CORE_TEACHING', 'CORE_SUBJECT'].includes(act.activityType) ? 'b-indigo' : 'b-purple'}`}>
                                      {act.activityType === 'CORE_TEACHING' || act.activityType === 'CORE_SUBJECT' ? 'Core Subject' : act.activityType.replace('_', ' ')}
                                    </span>
                                    {act.teacherName && (
                                      <span className="text-[11px] text-muted-foreground">
                                        • Teacher: <strong className="text-foreground">{act.teacherName}</strong>
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                    <span className="text-muted-foreground text-xs font-mono">{idx + 1}.</span> {act.title}
                                  </h4>
                                  {act.description && (
                                    <p className="text-xs text-muted-foreground">{act.description}</p>
                                  )}
                                  {act.actualOutcome && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Notes: {act.actualOutcome}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
                                  {act.status === 'COMPLETED' ? (
                                    <span className="badge b-success text-xs font-semibold">
                                      <CheckCircle2 size={13} className="mr-1 inline" /> Completed
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline"
                                      onClick={() => setShowCompleteActivityModal(act.id)}
                                    >
                                      Mark Done
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="btn btn-icon btn-icon-xs btn-icon-ghost"
                                    onClick={() => handleOpenEditActivityModal(act)}
                                    title="Edit Activity"
                                  >
                                    <Edit3 size={13} />
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-icon btn-icon-xs btn-icon-ghost text-rose-500 hover:text-rose-600"
                                    onClick={() => handleDeleteActivity(act.id, act.title)}
                                    title="Delete Activity"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Today's Observations Summary */}
                    <div className="glass-panel p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                          <FileText size={18} className="text-amber-500" /> Today&apos;s Observations
                        </h3>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => setShowObservationModal(true)}
                        >
                          <Plus size={13} /> Add
                        </button>
                      </div>

                      {overview.observations.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-border rounded-xl">
                          <FileText className="mx-auto text-muted-foreground mb-2" size={32} />
                          <p className="text-sm font-medium text-muted-foreground">No observations recorded today.</p>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary mt-3"
                            onClick={() => setShowObservationModal(true)}
                          >
                            Record Observation
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {overview.observations.map((obs) => (
                            <div key={obs.id} className="p-3 rounded-lg border border-border bg-card/30 space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-foreground">{obs.studentName}</span>
                                <span className={`badge text-[10px] ${obs.concern === 'URGENT' ? 'b-danger' : obs.concern === 'ELEVATED' ? 'b-warning' : 'b-neutral'}`}>
                                  {obs.category}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">&ldquo;{obs.narrative}&rdquo;</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: MANAGE SUBJECTS */}
          {activeTab === 'subjects' && (
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <BookOpen size={20} className="text-primary" /> Reusable Subjects List
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Maintain the reusable subject & activity list that populates the Daily Schedule Builder dropdowns.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setNewSubjectName('')
                    setNewSubjectType('CORE')
                    setShowAddSubjectModal(true)
                  }}
                >
                  <Plus size={15} /> Add Subject
                </button>
              </div>

              {subjects.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <BookOpen className="mx-auto text-muted-foreground mb-2" size={40} />
                  <h4 className="font-bold text-base text-foreground">No subjects created yet</h4>
                  <p className="text-xs text-muted-foreground mt-1">Create your first subject (e.g. English, Math, Story, Drawing, Music) to populate your schedule builder.</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mt-4"
                    onClick={() => {
                      setNewSubjectName('')
                      setNewSubjectType('CORE')
                      setShowAddSubjectModal(true)
                    }}
                  >
                    <Plus size={14} /> Add Subject
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {subjects.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-xl border border-border bg-card/40 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">{sub.name}</h4>
                          <span className={`badge text-[10px] ${sub.subjectType === 'CORE' ? 'b-indigo' : 'b-purple'}`}>
                            {sub.subjectType === 'CORE' ? 'Core Subject' : 'Activity'}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">Code: {sub.code}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-icon btn-icon-xs btn-icon-ghost text-blue-500"
                          onClick={() => {
                            setEditSubjectName(sub.name)
                            setEditSubjectType(sub.subjectType || 'CORE')
                            setShowEditSubjectModal(sub)
                          }}
                          title="Edit Subject"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-icon-xs btn-icon-ghost text-rose-500"
                          onClick={() => handleRemoveSubject(sub)}
                          title="Remove Subject"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: IN-PAGE DAILY SCHEDULE BUILDER & DAILY REPORT (2-COLUMN BOX LAYOUT) */}
          {activeTab === 'builder' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT PART BOX: MULTI-ROW TIMETABLE BUILDER */}
              <div className="lg:col-span-6 glass-panel p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Layers size={18} className="text-indigo-500" /> Multi-Row Timetable Builder
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure multi-row core subjects & activities for {currentClass?.name}.
                    </p>
                  </div>
                  <span className="badge b-indigo text-xs font-bold px-2.5 py-1">
                    {scheduleRows.length} {scheduleRows.length === 1 ? 'Row' : 'Rows'}
                  </span>
                </div>

                {/* Target Program, Class & Date Selector Inside Builder Box */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Program Selection Dropdown */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Building2 size={14} className="text-primary" /> Program / Class:
                      </label>
                      <select
                        className="select select-sm text-xs font-semibold w-full bg-card border-border"
                        value={selectedClassroomId}
                        onChange={(e) => setSelectedClassroomId(e.target.value)}
                      >
                        {classrooms.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.programType} – {c.name} ({c.teacherName})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target Date Picker */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Calendar size={14} className="text-primary" /> Target Scheduling Date:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          className="bg-card border border-border text-xs font-semibold px-2 py-1 rounded-lg focus:outline-none cursor-pointer flex-1"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-xs btn-outline text-xs font-semibold"
                          onClick={() => setSelectedDate(isoDate())}
                        >
                          Today
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-muted-foreground pt-1.5 border-t border-border/60 flex items-center justify-between">
                    <span>Scheduling Day: <strong className="text-foreground">{getFormattedDayAndDate(selectedDate)}</strong></span>
                    {currentClass && <span className="badge b-primary text-[10px] font-bold">{currentClass.programType}</span>}
                  </div>
                </div>

                {/* Multi-Row Builder Table */}
                <form onSubmit={handleSaveScheduleBuilder} className="space-y-4">
                  <div className="border border-border rounded-xl overflow-x-auto max-h-[50vh] overflow-y-auto bg-card/30">
                    <table className="w-full text-left text-xs min-w-[580px]">
                      <thead className="bg-muted font-bold text-muted-foreground border-b border-border sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 w-8 text-center">#</th>
                          <th className="p-2.5 min-w-[180px]">Subject / Activity *</th>
                          <th className="p-2.5 w-24">Start *</th>
                          <th className="p-2.5 w-24">End *</th>
                          <th className="p-2.5 w-28">Type *</th>
                          <th className="p-2.5 w-16 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {scheduleRows.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-card/50">
                            <td className="p-2 font-mono text-muted-foreground text-center">{idx + 1}.</td>
                            <td className="p-2">
                              <select
                                className="select select-sm text-xs font-semibold w-full"
                                value={row.subjectName}
                                onChange={(e) => handleUpdateScheduleRow(idx, 'subjectName', e.target.value)}
                                required
                              >
                                <option value="">-- Select Subject --</option>
                                {subjects.map((sub) => (
                                  <option key={sub.id} value={sub.name}>
                                    {sub.name} ({sub.subjectType === 'CORE' ? 'Core' : 'Activity'})
                                  </option>
                                ))}
                                <option value="English & Phonics">English & Phonics</option>
                                <option value="Mathematics & Numbers">Mathematics & Numbers</option>
                                <option value="EVS & Environmental Science">EVS & Environmental Science</option>
                                <option value="Art & Craft">Art & Craft</option>
                                <option value="Physical Activity & Play">Physical Activity & Play</option>
                                <option value="Music & Movement">Music & Movement</option>
                                <option value="Storytelling & Rhymes">Storytelling & Rhymes</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="time"
                                className="input input-sm text-xs w-full px-1.5"
                                value={row.startTime}
                                onChange={(e) => handleUpdateScheduleRow(idx, 'startTime', e.target.value)}
                                required
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="time"
                                className="input input-sm text-xs w-full px-1.5"
                                value={row.endTime}
                                onChange={(e) => handleUpdateScheduleRow(idx, 'endTime', e.target.value)}
                                required
                              />
                            </td>
                            <td className="p-2">
                              <select
                                className="select select-sm text-xs font-medium w-full"
                                value={row.activityType}
                                onChange={(e) => handleUpdateScheduleRow(idx, 'activityType', e.target.value)}
                              >
                                <option value="CORE_SUBJECT">Core</option>
                                <option value="ACTIVITY">Activity</option>
                              </select>
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  className="btn btn-icon btn-icon-xs btn-icon-primary"
                                  onClick={handleAddScheduleRow}
                                  title="Add Row (+)"
                                >
                                  <Plus size={13} />
                                </button>
                                {scheduleRows.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn btn-icon btn-icon-xs btn-icon-ghost text-rose-500 hover:bg-rose-500/10 rounded p-1 border border-rose-200 dark:border-rose-950"
                                    onClick={() => handleRemoveScheduleRow(idx)}
                                    title="Remove Row (-)"
                                  >
                                    <Minus size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={handleAddScheduleRow}
                    >
                      <Plus size={14} /> Add Row
                    </button>

                    <button
                      type="submit"
                      className="btn btn-sm btn-primary font-semibold"
                      disabled={submittingScheduleBuilder}
                    >
                      {submittingScheduleBuilder ? <RefreshCw className="animate-spin mr-1" size={14} /> : <Save className="mr-1" size={14} />}
                      Save Schedule
                    </button>
                  </div>
                </form>
              </div>

              {/* RIGHT PART BOX: DAILY SCHEDULE CHART & OPERATIONAL REPORT */}
              <div className="lg:col-span-6 glass-panel p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Clock size={18} className="text-primary" /> Daily Schedule & Execution Report
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Operational report for <strong className="text-foreground">{getFormattedDayAndDate(selectedDate)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="badge b-emerald font-bold">
                      {overview?.activities.filter((a) => a.status === 'COMPLETED').length || 0} Done
                    </span>
                    <span className="badge b-amber font-bold">
                      {(overview?.activities.length || 0) - (overview?.activities.filter((a) => a.status === 'COMPLETED').length || 0)} Pending
                    </span>
                  </div>
                </div>

                {/* Report Filters: Date Filter, Program Filter & Status Filter */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Date Filter */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-muted-foreground flex items-center gap-1">
                      <Calendar size={14} className="text-primary" /> Date Filter:
                    </span>
                    <div className="flex items-center bg-card border border-border rounded-lg px-1.5 py-0.5 gap-0.5">
                      <button
                        type="button"
                        className="btn btn-icon btn-icon-xs btn-icon-ghost"
                        onClick={handlePrevDay}
                        title="Previous Day"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <input
                        type="date"
                        className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-icon btn-icon-xs btn-icon-ghost"
                        onClick={handleNextDay}
                        title="Next Day"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline text-[11px] font-semibold"
                      onClick={() => setSelectedDate(isoDate())}
                    >
                      Today
                    </button>
                  </div>

                  {/* Program Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-muted-foreground">Program Filter:</span>
                    <select
                      className="select select-sm text-xs font-semibold"
                      value={selectedProgramFilter}
                      onChange={(e) => {
                        const val = e.target.value
                        setSelectedProgramFilter(val)
                        if (val !== 'ALL') {
                          const matchingClass = classrooms.find((c) => c.programType === val)
                          if (matchingClass) setSelectedClassroomId(matchingClass.id)
                        }
                      }}
                    >
                      <option value="ALL">All Programs</option>
                      <option value="PLAYGROUP">Playgroup</option>
                      <option value="NURSERY">Nursery</option>
                      <option value="LKG">LKG / Jr KG</option>
                      <option value="UKG">UKG / Sr KG</option>
                      <option value="DAYCARE">Daycare</option>
                    </select>
                  </div>

                  {/* Status Filter Tabs (All / Done / Pending) */}
                  <div className="join border border-border rounded-lg bg-background/60 p-0.5 flex">
                    <button
                      type="button"
                      className={`btn btn-xs ${selectedStatusFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setSelectedStatusFilter('ALL')}
                    >
                      All ({overview?.activities.length || 0})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${selectedStatusFilter === 'COMPLETED' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setSelectedStatusFilter('COMPLETED')}
                    >
                      Done ({overview?.activities.filter((a) => a.status === 'COMPLETED').length || 0})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${selectedStatusFilter === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setSelectedStatusFilter('PENDING')}
                    >
                      Pending ({(overview?.activities.length || 0) - (overview?.activities.filter((a) => a.status === 'COMPLETED').length || 0)})
                    </button>
                  </div>
                </div>

                {!overview || overview.activities.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl bg-card/20 space-y-2">
                    <Clock className="mx-auto text-muted-foreground/60" size={34} />
                    <p className="text-sm font-semibold text-foreground">No Schedule Chart Created Yet</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Fill out the Multi-Row Builder on the left for {getFormattedDayAndDate(selectedDate)} and click &ldquo;Save Schedule&rdquo;.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Execution Stats Progress Bar */}
                    {(() => {
                      const total = overview.activities.length
                      const done = overview.activities.filter((a) => a.status === 'COMPLETED').length
                      const pending = total - done
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0

                      return (
                        <div className="p-3.5 rounded-xl border border-border bg-card/50 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-foreground">
                            <span>Daily Completion Status ({getFormattedDayAndDate(selectedDate)})</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{done} of {total} Done ({pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                            <div className="h-full bg-amber-400 dark:bg-amber-500/60 transition-all duration-300" style={{ width: `${100 - pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ {done} Completed</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">⏳ {pending} Pending / In Progress</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Filtered Schedule Entry List */}
                    <div className="space-y-2.5 max-h-[44vh] overflow-y-auto pr-1">
                      {overview.activities
                        .filter((act) => {
                          if (selectedStatusFilter === 'COMPLETED' && act.status !== 'COMPLETED') return false
                          if (selectedStatusFilter === 'PENDING' && act.status === 'COMPLETED') return false
                          return true
                        })
                        .map((act, idx) => (
                          <div key={act.id} className="p-3 rounded-xl border border-border bg-card/40 hover:bg-card/70 transition-all flex items-center justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                                  {act.startTime} – {act.endTime}
                                </span>
                                <span className={`badge text-[9px] font-semibold uppercase ${['CORE_TEACHING', 'CORE_SUBJECT'].includes(act.activityType) ? 'b-indigo' : 'b-purple'}`}>
                                  {act.activityType === 'CORE_TEACHING' || act.activityType === 'CORE_SUBJECT' ? 'Core' : 'Activity'}
                                </span>
                              </div>
                              <h4 className="font-bold text-foreground text-xs truncate">
                                <span className="text-muted-foreground font-mono">{idx + 1}.</span> {act.title}
                              </h4>
                              {act.teacherName && (
                                <span className="text-[11px] text-muted-foreground block">
                                  Teacher: <strong className="text-foreground">{act.teacherName}</strong>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {act.status === 'COMPLETED' ? (
                                <span className="badge b-success text-[10px] font-semibold">
                                  <CheckCircle2 size={11} className="mr-1 inline" /> Done
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline"
                                  onClick={() => setShowCompleteActivityModal(act.id)}
                                >
                                  Mark Done
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-icon btn-icon-xs btn-icon-ghost"
                                onClick={() => handleOpenEditActivityModal(act)}
                                title="Edit"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-icon btn-icon-xs btn-icon-ghost text-rose-500"
                                onClick={() => handleDeleteActivity(act.id, act.title)}
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'attendance' && (
            <div className="glass-panel p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <UserCheck size={20} className="text-emerald-500" /> Class Attendance Register
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mark daily presence, absence, or late arrival for all students in {currentClass?.name}.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleMarkAllPresent}
                  >
                    <CheckSquare size={15} /> Mark All Present
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                  >
                    {savingAttendance ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
                    Save Attendance
                  </button>
                </div>
              </div>

              {loadingAttendance ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="glass-panel p-4 animate-pulse h-16" />
                  ))}
                </div>
              ) : attendanceRegister.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <Users className="mx-auto text-muted-foreground mb-2" size={40} />
                  <h4 className="font-bold text-base text-foreground">No students assigned</h4>
                  <p className="text-xs text-muted-foreground mt-1">No students are currently allocated to {currentClass?.name}.</p>
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card/30">
                  {attendanceRegister.map((student, idx) => (
                    <div
                      key={student.studentId}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-card/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-6">{idx + 1}.</span>
                        <Avatar name={student.name} src={student.photoUrl} size="md" />
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{student.name}</h4>
                          <span className="text-xs text-muted-foreground font-mono">Adm No: {student.admissionNo}</span>
                        </div>
                      </div>

                      {/* Status Toggle Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            student.status === 'PRESENT'
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600'
                          }`}
                          onClick={() => handleSetStudentStatus(student.studentId, 'PRESENT')}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            student.status === 'ABSENT'
                              ? 'bg-rose-500 text-white shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600'
                          }`}
                          onClick={() => handleSetStudentStatus(student.studentId, 'ABSENT')}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            student.status === 'LATE'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'
                          }`}
                          onClick={() => handleSetStudentStatus(student.studentId, 'LATE')}
                        >
                          Late
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            student.status === 'HALF_DAY'
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600'
                          }`}
                          onClick={() => handleSetStudentStatus(student.studentId, 'HALF_DAY')}
                        >
                          Half Day
                        </button>

                        <input
                          type="text"
                          placeholder="Optional notes..."
                          className="input input-xs text-xs max-w-[150px] ml-2"
                          value={student.notes}
                          onChange={(e) => handleSetStudentNotes(student.studentId, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TIMETABLE & ACTIVITIES */}
          {activeTab === 'timetable' && (
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Clock size={20} className="text-primary" /> Today&apos;s Class Timetable
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Schedule and track core subjects and classroom activities chronologically for {selectedDate}.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleOpenScheduleBuilder()}
                >
                  <Plus size={15} /> Schedule Activity
                </button>
              </div>

              {overview?.activities.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <Clock className="mx-auto text-muted-foreground mb-2" size={40} />
                  <h4 className="font-bold text-base text-foreground">No activities scheduled</h4>
                  <p className="text-xs text-muted-foreground mt-1">There are no activities planned for this classroom today.</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mt-3"
                    onClick={() => handleOpenScheduleBuilder()}
                  >
                    <Plus size={14} /> Schedule Activity
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {overview?.activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-5 rounded-xl border border-border bg-card/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-muted">
                            {act.startTime} – {act.endTime}
                          </span>
                          <span className={`badge text-xs font-semibold ${['CORE_TEACHING', 'CORE_SUBJECT'].includes(act.activityType) ? 'b-indigo' : 'b-purple'}`}>
                            {act.activityType === 'CORE_TEACHING' || act.activityType === 'CORE_SUBJECT' ? 'Core Subject' : act.activityType.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Teacher: <strong className="text-foreground">{act.teacherName}</strong>
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-foreground">{act.title}</h4>
                        {act.description && <p className="text-xs text-muted-foreground">{act.description}</p>}
                        {act.actualOutcome && (
                          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700">
                            <strong>Execution Notes:</strong> {act.actualOutcome}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {act.status === 'COMPLETED' ? (
                          <span className="badge b-success text-xs font-semibold px-3 py-1">
                            <CheckCircle2 size={14} className="mr-1 inline" /> Completed
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={() => setShowCompleteActivityModal(act.id)}
                          >
                            Mark Done
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-icon btn-icon-xs btn-icon-ghost text-blue-500"
                          onClick={() => handleOpenEditActivityModal(act)}
                          title="Edit Activity"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-icon-xs btn-icon-ghost text-rose-500"
                          onClick={() => handleDeleteActivity(act.id, act.title)}
                          title="Delete Activity"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: OBSERVATIONS */}
          {activeTab === 'observations' && (
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileText size={20} className="text-amber-500" /> Classroom Observations
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Record general classroom notes or individual student observations.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowObservationModal(true)}
                >
                  <Plus size={15} /> Record Observation
                </button>
              </div>

              {overview?.observations.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <FileText className="mx-auto text-muted-foreground mb-2" size={40} />
                  <h4 className="font-bold text-base text-foreground">No observations recorded</h4>
                  <p className="text-xs text-muted-foreground mt-1">Record your observations on student participation or learning progress.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overview?.observations.map((obs) => (
                    <div key={obs.id} className="p-5 rounded-xl border border-border bg-card/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{obs.studentName}</span>
                        <span className="badge b-neutral text-xs">{obs.category}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{obs.narrative}&rdquo;</p>
                      <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                        Observed on: {new Date(obs.observedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: HISTORY */}
          {activeTab === 'history' && (
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <HistoryIcon size={20} className="text-blue-500" /> Daily Diary Logs & History
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Audit trail of past attendance, completed activities, and child observations.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={loadHistory}
                >
                  <RefreshCw size={13} /> Refresh History
                </button>
              </div>

              {loadingHistory ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="glass-panel p-4 animate-pulse h-16" />
                  ))}
                </div>
              ) : historyData ? (
                <div className="space-y-6">
                  {/* Past Attendance Logs */}
                  <div>
                    <h4 className="font-bold text-sm text-foreground mb-3">Recent Attendance Records</h4>
                    {historyData.attendance.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No attendance records found for this date.</p>
                    ) : (
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-muted font-bold text-muted-foreground">
                            <tr>
                              <th className="p-3">Date</th>
                              <th className="p-3">Student Name</th>
                              <th className="p-3">Adm No</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {historyData.attendance.map((row) => (
                              <tr key={row.id} className="hover:bg-card/50">
                                <td className="p-3 font-mono">{row.date}</td>
                                <td className="p-3 font-semibold text-foreground">{row.studentName}</td>
                                <td className="p-3 font-mono">{row.admissionNo}</td>
                                <td className="p-3">
                                  <span className={`badge text-[10px] ${row.status === 'PRESENT' ? 'b-success' : row.status === 'ABSENT' ? 'b-danger' : 'b-warning'}`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="p-3 text-muted-foreground">{row.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* MODAL: MANAGE SUBJECTS (ADD) */}
      {showAddSubjectModal && (
        <Modal
          open={showAddSubjectModal}
          onClose={() => setShowAddSubjectModal(false)}
          title="Add Reusable Subject"
        >
          <form onSubmit={handleAddSubject} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground">Subject Name *</label>
              <input
                type="text"
                className="input text-sm mt-1"
                placeholder="e.g. English, Math, Drawing, Story, Music, Outdoor Play..."
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground">Subject Category</label>
              <select
                className="select text-xs mt-1 font-semibold"
                value={newSubjectType}
                onChange={(e) => setNewSubjectType(e.target.value)}
              >
                <option value="CORE">Core Subject (Academic / Learning)</option>
                <option value="ACTIVITY">Activity (Co-curricular / Co-educational)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowAddSubjectModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={submittingSubject}
              >
                {submittingSubject ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Subject
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: MANAGE SUBJECTS (EDIT) */}
      {showEditSubjectModal && (
        <Modal
          open={!!showEditSubjectModal}
          onClose={() => setShowEditSubjectModal(null)}
          title="Edit Subject"
        >
          <form onSubmit={handleEditSubjectSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground">Subject Name *</label>
              <input
                type="text"
                className="input text-sm mt-1"
                value={editSubjectName}
                onChange={(e) => setEditSubjectName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground">Subject Category</label>
              <select
                className="select text-xs mt-1 font-semibold"
                value={editSubjectType}
                onChange={(e) => setEditSubjectType(e.target.value)}
              >
                <option value="CORE">Core Subject</option>
                <option value="ACTIVITY">Activity</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowEditSubjectModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={submittingSubject}
              >
                {submittingSubject ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: DAILY SCHEDULE BUILDER (MULTI-ROW TABLE FORM) */}
      {showScheduleBuilderModal && (
        <Modal
          open={showScheduleBuilderModal}
          onClose={() => setShowScheduleBuilderModal(false)}
          title={`Daily Schedule Builder — ${currentClass?.name || 'Classroom'}`}
          wide
          maxWidth="920px"
        >
          <form onSubmit={handleSaveScheduleBuilder} className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs">
              <div>
                <span className="font-semibold text-foreground">Classroom:</span> {currentClass?.name} •{' '}
                <span className="font-semibold text-foreground">Date:</span> {selectedDate}
              </div>
              <div className="text-muted-foreground">
                Build multi-row activity schedules for today using your reusable subjects list.
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-x-auto max-h-[60vh] overflow-y-auto bg-card/30">
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead className="bg-muted font-bold text-muted-foreground border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 min-w-[240px]">Subject / Activity Name *</th>
                    <th className="p-3 w-32">Start Time *</th>
                    <th className="p-3 w-32">End Time *</th>
                    <th className="p-3 w-40">Type of Activity *</th>
                    <th className="p-3 w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {scheduleRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-card/50">
                      <td className="p-3 font-mono text-muted-foreground text-center">{idx + 1}.</td>
                      <td className="p-3">
                        <select
                          className="select select-sm text-xs font-semibold w-full min-w-[200px]"
                          value={row.subjectName}
                          onChange={(e) => handleUpdateScheduleRow(idx, 'subjectName', e.target.value)}
                          required
                        >
                          <option value="">-- Select Subject --</option>
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.name}>
                              {sub.name} ({sub.subjectType === 'CORE' ? 'Core Subject' : 'Activity'})
                            </option>
                          ))}
                          <option value="English & Phonics">English & Phonics</option>
                          <option value="Mathematics & Numbers">Mathematics & Numbers</option>
                          <option value="EVS & Environmental Science">EVS & Environmental Science</option>
                          <option value="Art & Craft">Art & Craft</option>
                          <option value="Physical Activity & Play">Physical Activity & Play</option>
                          <option value="Music & Movement">Music & Movement</option>
                          <option value="Storytelling & Rhymes">Storytelling & Rhymes</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="time"
                          className="input input-sm text-xs w-full"
                          value={row.startTime}
                          onChange={(e) => handleUpdateScheduleRow(idx, 'startTime', e.target.value)}
                          required
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="time"
                          className="input input-sm text-xs w-full"
                          value={row.endTime}
                          onChange={(e) => handleUpdateScheduleRow(idx, 'endTime', e.target.value)}
                          required
                        />
                      </td>
                      <td className="p-3">
                        <select
                          className="select select-sm text-xs font-medium w-full"
                          value={row.activityType}
                          onChange={(e) => handleUpdateScheduleRow(idx, 'activityType', e.target.value)}
                        >
                          <option value="CORE_SUBJECT">Core Subject</option>
                          <option value="ACTIVITY">Activity</option>
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            className="btn btn-icon btn-icon-xs btn-icon-primary"
                            onClick={handleAddScheduleRow}
                            title="Add Row Below (+)"
                          >
                            <Plus size={14} />
                          </button>
                          {scheduleRows.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-icon btn-icon-xs btn-icon-ghost text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded p-1 border border-rose-200 dark:border-rose-950"
                              onClick={() => handleRemoveScheduleRow(idx)}
                              title="Remove Row (-)"
                            >
                              <Minus size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={handleAddScheduleRow}
              >
                <Plus size={14} /> Add Row
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setShowScheduleBuilderModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={submittingScheduleBuilder}
                >
                  {submittingScheduleBuilder ? <RefreshCw className="animate-spin mr-1" size={14} /> : <Save className="mr-1" size={14} />}
                  Save Schedule
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: EDIT SINGLE ACTIVITY */}
      {showEditActivityModal && (
        <Modal
          open={showEditActivityModal}
          onClose={() => setShowEditActivityModal(false)}
          title="Edit Activity Entry"
        >
          <form onSubmit={handleEditActivitySubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground">Activity / Subject Title *</label>
              <input
                type="text"
                className="input text-sm mt-1"
                value={editActTitle}
                onChange={(e) => setEditActTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground">Type of Activity *</label>
                <select
                  className="select text-xs mt-1 font-semibold"
                  value={editActType}
                  onChange={(e) => setEditActType(e.target.value)}
                >
                  <option value="CORE_SUBJECT">Core Subject</option>
                  <option value="ACTIVITY">Activity</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">Assigned Teacher</label>
                <select
                  className="select text-xs mt-1"
                  value={editActTeacherId}
                  onChange={(e) => setEditActTeacherId(e.target.value)}
                >
                  <option value="">Default Class Teacher</option>
                  {context?.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground">Start Time *</label>
                <input
                  type="time"
                  className="input text-xs mt-1"
                  value={editActStartTime}
                  onChange={(e) => setEditActStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">End Time *</label>
                <input
                  type="time"
                  className="input text-xs mt-1"
                  value={editActEndTime}
                  onChange={(e) => setEditActEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowEditActivityModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={submittingEditAct}
              >
                {submittingEditAct ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: COMPLETE ACTIVITY & NOTES */}
      {showCompleteActivityModal && (
        <Modal
          open={!!showCompleteActivityModal}
          onClose={() => setShowCompleteActivityModal(null)}
          title="Mark Activity Completed"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Add execution notes or learning outcomes achieved during this session.
            </p>
            <textarea
              className="input text-xs w-full min-h-[100px] p-3"
              placeholder="e.g. Children practiced number recognition 1 to 20 with flashcards..."
              value={activityNotesInput}
              onChange={(e) => setActivityNotesInput(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowCompleteActivityModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() =>
                  handleUpdateActivityStatus(
                    showCompleteActivityModal,
                    'COMPLETED',
                    activityNotesInput
                  )
                }
              >
                Save & Mark Completed
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADD OBSERVATION */}
      {showObservationModal && (
        <Modal
          open={showObservationModal}
          onClose={() => setShowObservationModal(false)}
          title="Record Classroom Observation"
        >
          <form onSubmit={handleAddObservation} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground">Target Student (Optional)</label>
              <select
                className="select text-xs mt-1"
                value={obsStudentId}
                onChange={(e) => setObsStudentId(e.target.value)}
              >
                <option value="">General Class Observation (All Students)</option>
                {attendanceRegister.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name} ({s.admissionNo})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground">Category</label>
                <select
                  className="select text-xs mt-1"
                  value={obsCategory}
                  onChange={(e) => setObsCategory(e.target.value)}
                >
                  <option value="General">General</option>
                  <option value="Cognitive">Cognitive & Math</option>
                  <option value="Language">Language & Story</option>
                  <option value="Motor Skills">Motor Skills & Play</option>
                  <option value="Social & Emotional">Social & Emotional</option>
                  <option value="Art & Creative">Art & Creative</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">Concern Level</label>
                <select
                  className="select text-xs mt-1 font-semibold"
                  value={obsConcern}
                  onChange={(e) => setObsConcern(e.target.value)}
                >
                  <option value="NORMAL">Normal / Positive Progress</option>
                  <option value="ELEVATED">Attention Needed</option>
                  <option value="URGENT">Urgent Concern</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground">Observation Narrative *</label>
              <textarea
                className="input text-xs mt-1 w-full min-h-[100px] p-3"
                placeholder="Describe what was observed during today's activities..."
                value={obsNarrative}
                onChange={(e) => setObsNarrative(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowObservationModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={submittingObs}
              >
                {submittingObs ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Observation
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
