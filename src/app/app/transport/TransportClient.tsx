'use client'

import React, { useCallback, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Bus,
  ShieldCheck,
  ShieldAlert,
  Plus,
  RefreshCw,
  Search,
  Users,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  UserCheck,
  KeyRound,
  FileText,
  Calendar,
  Wrench,
  AlertOctagon,
  UserX,
  ExternalLink,
  Edit3,
  ListOrdered,
  X,
  UserPlus,
  Zap,
  QrCode,
} from 'lucide-react'
import { PageHead, StatusBadge, EmptyState, KpiTile, Segmented, Field } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { inr, fmtDate, enumLabel } from '@/lib/format'
import { Role } from '@/lib/auth'
import { normalizeRole } from '@/lib/roles'

interface SessionProps {
  uid: string
  email: string
  name: string
  role: Role
  tenantId: string | null
  branchId: string | null
}

export function TransportClient({ session }: { session: SessionProps }) {
  const toast = useToast()
  const searchParams = useSearchParams()
  const role = session.role
  const canWrite = ['OWNER', 'PRINCIPAL', 'COORDINATOR', 'PLATFORM_ADMIN'].includes(normalizeRole(role))
  const canOperate = ['OWNER', 'PRINCIPAL', 'COORDINATOR', 'RECEPTIONIST', 'PLATFORM_ADMIN'].includes(normalizeRole(role))

  type TabKey =
    | 'OVERVIEW'
    | 'PARENT'
    | 'DRIVER'
    | 'TEACHER'
    | 'TRIPS'
    | 'ROUTES'
    | 'VEHICLES'
    | 'STUDENTS'
    | 'AUTHORIZATIONS'
    | 'SECURITY'
    | 'INCIDENTS'
    | 'SCANNER'
    | 'SEED'
  const [tab, setTab] = useState<TabKey>('OVERVIEW')
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState<any>(null)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [authorizations, setAuthorizations] = useState<any[]>([])
  const [securityLogs, setSecurityLogs] = useState<any[]>([])
  const [eligibleStaff, setEligibleStaff] = useState<any[]>([])
  const [availableStudents, setAvailableStudents] = useState<any[]>([])

  // New Role-Specific States
  const [myChildren, setMyChildren] = useState<any[]>([])
  const [teacherData, setTeacherData] = useState<any>({ students: [], pendingArrivals: [], pendingAuthorizations: [] })
  const [routeSelectionModal, setRouteSelectionModal] = useState<any>(null)
  const [driverQrModal, setDriverQrModal] = useState<any>(null)
  const [showVisualQr, setShowVisualQr] = useState<string | null>(null)
  const [seedResult, setSeedResult] = useState<any>(null)
  const [driverArrivedStudents, setDriverArrivedStudents] = useState<string[]>([])
  const [teacherVerifiedStudents, setTeacherVerifiedStudents] = useState<string[]>([])


  // Filter States
  const [tripTypeFilter, setTripTypeFilter] = useState<'ALL' | 'MORNING' | 'EVENING'>('ALL')
  const [tripStatusFilter, setTripStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED'>('ALL')
  const [routeFilter, setRouteFilter] = useState<string>('ALL')
  const [studentSearch, setStudentSearch] = useState<string>('')
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState<string>('ALL')

  // QR Scanner State
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState<any>(null)
  const [scanDriverPin, setScanDriverPin] = useState('')
  const [scanningBusy, setScanningBusy] = useState(false)
  const [scanActionMode, setScanActionMode] = useState<'REGISTERED_PICKUP' | 'UNKNOWN_REQUEST' | 'NONE'>('NONE')
  const [scanPersonName, setScanPersonName] = useState('')
  const [scanPersonPhone, setScanPersonPhone] = useState('')
  const [scanPersonRelation, setScanPersonRelation] = useState('Relative')
  const [scanGateNotes, setScanGateNotes] = useState('')
  const [scanSubmitting, setScanSubmitting] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Emergency Safety Callout State
  const [activeSafetyAlert, setActiveSafetyAlert] = useState<{
    studentName: string
    studentId?: string
    reason: string
    stopName?: string
    attemptedPerson?: string
    timestamp: string
  } | null>(null)

  // Modal States
  const [addVehicleOpen, setAddVehicleOpen] = useState(false)
  const [editVehicleModal, setEditVehicleModal] = useState<any>(null)
  const [addRouteOpen, setAddRouteOpen] = useState(false)
  const [editRouteModal, setEditRouteModal] = useState<any>(null)
  const [manageStopsModal, setManageStopsModal] = useState<any>(null)
  const [assignStudentOpen, setAssignStudentOpen] = useState(false)
  const [cancelAssignmentModal, setCancelAssignmentModal] = useState<any>(null)
  const [startTripOpen, setStartTripOpen] = useState(false)
  const [dropVerifyOpen, setDropVerifyOpen] = useState<any>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const [reportIncidentOpen, setReportIncidentOpen] = useState(false)
  const [incidentTripPrefill, setIncidentTripPrefill] = useState<any>(null)
  const [resolveIncidentModal, setResolveIncidentModal] = useState<any>(null)
  const [delayTripOpen, setDelayTripOpen] = useState<any>(null)
  const [substituteVehicleModal, setSubstituteVehicleModal] = useState<any>(null)
  const [substituteDriverModal, setSubstituteDriverModal] = useState<any>(null)
  const [addAuthOpen, setAddAuthOpen] = useState(false)
  const [manualOverrideModal, setManualOverrideModal] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  // Drop Verification Form State
  const [selectedGuardianId, setSelectedGuardianId] = useState('')
  const [pickupPin, setPickupPin] = useState('')

  // 1. Data Fetching
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/v1/transport/dashboard')
      const json = await res.json()
      if (json.success) setMetrics(json.data)
    } catch {
      toast.error('Failed to load transport dashboard')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/vehicles')
      const json = await res.json()
      if (json.success) setVehicles(json.data)
    } catch {}
  }, [])

  const loadRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/routes')
      const json = await res.json()
      if (json.success) setRoutes(json.data)
    } catch {}
  }, [])

  const loadAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/assignments')
      const json = await res.json()
      if (json.success) setAssignments(json.data)
    } catch {}
  }, [])

  const loadTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/trips')
      const json = await res.json()
      if (json.success) setTrips(json.data)
    } catch {}
  }, [])

  const loadIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/incidents')
      const json = await res.json()
      if (json.success) setIncidents(json.data)
    } catch {}
  }, [])

  const loadAuthorizations = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/authorizations')
      const json = await res.json()
      if (json.success) setAuthorizations(json.data)
    } catch {}
  }, [])

  const loadSecurityLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/security')
      const json = await res.json()
      if (json.success) setSecurityLogs(json.data)
    } catch {}
  }, [])

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/eligible-staff')
      const json = await res.json()
      if (json.success) setEligibleStaff(json.data)
    } catch {}
  }, [])

  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/students?pageSize=100&status=ACTIVE')
      const json = await res.json()
      if (json.success) setAvailableStudents(json.data || [])
    } catch {}
  }, [])

  const loadMyChildren = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/my-children')
      const json = await res.json()
      if (json.success) setMyChildren(json.data || [])
    } catch {}
  }, [])

  const loadTeacherData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/transport/teacher/students')
      const json = await res.json()
      if (json.success) setTeacherData(json.data || { students: [], pendingArrivals: [], pendingAuthorizations: [] })
    } catch {}
  }, [])

  useEffect(() => {
    loadDashboard()
    loadVehicles()
    loadRoutes()
    loadAssignments()
    loadTrips()
    loadIncidents()
    loadAuthorizations()
    loadSecurityLogs()
    loadStaff()
    loadStudents()
    loadMyChildren()
    loadTeacherData()
  }, [
    loadDashboard,
    loadVehicles,
    loadRoutes,
    loadAssignments,
    loadTrips,
    loadIncidents,
    loadAuthorizations,
    loadSecurityLogs,
    loadStaff,
    loadStudents,
    loadMyChildren,
    loadTeacherData,
  ])

  // Action Handlers for Transport Workflow
  const handleSeedDemoData = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/transport/seed', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast.success('Transport master & demo data seeded successfully!')
        setSeedResult(json.data)
        loadDashboard()
        loadRoutes()
        loadVehicles()
        loadAssignments()
        loadTrips()
        loadMyChildren()
        loadTeacherData()
        setTab('SEED')
      } else {
        toast.error(json.error?.message || 'Failed to seed demo data')
      }
    } catch {
      toast.error('Error seeding demo data')
    } finally {
      setBusy(false)
    }
  }

  const handleParentSubmitRouteSelection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!routeSelectionModal) return
    const fd = new FormData(e.currentTarget)
    const routeId = fd.get('routeId') as string
    const pickupStopId = fd.get('pickupStopId') as string
    const dropStopId = fd.get('dropStopId') as string

    if (!routeId || !pickupStopId || !dropStopId) {
      toast.error('Please select a route, pickup stop, and drop stop')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/v1/transport/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: routeSelectionModal.studentId,
          routeId,
          pickupStopId,
          dropStopId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Transport route selected for ${routeSelectionModal.fullName}`)
        setRouteSelectionModal(null)
        loadMyChildren()
        loadAssignments()
      } else {
        toast.error(json.error?.message || 'Failed to submit route selection')
      }
    } catch {
      toast.error('Failed to submit route selection')
    } finally {
      setBusy(false)
    }
  }

  const handleApproveAuth = async (authId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/transport/authorizations/${authId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: 'Approved by Parent/Staff' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Pickup authorization approved!')
        loadAuthorizations()
        loadMyChildren()
        loadTeacherData()
      } else {
        toast.error(json.error?.message || 'Failed to approve authorization')
      }
    } catch {
      toast.error('Failed to approve authorization')
    } finally {
      setBusy(false)
    }
  }

  const handleRejectAuth = async (authId: string) => {
    const reason = prompt('Please enter reason for rejection:', 'Unauthorized person')
    if (!reason) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/transport/authorizations/${authId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Pickup authorization rejected')
        loadAuthorizations()
        loadMyChildren()
        loadTeacherData()
      } else {
        toast.error(json.error?.message || 'Failed to reject authorization')
      }
    } catch {
      toast.error('Failed to reject authorization')
    } finally {
      setBusy(false)
    }
  }

  const handleCompleteHandover = async (authId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/transport/authorizations/${authId}/complete`, {
        method: 'POST',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Handover completed successfully!')
        loadAuthorizations()
        loadSecurityLogs()
        loadMyChildren()
        loadTeacherData()
      } else {
        toast.error(json.error?.message || 'ACCESS DENIED: Handover blocked')
      }
    } catch {
      toast.error('Handover completion failed')
    } finally {
      setBusy(false)
    }
  }

  const handlePerformScan = async (overridePayload?: string) => {
    const payloadToScan = overridePayload || scanInput
    if (!payloadToScan || !payloadToScan.trim()) {
      toast.error('Please enter or scan a valid QR token payload')
      return
    }
    setScanningBusy(true)
    try {
      const res = await fetch('/api/v1/transport/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrPayload: payloadToScan.trim(),
          pin: scanDriverPin || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setScanResult(json.data)
        if (json.data?.valid) {
          toast.success(json.data.message || 'QR Payload Verified!')
        } else {
          toast.warning(json.data?.message || 'QR Verification failed or invalid')
        }
      } else {
        toast.error(json.error?.message || 'QR Scan failed')
      }
    } catch (err: any) {
      toast.error('Error scanning QR payload', err.message)
    } finally {
      setScanningBusy(false)
    }
  }

  const handleConfirmRegisteredPickup = async (studentId: string) => {
    setScanSubmitting(true)
    try {
      const res = await fetch('/api/v1/transport/registered-guardian/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, notes: scanGateNotes || 'Verified Registered Guardian Handover at School Gate' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.data?.message || 'Registered Guardian Pickup Logged Successfully! ✅')
        setScanActionMode('NONE')
        loadAuthorizations()
        loadSecurityLogs()
      } else {
        toast.error(json.error?.message || 'Pickup Verification Failed')
      }
    } catch {
      toast.error('Failed to log pickup')
    } finally {
      setScanSubmitting(false)
    }
  }

  const handleSubmitUnknownPersonRequest = async (studentId: string) => {
    if (!scanPersonName.trim() || !scanPersonPhone.trim()) {
      toast.error('Please enter Person Name and Contact Phone Number')
      return
    }
    setScanSubmitting(true)
    try {
      const res = await fetch('/api/v1/transport/unknown-person/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          personName: scanPersonName.trim(),
          contactNumber: scanPersonPhone.trim(),
          relationship: scanPersonRelation.trim(),
          remarks: scanGateNotes.trim() || 'Gate Pickup Approval Request',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Instant Pickup Request Submitted! Urgent notification sent to Parent & Teacher for approval 📲')
        setScanActionMode('NONE')
        setScanPersonName('')
        setScanPersonPhone('')
        setScanGateNotes('')
        loadAuthorizations()
        loadSecurityLogs()
      } else {
        toast.error(json.error?.message || 'Failed to submit pickup request')
      }
    } catch {
      toast.error('Failed to submit approval request')
    } finally {
      setScanSubmitting(false)
    }
  }

  const startCameraScan = async () => {
    try {
      setCameraActive(true)
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      toast.info('Mobile camera active! Point camera at QR Code')
    } catch {
      toast.error('Unable to open mobile camera. Check browser camera permissions.')
      setCameraActive(false)
    }
  }

  const stopCameraScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    const scanParam = searchParams.get('scan') || searchParams.get('token')
    if (scanParam) {
      setTab('SCANNER')
      setScanInput(scanParam)
      handlePerformScan(scanParam)
    }
  }, [searchParams])

  const handleGenerateDriverQr = async (routeId: string, vehicleId: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/transport/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, vehicleId }),
      })
      const json = await res.json()
      if (json.success) {
        setDriverQrModal(json.data)
      } else {
        toast.error(json.error?.message || 'Failed to generate Driver QR')
      }
    } catch {
      toast.error('Failed to generate Driver QR')
    } finally {
      setBusy(false)
    }
  }

  const handleDriverSubmitArrival = async (tripId: string, studentIds: string[]) => {
    if (studentIds.length === 0) {
      toast.error('Please select at least one arrived student')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/transport/trips/${tripId}/arrival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Arrival reported for ${studentIds.length} student(s)! Class Teacher notified.`)
        loadTrips()
        loadDashboard()
        loadTeacherData()
      } else {
        toast.error(json.error?.message || 'Failed to submit arrival')
      }
    } catch {
      toast.error('Failed to submit arrival')
    } finally {
      setBusy(false)
    }
  }

  const handleTeacherVerifyArrival = async (tripId: string, studentIds: string[]) => {
    if (studentIds.length === 0) {
      toast.error('Please select at least one student to verify')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/transport/trips/${tripId}/verify-arrival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds, notes: 'Safe arrival verified by Class Teacher' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Safe arrival verified for ${studentIds.length} student(s)! Parent notified.`)
        loadTeacherData()
        loadTrips()
        loadDashboard()
      } else {
        toast.error(json.error?.message || 'Failed to verify arrival')
      }
    } catch {
      toast.error('Failed to verify arrival')
    } finally {
      setBusy(false)
    }
  }


  // Helper avatar generator
  const getAvatarInitials = (name: string) => {
    if (!name) return 'CH'
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase()
  }

  // 2. Vehicle Actions
  const handleCreateVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/transport/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationNumber: fd.get('registrationNumber'),
          capacity: Number(fd.get('capacity')),
          makeModel: fd.get('makeModel'),
          vehicleType: fd.get('vehicleType'),
          notes: fd.get('notes'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Vehicle registered successfully')
        setAddVehicleOpen(false)
        loadVehicles()
        loadDashboard()
      } else {
        toast.error('Failed to create vehicle', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error creating vehicle', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editVehicleModal) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/v1/transport/vehicles/${editVehicleModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capacity: Number(fd.get('capacity')),
          makeModel: fd.get('makeModel'),
          status: fd.get('status'),
          notes: fd.get('notes'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Vehicle updated successfully')
        setEditVehicleModal(null)
        loadVehicles()
        loadDashboard()
      } else {
        toast.error('Failed to update vehicle', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error updating vehicle', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleToggleVehicleStatus = async (vehicleId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/v1/transport/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Vehicle status changed to ${nextStatus}`)
        loadVehicles()
        loadDashboard()
      } else {
        toast.error('Failed to change vehicle status', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error changing status', err.message)
    }
  }

  // 3. Route Actions
  const handleCreateRoute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/transport/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: fd.get('code'),
          name: fd.get('name'),
          description: fd.get('description'),
          vehicleId: fd.get('vehicleId') || undefined,
          driverProfileId: fd.get('driverProfileId') || undefined,
          attendantProfileId: fd.get('attendantProfileId') || undefined,
          stops: [
            { name: fd.get('stop1Name'), sequence: 1, morningPickupTime: '07:45', eveningDropTime: '15:15' },
            { name: fd.get('stop2Name'), sequence: 2, morningPickupTime: '08:05', eveningDropTime: '15:35' },
            { name: 'School Campus', sequence: 3, morningPickupTime: '08:30', eveningDropTime: '15:00' },
          ].filter((s) => s.name),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Route created successfully')
        setAddRouteOpen(false)
        loadRoutes()
        loadDashboard()
      } else {
        toast.error('Failed to create route', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error creating route', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateRoute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editRouteModal) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/v1/transport/routes/${editRouteModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          description: fd.get('description'),
          vehicleId: fd.get('vehicleId') || null,
          driverProfileId: fd.get('driverProfileId') || null,
          attendantProfileId: fd.get('attendantProfileId') || null,
          status: fd.get('status'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Route configuration saved')
        setEditRouteModal(null)
        loadRoutes()
        loadDashboard()
      } else {
        toast.error('Failed to update route', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error updating route', err.message)
    } finally {
      setBusy(false)
    }
  }

  // 4. Trip Actions
  const handleStartTrip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/transport/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: fd.get('routeId'),
          tripType: fd.get('tripType'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Trip dispatched with live student manifest!')
        setStartTripOpen(false)
        loadTrips()
        loadDashboard()
        setTab('TRIPS')
      } else {
        toast.error('Failed to start trip', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error starting trip', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleBoard = async (tripId: string, studentId: string) => {
    try {
      const res = await fetch(`/api/v1/transport/trips/${tripId}/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Child boarded safely. ARRIVAL logged on parent timeline!')
        loadTrips()
        loadDashboard()
      } else {
        toast.error('Boarding failed', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error recording boarding', err.message)
    }
  }

  const handleDropConfirm = async () => {
    if (!dropVerifyOpen) return
    setBusy(true)
    setDropError(null)
    try {
      const res = await fetch(`/api/v1/transport/trips/${dropVerifyOpen.tripId}/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: dropVerifyOpen.student.id,
          guardianId: selectedGuardianId || undefined,
          pin: pickupPin || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Verified and safely handed over to guardian!`)
        setDropVerifyOpen(null)
        setSelectedGuardianId('')
        setPickupPin('')
        loadTrips()
        loadDashboard()
      } else {
        const errorMsg = json.error?.message || json.error || 'Pickup unauthorized'
        setDropError(errorMsg)
        setActiveSafetyAlert({
          studentName: `${dropVerifyOpen.student.firstName} ${dropVerifyOpen.student.lastName || ''}`,
          studentId: dropVerifyOpen.student.id,
          reason: errorMsg,
          stopName: dropVerifyOpen.stop.name,
          attemptedPerson: selectedGuardianId || 'Collecting Person',
          timestamp: new Date().toLocaleTimeString(),
        })
        toast.error('Release Blocked', errorMsg)
        loadIncidents()
      }
    } catch (err: any) {
      setDropError(err.message)
      toast.error('Pickup Blocked', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRecordDelay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!delayTripOpen) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/v1/transport/trips/${delayTripOpen.id}/delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delayMinutes: Number(fd.get('delayMinutes')),
          reason: fd.get('reason'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Trip delay recorded. Bus Delay Alert sent to affected parents!')
        setDelayTripOpen(null)
        loadTrips()
        loadDashboard()
      } else {
        toast.error('Failed to record delay', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error recording delay', err.message)
    } finally {
      setBusy(false)
    }
  }

  // 5. In-Flight Substitutions
  const handleSubstituteVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!substituteVehicleModal) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/v1/transport/trips/${substituteVehicleModal.id}/substitute-vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: fd.get('vehicleId'),
          reason: fd.get('reason'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Trip vehicle substituted in-flight!')
        setSubstituteVehicleModal(null)
        loadTrips()
        loadDashboard()
      } else {
        toast.error('Vehicle substitution failed', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error substituting vehicle', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSubstituteDriver = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!substituteDriverModal) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/v1/transport/trips/${substituteDriverModal.id}/substitute-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverProfileId: fd.get('driverProfileId'),
          reason: fd.get('reason'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Trip driver substituted in-flight!')
        setSubstituteDriverModal(null)
        loadTrips()
        loadDashboard()
      } else {
        toast.error('Driver substitution failed', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error substituting driver', err.message)
    } finally {
      setBusy(false)
    }
  }

  // 6. Student Allocations
  const handleAssignStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const routeId = fd.get('routeId') as string
    const selectedRoute = routes.find((r) => r.id === routeId)
    const pickupStopId = fd.get('pickupStopId') as string
    const dropStopId = fd.get('dropStopId') as string

    try {
      const res = await fetch('/api/v1/transport/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: fd.get('studentId'),
          routeId,
          pickupStopId,
          dropStopId,
          tripType: fd.get('tripType'),
          monthlyFeeCents: Number(fd.get('monthlyFee')) * 100,
          generateFeeInvoice: fd.get('generateFeeInvoice') === 'on',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Student assigned to transport!')
        setAssignStudentOpen(false)
        loadAssignments()
        loadRoutes()
        loadDashboard()
      } else {
        toast.error('Assignment failed', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error assigning student', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCancelAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!cancelAssignmentModal) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/v1/transport/assignments/${cancelAssignmentModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL',
          reason: fd.get('reason'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Transport allocation cancelled and capacity released')
        setCancelAssignmentModal(null)
        loadAssignments()
        loadRoutes()
        loadDashboard()
      } else {
        toast.error('Failed to cancel assignment', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error cancelling assignment', err.message)
    } finally {
      setBusy(false)
    }
  }

  // 7. Incident Management
  const handleReportIncident = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/transport/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: fd.get('tripId') || undefined,
          vehicleId: fd.get('vehicleId') || undefined,
          severity: fd.get('severity'),
          category: fd.get('category'),
          title: fd.get('title'),
          description: fd.get('description'),
          actionTaken: fd.get('actionTaken'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Incident reported. Operations follow-up logged!')
        setReportIncidentOpen(false)
        setIncidentTripPrefill(null)
        loadIncidents()
        loadDashboard()
      } else {
        toast.error('Failed to report incident', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error reporting incident', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleResolveIncident = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!resolveIncidentModal) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/v1/transport/incidents/${resolveIncidentModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: fd.get('status'),
          actionTaken: fd.get('actionTaken'),
          resolutionNotes: fd.get('resolutionNotes'),
          correctionReason: fd.get('correctionReason'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Incident status updated and follow-up closed!')
        setResolveIncidentModal(null)
        loadIncidents()
        loadDashboard()
      } else {
        toast.error('Failed to update incident', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error updating incident', err.message)
    } finally {
      setBusy(false)
    }
  }



  // Temporary Authorization Handlers
  const handleCreateAuthorization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/transport/authorizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: fd.get('studentId'),
          authorizedPersonName: fd.get('authorizedPersonName'),
          authorizedPersonPhone: fd.get('authorizedPersonPhone'),
          relationship: fd.get('relationship'),
          reason: fd.get('reason'),
          validFrom: fd.get('validFrom'),
          validUntil: fd.get('validUntil'),
          isOneTime: fd.get('isOneTime') === 'true',
          remarks: fd.get('remarks'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Temporary Pickup Authorization created!')
        setAddAuthOpen(false)
        loadAuthorizations()
      } else {
        toast.error('Failed to create authorization', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error creating authorization', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleActionAuthorization = async (authId: string, action: 'APPROVE' | 'REJECT' | 'CANCEL') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/transport/authorizations/${authId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.data.message || `Authorization ${action.toLowerCase()}d!`)
        loadAuthorizations()
      } else {
        toast.error(`Failed to ${action.toLowerCase()} authorization`, json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error updating authorization', err.message)
    } finally {
      setBusy(false)
    }
  }

  // Manual Override Handler
  const handleManualOverride = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/transport/security/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: fd.get('studentId'),
          action: fd.get('action'),
          reason: fd.get('reason'),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Manual security override logged successfully!')
        setManualOverrideModal(null)
        loadSecurityLogs()
      } else {
        toast.error('Failed to record manual override', json.error?.message || json.error)
      }
    } catch (err: any) {
      toast.error('Error recording manual override', err.message)
    } finally {
      setBusy(false)
    }
  }

  // Filtered lists
  const filteredTrips = trips.filter((t) => {
    if (tripTypeFilter !== 'ALL' && t.tripType !== tripTypeFilter) return false
    if (tripStatusFilter === 'DELAYED' && (!t.delayMinutes || t.delayMinutes <= 0)) return false
    if (tripStatusFilter !== 'ALL' && tripStatusFilter !== 'DELAYED' && t.status !== tripStatusFilter) return false
    if (routeFilter !== 'ALL' && t.route.id !== routeFilter) return false
    return true
  })

  const filteredAssignments = assignments.filter((a) => {
    if (!studentSearch.trim()) return true
    const q = studentSearch.toLowerCase()
    const name = `${a.student.firstName} ${a.student.lastName || ''}`.toLowerCase()
    const adm = (a.student.admissionNo || '').toLowerCase()
    const rName = (a.route.name || '').toLowerCase()
    return name.includes(q) || adm.includes(q) || rName.includes(q)
  })

  const filteredIncidents = incidents.filter((inc) => {
    if (incidentSeverityFilter !== 'ALL' && inc.severity !== incidentSeverityFilter) return false
    return true
  })

  // Check if any open critical incidents exist
  const criticalIncidents = incidents.filter((i) => (i.severity === 'CRITICAL' || i.severity === 'HIGH') && i.status !== 'RESOLVED')

  return (
    <div className="page-shell">
      <PageHead
        title="Transport & Child Safety Operations"
        sub="Fleet management, daily transit runs, student manifest verification, authorized multi-guardian drop safety, and real-time operations escalation"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => { loadDashboard(); loadTrips(); loadVehicles(); loadRoutes(); loadIncidents(); loadMyChildren(); loadTeacherData(); }} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button className="btn btn-secondary" onClick={handleSeedDemoData} disabled={busy} title="Seed test data & generate test QR code">
              <Zap size={14} /> Seed Test Data & QR
            </button>
            {canOperate && (
              <button className="btn btn-secondary" onClick={() => setStartTripOpen(true)}>
                <Clock size={15} /> Dispatch Trip
              </button>
            )}
            {canWrite && (
              <>
                <button className="btn btn-secondary" onClick={() => setAssignStudentOpen(true)}>
                  <UserPlus size={15} /> Allocate Seat
                </button>
                <button className="btn btn-primary" onClick={() => setAddRouteOpen(true)}>
                  <Plus size={15} /> Add Route
                </button>
              </>
            )}
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* CRITICAL SAFETY ALERT CALLOUT (When pickup blocked or critical incident) */}
      {/* ========================================================================= */}
      {(activeSafetyAlert || criticalIncidents.length > 0) && (
        <div
          style={{
            marginBottom: 20,
            padding: '16px 20px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.12) 0%, rgba(239, 68, 68, 0.05) 100%)',
            border: '2px solid var(--danger)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'var(--danger)',
                color: 'var(--text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--danger)', textTransform: 'uppercase' }}>
                  Emergency Child Safety Alert
                </span>
                <span className="badge b-danger">PRINCIPAL ESCALATION</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginTop: 2 }}>
                {activeSafetyAlert ? `Unauthorized Pickup Blocked: ${activeSafetyAlert.studentName}` : `${criticalIncidents.length} Critical Transit Incident(s) Active`}
              </div>
              <p style={{ fontSize: 13, color: 'var(--foreground)', opacity: 0.85, margin: '4px 0 8px 0' }}>
                {activeSafetyAlert
                  ? `Drop verification failed at ${activeSafetyAlert.stopName || 'bus stop'}. Reason: ${activeSafetyAlert.reason}. Child release was strictly BLOCKED.`
                  : criticalIncidents[0]?.description}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href="/app/operations" className="btn btn-danger btn-sm" style={{ textDecoration: 'none' }}>
                  <AlertOctagon size={14} /> Open Operations Follow-Up
                </Link>
                {activeSafetyAlert?.studentId && (
                  <Link href={`/app/students/${activeSafetyAlert.studentId}`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                    <ExternalLink size={13} /> View Student 360
                  </Link>
                )}
              </div>
            </div>
          </div>
          {activeSafetyAlert && (
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveSafetyAlert(null)} title="Dismiss callout">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE KPI STRIP (Clickable navigation) */}
      {/* ========================================================================= */}
      <div className="metric-strip" style={{ marginBottom: 20 }}>
        <div className="metric-cell" onClick={() => setTab('ROUTES')} style={{ cursor: 'pointer' }} title="Click to view Routes">
          <div className="m-top">
            <span className="m-lbl">Active Routes</span>
            <Bus size={15} style={{ color: 'var(--primary)' }} />
          </div>
          <div className="m-val">{metrics?.activeRoutes ?? 0}</div>
          <div className="m-meta">Daily routes configured →</div>
        </div>

        <div className="metric-cell" onClick={() => setTab('VEHICLES')} style={{ cursor: 'pointer' }} title="Click to view Fleet">
          <div className="m-top">
            <span className="m-lbl">In-Service Fleet</span>
            <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
          </div>
          <div className="m-val m-success">{metrics?.activeVehicles ?? 0}</div>
          <div className="m-meta">{metrics?.vehiclesInMaintenance ? `${metrics.vehiclesInMaintenance} in maintenance` : '100% active'} →</div>
        </div>

        <div className="metric-cell" onClick={() => setTab('STUDENTS')} style={{ cursor: 'pointer' }} title="Click to view Allocations">
          <div className="m-top">
            <span className="m-lbl">Assigned Children</span>
            <Users size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="m-val">{metrics?.studentsUsingTransport ?? 0}</div>
          <div className="m-meta">Allocated seats →</div>
        </div>

        <div className="metric-cell" onClick={() => setTab('TRIPS')} style={{ cursor: 'pointer' }} title="Click to view Trips">
          <div className="m-top">
            <span className="m-lbl">Boarded Today</span>
            <UserCheck size={15} style={{ color: 'var(--info)' }} />
          </div>
          <div className="m-val">{metrics?.childrenBoarded ?? 0}</div>
          <div className="m-meta">Morning arrivals logged →</div>
        </div>

        <div className="metric-cell" onClick={() => setTab('TRIPS')} style={{ cursor: 'pointer' }} title="Click to view Trips">
          <div className="m-top">
            <span className="m-lbl">Safely Dropped</span>
            <ShieldCheck size={15} style={{ color: 'var(--success)' }} />
          </div>
          <div className="m-val m-success">{metrics?.childrenDropped ?? 0}</div>
          <div className="m-meta">Guardian PIN verified →</div>
        </div>

        <div
          className="metric-cell"
          onClick={() => { setTab('TRIPS'); setTripStatusFilter('DELAYED'); }}
          style={{ cursor: 'pointer' }}
          title="Click to view Delayed Trips"
        >
          <div className="m-top">
            <span className="m-lbl">Delayed Trips</span>
            <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
          </div>
          <div className="m-val" style={{ color: metrics?.delayedTrips > 0 ? 'var(--danger)' : 'var(--foreground)' }}>
            {metrics?.delayedTrips ?? 0}
          </div>
          <div className="m-meta">{metrics?.delayedTrips > 0 ? 'Review & Alert' : 'On schedule'} →</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Segmented
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
        options={[
          { key: 'OVERVIEW', label: 'Command Center' },
          { key: 'PARENT', label: `My Children 👨‍👩‍👧‍👦 (${myChildren.length})` },
          { key: 'DRIVER', label: 'Driver Hub 🚌' },
          { key: 'TEACHER', label: `Teacher Verification 👩‍🏫 (${teacherData?.pendingArrivals?.length || 0})` },
          { key: 'SCANNER', label: 'QR Scanner 🔍' },
          { key: 'TRIPS', label: `Today's Runs (${trips.length})` },
          { key: 'ROUTES', label: `Routes (${routes.length})` },
          { key: 'VEHICLES', label: `Fleet (${vehicles.length})` },
          { key: 'STUDENTS', label: `Allocations (${assignments.length})` },
          { key: 'AUTHORIZATIONS', label: `Temp Pickups (${authorizations.length})` },
          { key: 'SECURITY', label: `Security Logs (${securityLogs.length})` },
          { key: 'SEED', label: 'Demo Seed & Test ⚡' },
        ]}
      />

      {/* ========================================================================= */}
      {/* TAB: PARENT — MY CHILDREN & TRANSPORT */}
      {/* ========================================================================= */}
      {tab === 'PARENT' && (
        <div style={{ marginTop: 16 }}>
          <div className="card-head" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ fontSize: 18 }}>Parent Transport Portal — My Children</div>
              <div className="card-sub">Independent transport status, route selection, and pickup authorization for each linked child</div>
            </div>
          </div>

          {myChildren.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center' }}>
              <Users size={40} style={{ color: 'var(--muted)', marginBottom: 12 }} />
              <h3>No Linked Children Found for Parent Account</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 500, margin: '8px auto 20px' }}>
                If you are testing as a parent, click below to seed demo master data with Rahul Patil and 3 linked children (Aarav, Siya, Ved).
              </p>
              <button className="btn btn-primary" onClick={handleSeedDemoData} disabled={busy}>
                <Zap size={14} /> Seed Demo Parent & Children Data
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {myChildren.map((child: any) => (
                <div key={child.studentId} className="card" style={{ padding: 20, borderTop: '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                      {getAvatarInitials(child.fullName)}
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{child.fullName}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Class: <b>{child.className}</b> • Adm: #{child.admissionNo}</div>
                    </div>
                  </div>

                  {child.assignment ? (
                    <div style={{ background: 'var(--c-surface-hover)', padding: 14, borderRadius: 10, marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>ASSIGNED ROUTE</span>
                        <StatusBadge status={child.assignment.status} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{child.assignment.routeName}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        📍 Pickup: <b>{child.assignment.pickupStop}</b> ({child.assignment.pickupTime})
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        🏁 Drop: <b>{child.assignment.dropStop}</b> ({child.assignment.dropTime})
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                        onClick={() => setRouteSelectionModal(child)}
                      >
                        <Edit3 size={13} /> Change Route / Stop
                      </button>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: 14, borderRadius: 10, marginBottom: 14, border: '1px dashed var(--warning)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning-dark)' }}>No Route Assigned Yet</div>
                      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 10px' }}>Select a preschool transport route for {child.firstName}.</p>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => setRouteSelectionModal(child)}
                      >
                        <Plus size={13} /> Select Transport Route
                      </button>
                    </div>
                  )}

                  {/* Today's Live Transport Status */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>
                      Today's Transport Status
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${child.todayStatus.status === 'BOARDED' || child.todayStatus.status === 'DROPPED' ? 'b-success' : 'b-info'}`}>
                        Morning: {child.todayStatus.status}
                      </span>
                      <span className={`badge ${child.todayStatus.status === 'ARRIVAL_VERIFIED' ? 'b-success' : child.todayStatus.status === 'ARRIVAL_SUBMITTED' ? 'b-warning' : 'b-neutral'}`}>
                        Arrival: {child.todayStatus.status === 'ARRIVAL_VERIFIED' ? 'Verified by Teacher' : child.todayStatus.status === 'ARRIVAL_SUBMITTED' ? 'Reported by Driver' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Pending Authorizations Alerts */}
                  {child.pendingAuthorizations && child.pendingAuthorizations.length > 0 && (
                    <div style={{ marginTop: 14, padding: 12, background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, border: '1px solid var(--danger)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={15} /> Pending Pickup Approval Request
                      </div>
                      {child.pendingAuthorizations.map((auth: any) => (
                        <div key={auth.id} style={{ marginTop: 8, fontSize: 12 }}>
                          <div>Person: <b>{auth.personName}</b> ({auth.relationship}, {auth.phone})</div>
                          <div>Action: <b>{auth.actionType}</b> • Reason: {auth.reason}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleApproveAuth(auth.id)} disabled={busy}>
                              Approve Request
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRejectAuth(auth.id)} disabled={busy}>
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DRIVER — HUB & BUS OPERATIONS */}
      {/* ========================================================================= */}
      {tab === 'DRIVER' && (
        <div style={{ marginTop: 16 }}>
          <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)', border: '1px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Driver Operational Console
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>Assigned Vehicle: BUS-01 (Tata Starbus)</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Route: <b>Route 001 — Kothrud Express</b> (Driver: Suresh Patil)</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={() => handleGenerateDriverQr(routes[0]?.id || 'r1', vehicles[0]?.id || 'v1')}>
                  <QrCode size={15} /> Display Driver Transport QR
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Today's Route Roster & Bus Arrival Submission</div>
                <div className="card-sub">Select arrived students and submit arrival to notify Class Teachers</div>
              </div>
            </div>

            {trips.length > 0 && trips[0]?.manifest ? (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {trips[0].manifest.map((m: any) => {
                    const isChecked = driverArrivedStudents.includes(m.studentId)
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setDriverArrivedStudents((prev) =>
                            prev.includes(m.studentId) ? prev.filter((id) => id !== m.studentId) : [...prev, m.studentId]
                          )
                        }}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 8,
                          background: isChecked ? 'rgba(34, 197, 94, 0.08)' : 'var(--c-surface-hover)',
                          border: isChecked ? '1px solid var(--success)' : '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ width: 18, height: 18 }} />
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>
                              {m.student.firstName} {m.student.lastName}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Stop: {m.stop?.name || 'Assigned Stop'}</div>
                          </div>
                        </div>
                        <StatusBadge status={m.status} />
                      </div>
                    )
                  })}
                </div>
                <button
                  className="btn btn-success"
                  onClick={() => handleDriverSubmitArrival(trips[0].id, driverArrivedStudents)}
                  disabled={busy || driverArrivedStudents.length === 0}
                >
                  <CheckCircle2 size={15} /> Submit Bus Arrival ({driverArrivedStudents.length} Students)
                </button>
              </div>
            ) : (
              <EmptyState title="No active trip found" message="Dispatch a trip to view today's student roster" icon={<Bus size={32} />} />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: TEACHER — CLASS ARRIVAL VERIFICATION */}
      {/* ========================================================================= */}
      {tab === 'TEACHER' && (
        <div style={{ marginTop: 16 }}>
          <div className="card-head" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ fontSize: 18 }}>Class Teacher Transport Verification (Nursery A)</div>
              <div className="card-sub">Verify student arrivals reported by bus drivers & review pickup authorization requests</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Pending Arrival Verification</div>
                  <div className="card-sub">Students reported arrived by bus driver awaiting teacher verification</div>
                </div>
              </div>

              {teacherData?.pendingArrivals && teacherData.pendingArrivals.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {teacherData.pendingArrivals.map((m: any) => {
                      const isChecked = teacherVerifiedStudents.includes(m.studentId)
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setTeacherVerifiedStudents((prev) =>
                              prev.includes(m.studentId) ? prev.filter((id) => id !== m.studentId) : [...prev, m.studentId]
                            )
                          }}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 8,
                            background: isChecked ? 'rgba(34, 197, 94, 0.08)' : 'var(--c-surface-hover)',
                            border: isChecked ? '1px solid var(--success)' : '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ width: 18, height: 18 }} />
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700 }}>
                                {m.student.firstName} {m.student.lastName}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Route: {m.trip?.route?.name || 'Bus Run'}</div>
                            </div>
                          </div>
                          <span className="badge b-warning">Reported by Driver</span>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    className="btn btn-success"
                    onClick={() => handleTeacherVerifyArrival(teacherData.pendingArrivals[0]?.tripId, teacherVerifiedStudents)}
                    disabled={busy || teacherVerifiedStudents.length === 0}
                  >
                    <ShieldCheck size={15} /> Verify Safe Arrival ({teacherVerifiedStudents.length} Students)
                  </button>
                </div>
              ) : (
                <EmptyState title="No pending arrival verifications" message="All bus arrivals have been verified by Class Teacher" icon={<ShieldCheck size={32} />} />
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Pickup Requests for Class Students</div>
                  <div className="card-sub">Temporary & unknown person pickup requests</div>
                </div>
              </div>

              {teacherData?.pendingAuthorizations && teacherData.pendingAuthorizations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {teacherData.pendingAuthorizations.map((auth: any) => (
                    <div key={auth.id} style={{ padding: 12, borderRadius: 8, background: 'var(--c-surface-hover)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Student: {auth.student.firstName} {auth.student.lastName}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        Person: <b>{auth.personName}</b> ({auth.relationship}, {auth.phone})
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Reason: {auth.reason}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleApproveAuth(auth.id)} disabled={busy}>
                          Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRejectAuth(auth.id)} disabled={busy}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No pending pickup requests" message="All pickup requests for class students are up to date" icon={<UserCheck size={32} />} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: SEED — DEMO DATA & SCENARIO TEST RUNNER */}
      {/* ========================================================================= */}
      {tab === 'SEED' && (
        <div style={{ marginTop: 16 }}>
          <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.02) 100%)', border: '1px solid var(--warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--warning-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Master Seed Data & Scenario Testing Harness
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>PreOne Demo Transport Master Setup</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Populates Tenant, Driver Suresh Patil, Bus BUS-01, Route 001 (Kothrud), Parent Rahul Patil, 3 Children (Aarav, Siya, Ved), and Class Teacher Priya Teacher.
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSeedDemoData} disabled={busy}>
                <Zap size={15} /> {seedResult ? 'Re-Seed Master Demo Data' : 'Seed Master Demo Data'}
              </button>
            </div>
          </div>

          {seedResult && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} /> Demo Master Data Active
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, fontSize: 13 }}>
                <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8 }}>
                  🚍 <b>Bus:</b> {seedResult.vehicle.regNo}
                </div>
                <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8 }}>
                  🗺️ <b>Route:</b> {seedResult.route.name} ({seedResult.route.stopsCount} Stops)
                </div>
                <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8 }}>
                  👨‍✈️ <b>Driver:</b> {seedResult.driver.name} ({seedResult.driver.username})
                </div>
                <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8 }}>
                  👨‍👩‍👧‍👦 <b>Parent:</b> {seedResult.parent.name} ({seedResult.parent.childrenCount} Children)
                </div>
                <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8 }}>
                  👩‍🏫 <b>Teacher:</b> {seedResult.teacher.name} ({seedResult.teacher.className})
                </div>
              </div>

              <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Generated Secure Driver Test QR Token:</div>
                <div style={{ padding: 12, background: '#000', color: '#00ff88', fontFamily: 'monospace', borderRadius: 8, fontSize: 12, wordBreak: 'break-all' }}>
                  {seedResult.testQrToken}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const token = seedResult.testQrToken
                      setScanInput(token)
                      setTab('SCANNER')
                      handlePerformScan(token)
                    }}
                  >
                    Load Token into QR Scanner 🔍
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTab('PARENT')}>
                    Go to Parent Portal 👨‍👩‍👧‍👦
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTab('TEACHER')}>
                    Go to Teacher View 👩‍🏫
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW — COMMAND CENTER */}
      {/* ========================================================================= */}
      {tab === 'OVERVIEW' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 16 }} className="dash-grid">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Active Daily Trips Progress</div>
                <div className="card-sub">Morning pickup and evening handover runs</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('TRIPS')}>
                Manage Runs <ArrowRight size={13} />
              </button>
            </div>
            {trips.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {trips.map((t) => {
                  const handledCount = t.manifest.filter((m: any) => m.status === 'BOARDED' || m.status === 'DROPPED').length
                  const progressPct = t.manifest.length > 0 ? Math.round((handledCount / t.manifest.length) * 100) : 0
                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: '14px 16px',
                        background: 'var(--c-surface-hover, rgba(0,0,0,0.02))',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{t.route.name}</span>
                            <span className="badge b-neutral" style={{ fontFamily: 'var(--font-mono)' }}>{t.route.code}</span>
                            <span className={`badge ${t.tripType === 'MORNING' ? 'b-primary' : 'b-purple'}`}>{t.tripType}</span>
                            <span className={`badge ${t.status === 'IN_PROGRESS' ? 'b-warning' : t.status === 'COMPLETED' ? 'b-success' : 'b-neutral'}`}>
                              {t.status}
                            </span>
                          </div>
                          <div className="t-caption" style={{ marginTop: 4 }}>
                            Bus: <b>{t.vehicle.registrationNumber}</b> · Driver: <b>{t.driverProfile.user.fullName}</b>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {handledCount} / {t.manifest.length} Handled ({progressPct}%)
                          </div>
                          {t.delayMinutes > 0 ? (
                            <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>
                              Delayed +{t.delayMinutes}m ({t.delayReason})
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>On time</div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: '100%',
                            background: t.status === 'COMPLETED' ? 'var(--success)' : 'var(--primary)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Bus size={36} />}
                title="No Runs Active Today"
                message="Click 'Dispatch Trip' to initiate a morning pickup or evening drop manifest."
                action={canOperate && <button className="btn btn-primary btn-sm" onClick={() => setStartTripOpen(true)}>Dispatch Trip</button>}
              />
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Fleet Readiness</div>
                <div className="card-sub">Active buses, vans, and maintenance guards</div>
              </div>
              {canWrite && (
                <button className="btn btn-ghost btn-sm" onClick={() => setAddVehicleOpen(true)}>
                  <Plus size={13} /> Add Bus
                </button>
              )}
            </div>
            {vehicles.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vehicles.slice(0, 6).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{v.registrationNumber}</div>
                      <div className="t-caption">
                        {v.makeModel || 'Standard Bus'} · Cap: <b>{v.capacity}</b> seats
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${v.status === 'ACTIVE' ? 'b-success' : v.status === 'MAINTENANCE' ? 'b-warning' : 'b-neutral'}`}>
                        {v.status}
                      </span>
                      {canWrite && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => handleToggleVehicleStatus(v.id, v.status)}
                          title="Toggle Maintenance Mode"
                        >
                          <Wrench size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Bus size={32} />} title="No Vehicles Registered" message="Register preschool buses or vans to assign to routes." />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TODAY'S TRIPS & LIVE MANIFESTS */}
      {/* ========================================================================= */}
      {tab === 'TRIPS' && (
        <div style={{ marginTop: 16 }}>
          {/* Trip Filters */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Filter:</span>
                <select
                  className="input"
                  style={{ width: 140, padding: '4px 8px', height: 32, fontSize: 13 }}
                  value={tripTypeFilter}
                  onChange={(e) => setTripTypeFilter(e.target.value as any)}
                >
                  <option value="ALL">All Trip Types</option>
                  <option value="MORNING">Morning Only</option>
                  <option value="EVENING">Evening Only</option>
                </select>

                <select
                  className="input"
                  style={{ width: 150, padding: '4px 8px', height: 32, fontSize: 13 }}
                  value={tripStatusFilter}
                  onChange={(e) => setTripStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DELAYED">Delayed Only</option>
                </select>

                <select
                  className="input"
                  style={{ width: 180, padding: '4px 8px', height: 32, fontSize: 13 }}
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                >
                  <option value="ALL">All Routes</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>

              {canOperate && (
                <button className="btn btn-primary btn-sm" onClick={() => setStartTripOpen(true)}>
                  <Plus size={13} /> Dispatch New Run
                </button>
              )}
            </div>
          </div>

          {filteredTrips.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {filteredTrips.map((t) => (
                <div key={t.id} className="card">
                  {/* Trip Header */}
                  <div className="card-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h3 className="t-h2" style={{ margin: 0 }}>{t.route.name}</h3>
                        <span className="badge b-neutral" style={{ fontFamily: 'var(--font-mono)' }}>{t.route.code}</span>
                        <span className={`badge ${t.tripType === 'MORNING' ? 'b-primary' : 'b-purple'}`}>{t.tripType} RUN</span>
                        <span className={`badge ${t.status === 'IN_PROGRESS' ? 'b-warning' : t.status === 'COMPLETED' ? 'b-success' : 'b-neutral'}`}>
                          {t.status}
                        </span>
                        {t.delayMinutes > 0 && (
                          <span className="badge b-danger">
                            <AlertTriangle size={11} style={{ marginRight: 4 }} /> DELAYED +{t.delayMinutes}m
                          </span>
                        )}
                      </div>
                      <div className="t-caption" style={{ marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <span>Bus: <b>{t.vehicle.registrationNumber}</b> (Cap: {t.vehicle.capacity})</span>
                        <span>Driver: <b>{t.driverProfile.user.fullName}</b></span>
                        {t.attendantProfile && <span>Attendant: <b>{t.attendantProfile.user.fullName}</b></span>}
                        <span>Date: <b>{fmtDate(t.tripDate)}</b></span>
                      </div>
                      {t.notes && (
                        <div style={{ fontSize: 12, color: 'var(--c-muted)', fontStyle: 'italic', marginTop: 4 }}>
                          Operational notes: {t.notes}
                        </div>
                      )}
                    </div>

                    {/* Operational Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {t.status === 'IN_PROGRESS' && canOperate && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSubstituteVehicleModal(t)}
                            title="Substitute Vehicle In-Flight"
                          >
                            <Bus size={13} /> Sub Bus
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSubstituteDriverModal(t)}
                            title="Substitute Driver In-Flight"
                          >
                            <UserCheck size={13} /> Sub Driver
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setDelayTripOpen(t)}>
                            <AlertTriangle size={13} /> Log Delay
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setIncidentTripPrefill(t)
                              setReportIncidentOpen(true)
                            }}
                          >
                            <AlertOctagon size={13} /> Log Incident
                          </button>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={async () => {
                              await fetch(`/api/v1/transport/trips/${t.id}/complete`, { method: 'POST' })
                              toast.success('Trip completed upon arrival!')
                              loadTrips()
                              loadDashboard()
                            }}
                          >
                            <CheckCircle2 size={13} /> Complete Run
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Student Manifest Roster */}
                  <div style={{ overflowX: 'auto', marginTop: 12 }}>
                    <table className="table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Child Identity</th>
                          <th>Designated Stop</th>
                          <th>Transit Status</th>
                          <th>Verification / Timestamp</th>
                          <th style={{ textAlign: 'right' }}>Child Safety Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.manifest.map((item: any) => {
                          const fullName = `${item.student.firstName} ${item.student.lastName || ''}`
                          return (
                            <tr key={item.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: '50%',
                                      background: 'var(--bg-surface-hover)',
                                      color: 'var(--primary)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      border: '1px solid var(--border)',
                                    }}
                                  >
                                    {getAvatarInitials(fullName)}
                                  </div>
                                  <div>
                                    <Link
                                      href={`/app/students/${item.student.id}`}
                                      style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}
                                      className="hover:underline"
                                    >
                                      {fullName}
                                    </Link>
                                    <div className="t-caption">Adm: {item.student.admissionNo}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <b>{item.stop.name}</b>
                                <div className="t-caption">
                                  Seq {item.stop.sequence} · {t.tripType === 'MORNING' ? item.stop.morningPickupTime : item.stop.eveningDropTime}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    item.status === 'BOARDED' || item.status === 'DROPPED'
                                      ? 'b-success'
                                      : item.status === 'ABSENT'
                                      ? 'b-danger'
                                      : 'b-warning'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td>
                                {item.status === 'BOARDED' && item.boardedAt ? (
                                  <div style={{ fontSize: 13 }}>
                                    Boarded at {new Date(item.boardedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                ) : item.status === 'DROPPED' && item.droppedAt ? (
                                  <div style={{ fontSize: 13 }}>
                                    Handed over at {new Date(item.droppedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Awaiting action</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {t.status === 'IN_PROGRESS' && canOperate && (
                                  <div style={{ display: 'inline-flex', gap: 6 }}>
                                    {t.tripType === 'MORNING' && item.status !== 'BOARDED' && (
                                      <button className="btn btn-primary btn-sm" onClick={() => handleBoard(t.id, item.student.id)}>
                                        <UserCheck size={13} /> Board Child
                                      </button>
                                    )}
                                    {t.tripType === 'EVENING' && item.status !== 'DROPPED' && (
                                      <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => {
                                          setDropVerifyOpen({ tripId: t.id, student: item.student, stop: item.stop })
                                          setSelectedGuardianId(item.student.guardians?.[0]?.guardian?.id || '')
                                          setPickupPin('')
                                          setDropError(null)
                                        }}
                                      >
                                        <KeyRound size={13} /> Verify & Drop
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <EmptyState
                icon={<Bus size={36} />}
                title="No Runs Found"
                message="No trips matching your filter. Clear filters or dispatch a new morning/evening run."
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ROUTES & STOPS */}
      {/* ========================================================================= */}
      {tab === 'ROUTES' && (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Configured Bus Routes</div>
                <div className="card-sub">Stops, sequencing, assigned bus, driver and attendant</div>
              </div>
              {canWrite && (
                <button className="btn btn-primary btn-sm" onClick={() => setAddRouteOpen(true)}>
                  <Plus size={13} /> Add Route
                </button>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Assigned Vehicle</th>
                    <th>Driver & Attendant</th>
                    <th>Ordered Stops Timeline</th>
                    <th>Students / Capacity</th>
                    <th>Status</th>
                    {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>{r.name}</b>
                        <div className="t-caption" style={{ fontFamily: 'var(--font-mono)' }}>{r.code}</div>
                        {r.description && <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>{r.description}</div>}
                      </td>
                      <td>
                        {r.vehicle ? (
                          <div>
                            <b>{r.vehicle.registrationNumber}</b>
                            <div className="t-caption">
                              Cap: {r.vehicle.capacity} ({r.availableCapacity} seats free)
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--c-muted)' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div>Driver: <b>{r.driverProfile?.user?.fullName || 'Not assigned'}</b></div>
                        <div className="t-caption">Attendant: {r.attendantProfile?.user?.fullName || 'Not assigned'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.stops.map((s: any) => (
                            <span key={s.id} className="badge b-neutral" style={{ fontSize: 11 }}>
                              {s.sequence}. {s.name} ({s.morningPickupTime})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <b>{r.activeStudentsCount}</b> / {r.vehicle?.capacity || '—'}
                      </td>
                      <td>
                        <span className={`badge ${r.status === 'ACTIVE' ? 'b-success' : 'b-neutral'}`}>{r.status}</span>
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditRouteModal(r)}
                            title="Edit Route & Assignments"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FLEET (VEHICLES) */}
      {/* ========================================================================= */}
      {tab === 'VEHICLES' && (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">School Transport Fleet</div>
                <div className="card-sub">Registration, capacity, and maintenance status</div>
              </div>
              {canWrite && (
                <button className="btn btn-primary btn-sm" onClick={() => setAddVehicleOpen(true)}>
                  <Plus size={13} /> Register Vehicle
                </button>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Registration No</th>
                    <th>Type & Make</th>
                    <th>Seating Capacity</th>
                    <th>Assigned Route</th>
                    <th>Status</th>
                    {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <b>{v.registrationNumber}</b>
                        {v.notes && <div className="t-caption">{v.notes}</div>}
                      </td>
                      <td>
                        {v.makeModel || 'Standard School Bus'}
                        <div className="t-caption">{v.vehicleType}</div>
                      </td>
                      <td>
                        <b>{v.capacity}</b> seats
                      </td>
                      <td>
                        {v.routes && v.routes.length > 0 ? (
                          v.routes.map((r: any) => <span key={r.id} className="badge b-neutral">{r.name}</span>)
                        ) : (
                          <span style={{ color: 'var(--c-muted)' }}>Idle / Standby</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${v.status === 'ACTIVE' ? 'b-success' : v.status === 'MAINTENANCE' ? 'b-warning' : 'b-neutral'}`}>
                          {v.status}
                        </span>
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleToggleVehicleStatus(v.id, v.status)}
                              title={v.status === 'ACTIVE' ? 'Mark in Maintenance' : 'Set Active'}
                            >
                              <Wrench size={13} /> {v.status === 'ACTIVE' ? 'Maintenance' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setEditVehicleModal(v)}
                              title="Edit Vehicle"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: STUDENT ALLOCATIONS */}
      {/* ========================================================================= */}
      {tab === 'STUDENTS' && (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Student Transport Allocations</div>
                <div className="card-sub">Active seat allocations, stops, trip types, and fee invoices</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--c-muted)' }} />
                  <input
                    type="text"
                    className="input"
                    style={{ paddingLeft: 30, height: 34, width: 220, fontSize: 13 }}
                    placeholder="Search child or route..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>
                {canWrite && (
                  <button className="btn btn-primary btn-sm" onClick={() => setAssignStudentOpen(true)}>
                    <UserPlus size={13} /> Assign Student
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Student Identity</th>
                    <th>Route</th>
                    <th>Pickup Stop</th>
                    <th>Drop Stop</th>
                    <th>Trip Type</th>
                    <th>Monthly Fee</th>
                    <th>Status</th>
                    {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a) => {
                    const fullName = `${a.student.firstName} ${a.student.lastName || ''}`
                    return (
                      <tr key={a.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: 'var(--bg-surface-hover)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              {getAvatarInitials(fullName)}
                            </div>
                            <div>
                              <Link
                                href={`/app/students/${a.student.id}`}
                                style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}
                                className="hover:underline"
                              >
                                {fullName}
                              </Link>
                              <div className="t-caption">{a.student.admissionNo} · {a.student.currentClassroom?.name || 'Classroom'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <b>{a.route.name}</b>
                          <div className="t-caption" style={{ fontFamily: 'var(--font-mono)' }}>{a.route.code}</div>
                        </td>
                        <td>{a.pickupStop.name} ({a.pickupStop.morningPickupTime})</td>
                        <td>{a.dropStop.name} ({a.dropStop.eveningDropTime})</td>
                        <td><span className="badge b-neutral">{a.tripType}</span></td>
                        <td>{a.monthlyFeeCents > 0 ? inr(a.monthlyFeeCents) : 'Included'}</td>
                        <td><span className={`badge ${a.status === 'ACTIVE' ? 'b-success' : 'b-neutral'}`}>{a.status}</span></td>
                        {canWrite && (
                          <td style={{ textAlign: 'right' }}>
                            {a.status === 'ACTIVE' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => setCancelAssignmentModal(a)}
                                title="Discontinue Transport Service"
                              >
                                <UserX size={13} /> Cancel
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {filteredAssignments.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                        <EmptyState icon={<Users size={32} />} title="No allocations found" message="Allocate seats to enrolled students." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SAFETY & INCIDENTS */}
      {/* ========================================================================= */}
      {tab === 'INCIDENTS' && (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Transport Safety & Incident Log</div>
                <div className="card-sub">Operations exceptions, emergency follow-ups, and resolution tracking</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  className="input"
                  style={{ width: 150, padding: '4px 8px', height: 32, fontSize: 13 }}
                  value={incidentSeverityFilter}
                  onChange={(e) => setIncidentSeverityFilter(e.target.value)}
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical Only</option>
                  <option value="HIGH">High Only</option>
                  <option value="MEDIUM">Medium Only</option>
                  <option value="LOW">Low Only</option>
                </select>
                {canOperate && (
                  <button className="btn btn-danger btn-sm" onClick={() => setReportIncidentOpen(true)}>
                    <AlertOctagon size={13} /> Report Incident
                  </button>
                )}
              </div>
            </div>

            {filteredIncidents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: inc.severity === 'CRITICAL' || inc.severity === 'HIGH' ? '1.5px solid var(--danger)' : '1px solid var(--border)',
                      background: inc.severity === 'CRITICAL' ? 'rgba(220, 38, 38, 0.04)' : 'var(--bg-surface-hover)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`badge ${inc.severity === 'CRITICAL' ? 'b-danger' : inc.severity === 'HIGH' ? 'b-orange' : 'b-warning'}`}>
                          {inc.severity}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{inc.title}</span>
                        <span className="badge b-neutral">{inc.category}</span>
                        {(inc.severity === 'HIGH' || inc.severity === 'CRITICAL') && (
                          <span className="badge b-danger">OPERATIONS ESCALATED</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${inc.status === 'RESOLVED' ? 'b-success' : 'b-info'}`}>{inc.status}</span>
                        {canOperate && inc.status !== 'RESOLVED' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setResolveIncidentModal(inc)}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--foreground)', opacity: 0.85, margin: '8px 0' }}>{inc.description}</p>

                    {inc.actionTaken && (
                      <div style={{ fontSize: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.03)', borderRadius: 6, marginBottom: 6 }}>
                        <b>Action Taken:</b> {inc.actionTaken}
                      </div>
                    )}

                    <div className="t-caption" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>Reported by: <b>{inc.reportedByName}</b></span>
                      <span>Date: <b>{fmtDate(inc.createdAt)}</b></span>
                      {inc.vehicle && <span>Bus: <b>{inc.vehicle.registrationNumber}</b></span>}
                      {inc.student && <span>Student: <b>{inc.student.firstName} {inc.student.lastName || ''}</b></span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<ShieldCheck size={36} />} title="Zero Incidents On Record" message="All transit operations are running cleanly without safety flags." />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: UNIVERSAL QR SCANNER */}
      {/* ========================================================================= */}
      {tab === 'SCANNER' && (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Universal Transport & Child Safety QR Scanner</div>
                <div className="card-sub">Instant server-side verification for Student, Guardian, Driver, and Temporary Pickup Authorizations</div>
              </div>
            </div>

            <div style={{ padding: 16, background: 'var(--c-surface-hover)', borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Scan QR Code payload or enter payload (e.g. STUDENT:st_1, GUARDIAN:g_1, DRIVER:d_1, AUTH:a_1)"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePerformScan()}
                  style={{ fontSize: 14, padding: '10px 14px', flex: 1, minWidth: 280 }}
                />
                <button className="btn btn-primary" onClick={() => handlePerformScan()} disabled={scanningBusy}>
                  {scanningBusy ? 'Verifying...' : 'Verify Payload'}
                </button>
                {!cameraActive ? (
                  <button className="btn btn-secondary" onClick={startCameraScan}>
                    📷 Open Mobile Camera Scanner
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={stopCameraScan}>
                    ⏹ Stop Camera Scanner
                  </button>
                )}
              </div>

              {cameraActive && (
                <div style={{ marginTop: 14, textAlign: 'center', padding: 10, background: '#000', borderRadius: 12 }}>
                  <video ref={videoRef} style={{ width: '100%', maxHeight: 260, borderRadius: 8, objectFit: 'cover' }} muted playsInline />
                  <div style={{ fontSize: 12, color: '#00ff88', marginTop: 8 }}>
                    Point mobile camera directly at QR Code image
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
                <span style={{ opacity: 0.7 }}>Quick Test Simulations:</span>
                {availableStudents.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const payload = `STUDENT:${availableStudents[0].id}`
                      setScanInput(payload)
                      handlePerformScan(payload)
                    }}
                  >
                    Scan Student ({availableStudents[0].firstName})
                  </button>
                )}
                {authorizations.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const payload = `AUTH:${authorizations[0].id}`
                      setScanInput(payload)
                      handlePerformScan(payload)
                    }}
                  >
                    Scan Temp Auth ({authorizations[0].authorizedPersonName})
                  </button>
                )}
                {scanInput && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowVisualQr(scanInput)}
                    style={{ marginLeft: 'auto' }}
                  >
                    📱 View Visual QR Code Image
                  </button>
                )}
              </div>
            </div>

            {scanResult && (
              <div
                style={{
                  padding: 20,
                  borderRadius: 12,
                  border: scanResult.valid ? '2px solid var(--success)' : '2px solid var(--danger)',
                  background: scanResult.valid ? 'rgba(34, 197, 94, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge ${scanResult.valid ? 'b-success' : 'b-danger'}`} style={{ fontSize: 14, padding: '6px 12px' }}>
                      {scanResult.status}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{scanResult.message}</span>
                  </div>
                  <span className="badge b-neutral">Scan Type: {scanResult.scanType}</span>
                </div>

                {/* Driver Scan Specific PIN Form */}
                {scanResult.scanType === 'DRIVER' && (
                  <div style={{ marginTop: 12, padding: 14, background: 'var(--c-surface-hover)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Driver Security PIN Verification</div>
                    <div style={{ display: 'flex', gap: 10, maxWidth: 300 }}>
                      <input
                        type="password"
                        className="input"
                        placeholder="Enter 4-digit PIN"
                        value={scanDriverPin}
                        onChange={(e) => setScanDriverPin(e.target.value)}
                        maxLength={6}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={() => handlePerformScan()}>
                        Verify PIN
                      </button>
                    </div>
                  </div>
                )}

                {/* Student Scan Result Details */}
                {scanResult.student && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                    <div style={{ padding: 14, background: 'var(--c-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--foreground)', opacity: 0.7, marginBottom: 4 }}>Student Identity</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {scanResult.student.firstName} {scanResult.student.lastName || ''}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.8 }}>Roll / Admission #: {scanResult.student.rollNumber || 'N/A'}</div>
                      <div style={{ marginTop: 8 }}>
                        <span className={`badge ${scanResult.transportAssigned ? 'b-success' : 'b-warning'}`}>
                          {scanResult.transportAssigned ? 'Transport Enrolled' : 'No Active Bus Assignment'}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: 14, background: 'var(--c-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--foreground)', opacity: 0.7, marginBottom: 4 }}>Linked Guardians</div>
                      {scanResult.guardians && scanResult.guardians.length > 0 ? (
                        scanResult.guardians.map((g: any) => (
                          <div key={g.id} style={{ fontSize: 13, marginBottom: 4 }}>
                            <b>{g.name}</b> ({g.relationship || 'Guardian'}) — 📞 {g.phone || 'No phone'}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--warning)' }}>No linked guardians registered</div>
                      )}

                      {scanResult.activeTemporaryAuthorization && (
                        <div style={{ marginTop: 10, padding: 8, background: 'rgba(234, 179, 8, 0.1)', borderRadius: 6, fontSize: 12 }}>
                          🚨 <b>Active Temp Pickup Authorization:</b> {scanResult.activeTemporaryAuthorization.authorizedPersonName} ({scanResult.activeTemporaryAuthorization.relationship})
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Interactive Gate Pickup & Action Form */}
                {scanResult.student && (
                  <div style={{ marginTop: 16, padding: 16, background: 'var(--c-surface-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      📋 Gate Pickup & Handover Action Form
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      <button
                        className={`btn btn-sm ${scanActionMode === 'REGISTERED_PICKUP' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setScanActionMode(scanActionMode === 'REGISTERED_PICKUP' ? 'NONE' : 'REGISTERED_PICKUP')}
                      >
                        ✅ Confirm Registered Guardian Handover
                      </button>
                      <button
                        className={`btn btn-sm ${scanActionMode === 'UNKNOWN_REQUEST' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setScanActionMode(scanActionMode === 'UNKNOWN_REQUEST' ? 'NONE' : 'UNKNOWN_REQUEST')}
                      >
                        🚨 Alternate / Unknown Person Pickup Request
                      </button>
                    </div>

                    {scanActionMode === 'REGISTERED_PICKUP' && (
                      <div style={{ padding: 12, background: 'var(--c-surface)', borderRadius: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Confirm Handover to Registered Guardian</div>
                        <input
                          type="text"
                          className="input"
                          placeholder="Gate / Handover notes (optional)..."
                          value={scanGateNotes}
                          onChange={(e) => setScanGateNotes(e.target.value)}
                          style={{ fontSize: 13, marginBottom: 10 }}
                        />
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleConfirmRegisteredPickup(scanResult.student.id)}
                          disabled={scanSubmitting}
                        >
                          {scanSubmitting ? 'Logging Pickup...' : 'Complete & Log Registered Guardian Pickup ✅'}
                        </button>
                      </div>
                    )}

                    {scanActionMode === 'UNKNOWN_REQUEST' && (
                      <div style={{ padding: 12, background: 'var(--c-surface)', borderRadius: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Submit Instant Parent/Teacher Approval Request</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, opacity: 0.7 }}>Person Full Name *</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g. Ramesh Sharma"
                              value={scanPersonName}
                              onChange={(e) => setScanPersonName(e.target.value)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, opacity: 0.7 }}>Contact Phone Number *</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g. +919876543210"
                              value={scanPersonPhone}
                              onChange={(e) => setScanPersonPhone(e.target.value)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, opacity: 0.7 }}>Relationship to Student</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g. Uncle / Neighbor / Driver"
                              value={scanPersonRelation}
                              onChange={(e) => setScanPersonRelation(e.target.value)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, opacity: 0.7 }}>Reason / Remarks</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g. Emergency family visit"
                              value={scanGateNotes}
                              onChange={(e) => setScanGateNotes(e.target.value)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                        </div>
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => handleSubmitUnknownPersonRequest(scanResult.student.id)}
                          disabled={scanSubmitting}
                        >
                          {scanSubmitting ? 'Sending Request...' : 'Send Urgent Approval Request to Parent & Teacher 📲'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Authorization Scan Result Details */}
                {scanResult.authorization && (
                  <div style={{ padding: 14, background: 'var(--c-surface)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 12 }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Temporary Authorized Pickup Person</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                      {scanResult.authorization.authorizedPersonName} ({scanResult.authorization.relationship})
                    </div>
                    <div style={{ fontSize: 13 }}>📞 Phone: {scanResult.authorization.authorizedPersonPhone}</div>
                    <div style={{ fontSize: 13 }}>Reason: {scanResult.authorization.reason || 'N/A'}</div>
                    {scanResult.authorization.student && (
                      <div style={{ fontSize: 13, marginTop: 6, padding: 6, background: 'var(--c-surface-hover)', borderRadius: 6 }}>
                        Child: <b>{scanResult.authorization.student.firstName} {scanResult.authorization.student.lastName || ''}</b>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Action Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  {scanResult.student && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setTab('AUTHORIZATIONS')
                        setAddAuthOpen(true)
                      }}
                    >
                      + Register Temp Authorization for Student
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => setManualOverrideModal({ studentId: scanResult.student?.id })}>
                    Trigger Manual Security Override
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: TEMPORARY PICKUP AUTHORIZATIONS */}
      {/* ========================================================================= */}
      {tab === 'AUTHORIZATIONS' && (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Temporary Authorized Pickups</div>
                <div className="card-sub">Alternate non-parent pickup requests requiring explicit staff verification</div>
              </div>
              {(canOperate || normalizeRole(role) === 'PARENT') && (
                <button className="btn btn-primary btn-sm" onClick={() => setAddAuthOpen(true)}>
                  <Plus size={14} /> Request Temp Pickup
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Authorized Pickup Person</th>
                    <th>Relationship</th>
                    <th>Reason</th>
                    <th>Valid Window</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authorizations.map((auth) => (
                    <tr key={auth.id}>
                      <td>
                        <b>
                          {auth.student?.firstName} {auth.student?.lastName || ''}
                        </b>
                      </td>
                      <td>
                        <div><b>{auth.authorizedPersonName}</b></div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>📞 {auth.authorizedPersonPhone}</div>
                      </td>
                      <td>{auth.relationship || 'Alternate'}</td>
                      <td style={{ maxWidth: 180, fontSize: 13 }}>{auth.reason || 'N/A'}</td>
                      <td style={{ fontSize: 12 }}>
                        {fmtDate(auth.validFrom)} - {fmtDate(auth.validUntil)}
                      </td>
                      <td>
                        <span className="badge b-neutral">{auth.isOneTime ? 'One-Time' : 'Multiple'}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            auth.status === 'APPROVED'
                              ? 'b-success'
                              : auth.status === 'PENDING'
                              ? 'b-warning'
                              : auth.status === 'REJECTED'
                              ? 'b-danger'
                              : 'b-neutral'
                          }`}
                        >
                          {auth.status}
                        </span>
                      </td>
                      <td>
                        {auth.status === 'PENDING' && canOperate && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleActionAuthorization(auth.id, 'APPROVE')}
                              disabled={busy}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleActionAuthorization(auth.id, 'REJECT')}
                              disabled={busy}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {auth.status === 'APPROVED' && canOperate && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleActionAuthorization(auth.id, 'CANCEL')}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {authorizations.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                        <EmptyState
                          icon={<ShieldCheck size={32} />}
                          title="No Temporary Pickup Authorizations"
                          message="Registered alternate pickup authorizations will be displayed here."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: TRANSPORT SECURITY & AUDIT LOGS */}
      {/* ========================================================================= */}
      {tab === 'SECURITY' && (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Transport Security & Immutable Audit Trail</div>
                <div className="card-sub">Real-time log of security checks, PIN attempts, QR scans, and manual overrides</div>
              </div>
              {canOperate && (
                <button className="btn btn-danger btn-sm" onClick={() => setManualOverrideModal({})}>
                  <AlertTriangle size={14} /> Record Manual Override
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>Actor / Staff</th>
                    <th>Student / Context</th>
                    <th>Result</th>
                    <th>Reason / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {securityLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12 }}>{fmtDate(log.createdAt)}</td>
                      <td>
                        <span className="badge b-neutral" style={{ fontSize: 11 }}>
                          {log.eventType}
                        </span>
                      </td>
                      <td>{log.actorName || 'System'}</td>
                      <td>{log.student ? `${log.student.firstName} ${log.student.lastName || ''}` : 'N/A'}</td>
                      <td>
                        <span
                          className={`badge ${
                            log.result === 'SUCCESS' || log.result === 'VERIFIED'
                              ? 'b-success'
                              : log.result === 'FAILED' || log.result === 'BLOCKED'
                              ? 'b-danger'
                              : 'b-warning'
                          }`}
                        >
                          {log.result}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, maxWidth: 250 }}>{log.reason || 'N/A'}</td>
                    </tr>
                  ))}
                  {securityLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                        <EmptyState
                          icon={<ShieldCheck size={32} />}
                          title="Zero Security Alerts"
                          message="No unauthorized attempts or security infractions logged."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE TEMPORARY PICKUP AUTHORIZATION */}
      {/* ========================================================================= */}
      <Modal
        open={addAuthOpen}
        onClose={() => setAddAuthOpen(false)}
        title="Register Temporary Pickup Authorization"
        subtitle="Authorize an alternate non-parent individual for student handover"
        icon={<UserCheck size={20} />}
      >
        <form onSubmit={handleCreateAuthorization}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Select Student" required>
              <select name="studentId" className="input" required defaultValue="">
                <option value="" disabled>
                  -- Select Student --
                </option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName || ''} ({s.rollNumber || s.id})
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Authorized Person Name" required>
                <input type="text" name="authorizedPersonName" className="input" placeholder="e.g. Ramesh Kumar (Uncle)" required />
              </Field>
              <Field label="Mobile Phone Number" required>
                <input type="tel" name="authorizedPersonPhone" className="input" placeholder="9876543210" required />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Relationship to Student">
                <input type="text" name="relationship" className="input" placeholder="Uncle / Family Friend / Driver" defaultValue="Family Friend" />
              </Field>
              <Field label="Usage Type">
                <select name="isOneTime" className="input" defaultValue="true">
                  <option value="true">One-Time Only</option>
                  <option value="false">Multiple Pickups in Window</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Valid From" required>
                <input type="datetime-local" name="validFrom" className="input" required defaultValue={new Date().toISOString().slice(0, 16)} />
              </Field>
              <Field label="Valid Until" required>
                <input type="datetime-local" name="validUntil" className="input" required defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 16)} />
              </Field>
            </div>

            <Field label="Reason for Alternate Pickup" required>
              <textarea name="reason" rows={2} className="input" placeholder="Parent travelling / emergency family situation" required />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAddAuthOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Create Authorization
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: MANUAL SECURITY OVERRIDE */}
      {/* ========================================================================= */}
      <Modal
        open={!!manualOverrideModal}
        onClose={() => setManualOverrideModal(null)}
        title="Record Manual Transport Security Override"
        subtitle="Requires mandatory justification logged to audit trail"
        icon={<AlertTriangle size={20} />}
      >
        <form onSubmit={handleManualOverride}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Select Student" required>
              <select name="studentId" className="input" required defaultValue={manualOverrideModal?.studentId || ''}>
                <option value="" disabled>
                  -- Select Student --
                </option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName || ''} ({s.rollNumber || s.id})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Override Action" required>
              <select name="action" className="input" defaultValue="MANUAL_PICKUP_RELEASE">
                <option value="MANUAL_PICKUP_RELEASE">MANUAL_PICKUP_RELEASE — Release student without QR/PIN</option>
                <option value="MANUAL_BOARDING_CONFIRM">MANUAL_BOARDING_CONFIRM — Confirm student boarding without scanner</option>
                <option value="MANUAL_DRIVER_BYPASS">MANUAL_DRIVER_BYPASS — Authorize temporary driver bypass</option>
              </select>
            </Field>

            <Field label="Detailed Justification / Reason" required>
              <textarea
                name="reason"
                rows={3}
                className="input"
                placeholder="Parent phone battery dead; identity verified face-to-face by Receptionist Ramesh..."
                required
              />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setManualOverrideModal(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              Log & Approve Manual Override
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: SAFE DROP & MULTI-GUARDIAN VERIFICATION */}
      {/* ========================================================================= */}
      <Modal
        open={!!dropVerifyOpen}
        onClose={() => { setDropVerifyOpen(null); setDropError(null); }}
        title="Child Handover & PIN Verification"
        subtitle="Mandatory preschool safety release protocol"
        icon={<ShieldCheck size={20} />}
      >
        {dropVerifyOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Child Profile Banner */}
            <div style={{ padding: 12, background: 'rgba(5, 150, 105, 0.08)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  color: 'var(--text-inverse)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {getAvatarInitials(`${dropVerifyOpen.student.firstName} ${dropVerifyOpen.student.lastName || ''}`)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {dropVerifyOpen.student.firstName} {dropVerifyOpen.student.lastName || ''}
                </div>
                <div className="t-caption">Admission No: {dropVerifyOpen.student.admissionNo} · Stop: <b>{dropVerifyOpen.stop.name}</b></div>
              </div>
            </div>

            {/* Error / Unauthorized Block Alert Banner */}
            {dropError && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1.5px solid var(--danger)',
                  color: 'var(--danger)',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <AlertOctagon size={16} /> RELEASE STRICTLY BLOCKED
                </div>
                <div style={{ marginTop: 4 }}>{dropError}</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                  An Emergency Safety Follow-Up has been logged for the Principal. Do not release the child.
                </div>
              </div>
            )}

            {/* Guardian Selection */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Collecting Adult Present at Stop:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dropVerifyOpen.student.guardians?.map((g: any) => {
                  const isSelected = selectedGuardianId === g.guardian.id
                  const isAuthorized = g.canPickup
                  return (
                    <label
                      key={g.guardian.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--c-surface-hover, rgba(0,0,0,0.02))',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="radio"
                          name="selectedGuardian"
                          value={g.guardian.id}
                          checked={isSelected}
                          onChange={() => { setSelectedGuardianId(g.guardian.id); setDropError(null); }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{g.guardian.fullName}</div>
                          <div className="t-caption">{g.relationship || g.guardian.relationship} · {g.guardian.phone || 'No phone'}</div>
                        </div>
                      </div>
                      <span className={`badge ${isAuthorized ? 'b-success' : 'b-danger'}`}>
                        {isAuthorized ? 'Authorized' : 'REVOKED / UNAUTHORIZED'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <Field label="Guardian 4-Digit Security PIN" required helper="Enter the collecting adult's verification PIN">
              <input
                type="password"
                className="input"
                placeholder="••••"
                value={pickupPin}
                onChange={(e) => setPickupPin(e.target.value)}
                maxLength={6}
                autoFocus
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDropVerifyOpen(null)}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={handleDropConfirm} disabled={busy}>
                Verify & Release Child
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: DISPATCH TRIP */}
      {/* ========================================================================= */}
      <Modal open={startTripOpen} onClose={() => setStartTripOpen(false)} title="Dispatch Daily Trip" subtitle="Dynamic manifest populated from active seat allocations" icon={<Clock size={20} />}>
        <form onSubmit={handleStartTrip}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Select Route" required>
              <select name="routeId" className="input" required>
                <option value="">-- Choose Route --</option>
                {routes.filter((r) => r.status === 'ACTIVE').map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.code}) · {r.activeStudentsCount} riders</option>
                ))}
              </select>
            </Field>
            <Field label="Trip Run" required>
              <select name="tripType" className="input" defaultValue="MORNING">
                <option value="MORNING">Morning Pickup Run (Home to Campus)</option>
                <option value="EVENING">Evening Drop Run (Campus to Home)</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStartTripOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Dispatch Run</button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: SUBSTITUTE VEHICLE */}
      {/* ========================================================================= */}
      <Modal
        open={!!substituteVehicleModal}
        onClose={() => setSubstituteVehicleModal(null)}
        title="Substitute Vehicle In-Flight"
        subtitle="Preserves audit trail and updates active trip"
        icon={<Bus size={20} />}
      >
        {substituteVehicleModal && (
          <form onSubmit={handleSubstituteVehicle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Current Bus: <b>{substituteVehicleModal.vehicle.registrationNumber}</b> ({substituteVehicleModal.route.name})
              </div>
              <Field label="Select Standby Replacement Bus" required>
                <select name="vehicleId" className="input" required>
                  <option value="">-- Select Active Vehicle --</option>
                  {vehicles
                    .filter((v) => v.status === 'ACTIVE' && v.id !== substituteVehicleModal.vehicle.id)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} ({v.makeModel || 'Standby'} · Cap: {v.capacity})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Reason for In-Flight Substitution" required>
                <input type="text" name="reason" className="input" placeholder="Flat tyre / AC compressor failure" required />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSubstituteVehicleModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-warning" disabled={busy}>Confirm Substitution</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: SUBSTITUTE DRIVER */}
      {/* ========================================================================= */}
      <Modal
        open={!!substituteDriverModal}
        onClose={() => setSubstituteDriverModal(null)}
        title="Substitute Driver In-Flight"
        subtitle="Select from active canonical HR staff profiles"
        icon={<UserCheck size={20} />}
      >
        {substituteDriverModal && (
          <form onSubmit={handleSubstituteDriver}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Current Driver: <b>{substituteDriverModal.driverProfile.user.fullName}</b> ({substituteDriverModal.route.name})
              </div>
              <Field label="Select Replacement Driver (from HR Staff Directory)" required>
                <select name="driverProfileId" className="input" required>
                  <option value="">-- Select Eligible Driver --</option>
                  {eligibleStaff
                    .filter((s) => s.id !== substituteDriverModal.driverProfile.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.designation} · {s.employeeCode})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Reason for In-Flight Substitution" required>
                <input type="text" name="reason" className="input" placeholder="Driver medical indisposition / shift handover" required />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSubstituteDriverModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-warning" disabled={busy}>Confirm Substitution</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: REPORT DELAY */}
      {/* ========================================================================= */}
      <Modal open={!!delayTripOpen} onClose={() => setDelayTripOpen(null)} title="Broadcast Trip Delay" subtitle="Alerts affected parents on their timelines" icon={<AlertTriangle size={20} />}>
        {delayTripOpen && (
          <form onSubmit={handleRecordDelay}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Route: <b>{delayTripOpen.route.name}</b> · Bus: <b>{delayTripOpen.vehicle.registrationNumber}</b>
              </div>
              <Field label="Estimated Delay (Minutes)" required>
                <input type="number" name="delayMinutes" defaultValue={delayTripOpen.delayMinutes || 15} min={1} className="input" required />
              </Field>
              <Field label="Preset Delay Reason" required>
                <select
                  className="input"
                  name="reason"
                  defaultValue={delayTripOpen.delayReason || 'Heavy traffic congestion'}
                >
                  <option value="Heavy traffic congestion">Heavy traffic congestion</option>
                  <option value="Road work and diversion">Road work and diversion</option>
                  <option value="Vehicle breakdown / puncture">Vehicle breakdown / puncture</option>
                  <option value="Severe weather / rain">Severe weather / rain</option>
                  <option value="Student pickup delay at stop">Student pickup delay at stop</option>
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDelayTripOpen(null)}>Cancel</button>
              <button type="submit" className="btn btn-warning" disabled={busy}>Broadcast Delay Alert</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN STUDENT TO ROUTE */}
      {/* ========================================================================= */}
      <Modal open={assignStudentOpen} onClose={() => setAssignStudentOpen(false)} title="Allocate Student Transport Seat" subtitle="Capacity guarded assignment & finance invoice generation" icon={<UserPlus size={20} />}>
        <form onSubmit={handleAssignStudent}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Select Enrolled Student" required>
              <select name="studentId" className="input" required>
                <option value="">-- Choose Student --</option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName || ''} ({s.admissionNo} · {s.classroomName || 'Classroom'})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Select Route" required>
              <select
                name="routeId"
                className="input"
                required
                onChange={(e) => {
                  const r = routes.find((rt) => rt.id === e.target.value)
                  // triggers stop dropdown re-render
                }}
              >
                <option value="">-- Choose Route --</option>
                {routes.filter((r) => r.status === 'ACTIVE').map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code}) · {r.availableCapacity} seats free of {r.vehicle?.capacity}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Pickup Stop" required>
                <select name="pickupStopId" className="input" required>
                  <option value="">-- Pickup Stop --</option>
                  {routes.flatMap((r) => r.stops).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.morningPickupTime})</option>
                  ))}
                </select>
              </Field>
              <Field label="Drop Stop" required>
                <select name="dropStopId" className="input" required>
                  <option value="">-- Drop Stop --</option>
                  {routes.flatMap((r) => r.stops).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.eveningDropTime})</option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Trip Operational Run">
                <select name="tripType" className="input" defaultValue="TWO_WAY">
                  <option value="TWO_WAY">Two-Way (Pickup & Drop)</option>
                  <option value="MORNING_ONLY">Morning Only</option>
                  <option value="EVENING_ONLY">Evening Only</option>
                </select>
              </Field>
              <Field label="Monthly Fee (₹)">
                <input type="number" name="monthlyFee" defaultValue={2500} min={0} className="input" />
              </Field>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
              <input type="checkbox" name="generateFeeInvoice" defaultChecked />
              <span>Automatically generate Finance Invoice under <b>TRANSPORT</b> Fee Head</span>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAssignStudentOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Allocate Seat</button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CANCEL TRANSPORT ALLOCATION */}
      {/* ========================================================================= */}
      <Modal open={!!cancelAssignmentModal} onClose={() => setCancelAssignmentModal(null)} title="Cancel Transport Allocation" subtitle="Releases vehicle seat and logs timeline event" icon={<UserX size={20} />}>
        {cancelAssignmentModal && (
          <form onSubmit={handleCancelAssignment}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Discontinuing transport for <b>{cancelAssignmentModal.student.firstName} {cancelAssignmentModal.student.lastName || ''}</b> from Route <b>{cancelAssignmentModal.route.name}</b>.
              </div>
              <Field label="Cancellation Reason" required helper="Recorded in audit trail and student timeline">
                <input type="text" name="reason" className="input" placeholder="Parent requested withdrawal / relocated" required />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setCancelAssignmentModal(null)}>Keep Active</button>
              <button type="submit" className="btn btn-danger" disabled={busy}>Discontinue Service</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: ADD VEHICLE */}
      {/* ========================================================================= */}
      <Modal open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} title="Register Vehicle" subtitle="Fleet registration, capacity, and type" icon={<Bus size={20} />}>
        <form onSubmit={handleCreateVehicle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Registration Number" required helper="e.g. MH-12-AB-1234">
              <input type="text" name="registrationNumber" className="input" placeholder="MH-12-AB-1234" required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Capacity (Seats)" required>
                <input type="number" name="capacity" defaultValue={20} min={1} className="input" required />
              </Field>
              <Field label="Vehicle Type">
                <select name="vehicleType" className="input" defaultValue="BUS">
                  <option value="BUS">School Bus</option>
                  <option value="MINI_BUS">Mini Bus</option>
                  <option value="VAN">Van</option>
                </select>
              </Field>
            </div>
            <Field label="Make & Model">
              <input type="text" name="makeModel" className="input" placeholder="Force Traveller / Eicher Starline" />
            </Field>
            <Field label="Compliance & Safety Notes">
              <input type="text" name="notes" className="input" placeholder="Speed governor installed, fire extinguisher checked" />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAddVehicleOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Register Vehicle</button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EDIT VEHICLE */}
      {/* ========================================================================= */}
      <Modal open={!!editVehicleModal} onClose={() => setEditVehicleModal(null)} title="Edit Vehicle" subtitle="Update fleet specifications" icon={<Edit3 size={20} />}>
        {editVehicleModal && (
          <form onSubmit={handleUpdateVehicle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Vehicle: <b>{editVehicleModal.registrationNumber}</b>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Capacity (Seats)" required>
                  <input type="number" name="capacity" defaultValue={editVehicleModal.capacity} min={1} className="input" required />
                </Field>
                <Field label="Operational Status">
                  <select name="status" className="input" defaultValue={editVehicleModal.status}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="RETIRED">RETIRED</option>
                  </select>
                </Field>
              </div>
              <Field label="Make & Model">
                <input type="text" name="makeModel" defaultValue={editVehicleModal.makeModel || ''} className="input" />
              </Field>
              <Field label="Notes">
                <input type="text" name="notes" defaultValue={editVehicleModal.notes || ''} className="input" />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditVehicleModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: ADD ROUTE */}
      {/* ========================================================================= */}
      <Modal open={addRouteOpen} onClose={() => setAddRouteOpen(false)} title="Create Bus Route" subtitle="Route path, vehicle, driver & stops" icon={<MapPin size={20} />}>
        <form onSubmit={handleCreateRoute}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <Field label="Route Code" required>
                <input type="text" name="code" className="input" placeholder="RT-01" required />
              </Field>
              <Field label="Route Name" required>
                <input type="text" name="name" className="input" placeholder="Kothrud - Campus Express" required />
              </Field>
            </div>
            <Field label="Assign Vehicle">
              <select name="vehicleId" className="input">
                <option value="">-- Select Available Vehicle --</option>
                {vehicles.filter((v) => v.status === 'ACTIVE').map((v) => (
                  <option key={v.id} value={v.id}>{v.registrationNumber} (Cap: {v.capacity})</option>
                ))}
              </select>
            </Field>
            <Field label="Assign Driver (from HR Staff Directory)">
              <select name="driverProfileId" className="input">
                <option value="">-- Select Eligible Driver --</option>
                {eligibleStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.designation} · {s.employeeCode})</option>
                ))}
              </select>
            </Field>
            <div className="card" style={{ padding: 12, background: 'var(--c-surface-hover)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Ordered Stops Sequence</div>
              <Field label="Stop 1 Name (e.g. Green Valley Circle)">
                <input type="text" name="stop1Name" className="input" placeholder="Stop 1" required />
              </Field>
              <Field label="Stop 2 Name (e.g. Sunrise Enclave)">
                <input type="text" name="stop2Name" className="input" placeholder="Stop 2" />
              </Field>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAddRouteOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save Route</button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EDIT ROUTE */}
      {/* ========================================================================= */}
      <Modal open={!!editRouteModal} onClose={() => setEditRouteModal(null)} title="Edit Bus Route" subtitle="Configure vehicle, driver, and attendants" icon={<Edit3 size={20} />}>
        {editRouteModal && (
          <form onSubmit={handleUpdateRoute}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Route Code: <b>{editRouteModal.code}</b>
              </div>
              <Field label="Route Name" required>
                <input type="text" name="name" defaultValue={editRouteModal.name} className="input" required />
              </Field>
              <Field label="Description">
                <input type="text" name="description" defaultValue={editRouteModal.description || ''} className="input" />
              </Field>
              <Field label="Assigned Vehicle">
                <select name="vehicleId" defaultValue={editRouteModal.vehicleId || ''} className="input">
                  <option value="">-- Unassigned --</option>
                  {vehicles.filter((v) => v.status === 'ACTIVE' || v.id === editRouteModal.vehicleId).map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} (Cap: {v.capacity})</option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned Driver">
                <select name="driverProfileId" defaultValue={editRouteModal.driverProfileId || ''} className="input">
                  <option value="">-- Unassigned --</option>
                  {eligibleStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.designation})</option>
                  ))}
                </select>
              </Field>
              <Field label="Route Status">
                <select name="status" defaultValue={editRouteModal.status} className="input">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditRouteModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Save Route</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: REPORT INCIDENT */}
      {/* ========================================================================= */}
      <Modal open={reportIncidentOpen} onClose={() => { setReportIncidentOpen(false); setIncidentTripPrefill(null); }} title="Report Transit Safety Incident" subtitle="Auto-escalates HIGH & CRITICAL severity to Operations" icon={<AlertOctagon size={20} />}>
        <form onSubmit={handleReportIncident}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {incidentTripPrefill && (
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Linked Run: <b>{incidentTripPrefill.route.name}</b> ({incidentTripPrefill.vehicle.registrationNumber})
                <input type="hidden" name="tripId" value={incidentTripPrefill.id} />
                <input type="hidden" name="vehicleId" value={incidentTripPrefill.vehicle.id} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Severity Level" required>
                <select name="severity" className="input" defaultValue="MEDIUM">
                  <option value="LOW">LOW — Minor delay / notification</option>
                  <option value="MEDIUM">MEDIUM — Operational disruption</option>
                  <option value="HIGH">HIGH — Safety risk (Escalates to Principal)</option>
                  <option value="CRITICAL">CRITICAL — Emergency (Immediate Escalation)</option>
                </select>
              </Field>
              <Field label="Category" required>
                <select name="category" className="input" defaultValue="OTHER">
                  <option value="DELAY">DELAY</option>
                  <option value="MECHANICAL">MECHANICAL</option>
                  <option value="BEHAVIOR">BEHAVIOR</option>
                  <option value="ROUTE_OBSTRUCTION">ROUTE_OBSTRUCTION</option>
                  <option value="ACCIDENT">ACCIDENT</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </Field>
            </div>
            <Field label="Incident Title" required>
              <input type="text" name="title" className="input" placeholder="Child unbuckled seatbelt / minor collision" required />
            </Field>
            <Field label="Detailed Description" required>
              <textarea name="description" rows={3} className="input" placeholder="Explain the exact operational circumstances..." required />
            </Field>
            <Field label="Immediate Action Taken">
              <input type="text" name="actionTaken" className="input" placeholder="Attendant intervened and escorted child safely" />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setReportIncidentOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Submit Incident Report</button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: RESOLVE / UPDATE INCIDENT */}
      {/* ========================================================================= */}
      <Modal open={!!resolveIncidentModal} onClose={() => setResolveIncidentModal(null)} title="Resolve Transport Incident" subtitle="Closes linked Operations safety follow-up" icon={<CheckCircle2 size={20} />}>
        {resolveIncidentModal && (
          <form onSubmit={handleResolveIncident}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 13 }}>
                Incident: <b>{resolveIncidentModal.title}</b> ({resolveIncidentModal.severity})
              </div>
              <Field label="Update Status" required>
                <select name="status" className="input" defaultValue="RESOLVED">
                  <option value="RESOLVED">RESOLVED — Close Incident & Follow-Up</option>
                  <option value="INVESTIGATING">INVESTIGATING — Under Review</option>
                </select>
              </Field>
              <Field label="Action Taken / Resolution Summary" required>
                <textarea
                  name="actionTaken"
                  rows={3}
                  className="input"
                  defaultValue={resolveIncidentModal.actionTaken || ''}
                  placeholder="Details of corrective actions taken..."
                  required
                />
              </Field>
              <Field label="Audit Reason (Optional)">
                <input type="text" name="correctionReason" className="input" placeholder="Reviewed with driver and closed by Principal" />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setResolveIncidentModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={busy}>Save Resolution</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: PARENT ROUTE SELECTION */}
      {/* ========================================================================= */}
      <Modal open={!!routeSelectionModal} onClose={() => setRouteSelectionModal(null)} title={`Select Transport Route for ${routeSelectionModal?.fullName}`} subtitle="Choose a route and pickup/drop stop for this child" icon={<Bus size={20} />}>
        {routeSelectionModal && (
          <form onSubmit={handleParentSubmitRouteSelection}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Child" required>
                <input type="text" className="input" value={`${routeSelectionModal.fullName} (${routeSelectionModal.className})`} disabled />
              </Field>
              <Field label="Available Preschool Transport Route" required>
                <select name="routeId" className="input" defaultValue={routes[0]?.id || ''} required onChange={(e) => {
                  const r = routes.find(rt => rt.id === e.target.value)
                  if (r) setSelectedRouteId(r.id)
                }}>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code}) — {r.description || 'Active'}</option>
                  ))}
                </select>
              </Field>
              <Field label="Pickup Stop" required>
                <select name="pickupStopId" className="input" required>
                  {(routes.find(r => r.id === selectedRouteId)?.stops || routes[0]?.stops || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} (Pickup: {s.morningPickupTime})</option>
                  ))}
                </select>
              </Field>
              <Field label="Drop Stop" required>
                <select name="dropStopId" className="input" required>
                  {(routes.find(r => r.id === selectedRouteId)?.stops || routes[0]?.stops || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} (Drop: {s.eveningDropTime})</option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setRouteSelectionModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Submit Route Selection Request</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: DRIVER QR DISPLAY */}
      {/* ========================================================================= */}
      <Modal open={!!driverQrModal} onClose={() => setDriverQrModal(null)} title="Driver Transport QR Code" subtitle="Present this QR code to Parents and Guardians for transport pickup/drop verification" icon={<QrCode size={20} />}>
        {driverQrModal && (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ padding: 16, background: '#fff', borderRadius: 16, display: 'inline-block', border: '3px solid var(--primary)', marginBottom: 14 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(driverQrModal.token)}`}
                alt="Driver QR Code"
                style={{ width: 180, height: 180, borderRadius: 8, display: 'block' }}
              />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Route: {routes.find(r => r.id === driverQrModal.routeId)?.name || 'Route 001'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Vehicle: BUS-01 • Driver: Suresh Patil</div>
            <div style={{ margin: '14px 0', padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Token: {driverQrModal.token}
            </div>
            <button className="btn btn-secondary" onClick={() => {
              setScanInput(driverQrModal.token)
              setDriverQrModal(null)
              setTab('SCANNER')
            }}>
              Test Scan in Scanner 🔍
            </button>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: VISUAL QR CODE IMAGE VIEWER */}
      {/* ========================================================================= */}
      <Modal open={!!showVisualQr} onClose={() => setShowVisualQr(null)} title="Visual QR Code Graphic" subtitle="Scan this QR Code graphic with a mobile phone camera or physical QR scanner" icon={<QrCode size={20} />}>
        {showVisualQr && (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ padding: 16, background: '#fff', borderRadius: 16, display: 'inline-block', border: '3px solid var(--primary)', marginBottom: 14 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                  showVisualQr.startsWith('http')
                    ? showVisualQr
                    : `${typeof window !== 'undefined' ? window.location.origin : ''}/app/transport?scan=${encodeURIComponent(showVisualQr)}`
                )}`}
                alt="Visual QR Code"
                style={{ width: 220, height: 220, borderRadius: 8, display: 'block' }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              Point any mobile camera at this screen to open app & verify form instantly
            </div>
            <div style={{ padding: 10, background: 'var(--c-surface-hover)', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Token: {showVisualQr}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

