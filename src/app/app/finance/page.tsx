'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus,
  Wallet,
  IndianRupee,
  Receipt,
  BadgeCheck,
  Download,
  Layers,
  Printer,
  FileText,
  Search,
  Filter,
  Users,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Tag,
  Sliders,
  ShieldCheck,
  Percent,
  RefreshCw,
  Eye,
  Check,
  X,
} from 'lucide-react'
import { PageHead, StatusBadge, StatusPill, StudentIdentityChip, EmptyState, KpiTile, Skeleton } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { inr, fmtDate, enumLabel } from '@/lib/format'

interface DashboardMetrics {
  totalBilledCents: number
  totalCollectedCents: number
  totalBalanceCents: number
  totalOverdueCents: number
  collectionRate: number
  counts?: {
    totalInvoices: number
    paid: number
    partiallyPaid: number
    issued: number
    overdue: number
  }
}

interface Invoice {
  id: string
  invoiceNumber: string
  title: string
  studentName: string
  admissionNo: string
  feePayer?: string | null
  dueDate: string
  subtotalCents: number
  totalCents: number
  paidCents: number
  balanceCents: number
  status: string
}

interface Detail {
  id: string
  invoiceNumber: string
  title: string
  student: { name: string; admissionNo: string; classroom?: string }
  issueDate: string
  dueDate: string
  items: { feeHead: string; description: string; amountCents: number }[]
  subtotalCents: number
  discountCents: number
  totalCents: number
  paidCents: number
  balanceCents: number
  status: string
  payments: {
    id: string
    paymentNumber: string
    amountCents: number
    method: string
    status: string
    paymentDate: string
    receiptId: string | null
    receiptNumber: string | null
  }[]
}

interface FeePlan {
  id: string
  name: string
  programType: string
  academicYear?: string
  installmentCount: number
  totalAnnualCents: number
  isActive: boolean
  items: { id: string; feeHead: string; label: string; amountCents: number; frequency: string }[]
}

interface FeeHeadRecord {
  id: string
  name: string
  code: string
  category: string
  description?: string | null
  isActive: boolean
  sortOrder: number
  _count?: { planItems: number }
}

interface PaymentRecord {
  id: string
  paymentNumber: string
  amountCents: number
  method: string
  status: string
  transactionRef?: string | null
  paymentDate: string
  studentName: string
  admissionNo: string
  invoiceNumber?: string | null
  receiptId?: string | null
  receiptNumber?: string | null
}

interface ReceiptRecord {
  id: string
  receiptNumber: string
  amountCents: number
  issuedAt: string
  paymentNumber: string
  method: string
  transactionRef?: string | null
  studentName: string
  admissionNo: string
  invoiceNumber?: string | null
}

interface StudentOpt {
  id: string
  name: string
  admissionNo: string
}

interface ReceiptDetail {
  receiptNumber: string
  issuedAt: string
  amountRupees: string
  school: { name: string; code: string; address?: string; city?: string; phone?: string; email?: string; gstNumber?: string }
  student: { name: string; admissionNo: string; seatNumber?: string | null; classroom?: string }
  payment: { paymentNumber: string; method: string; transactionRef?: string; date: string }
  invoice: { invoiceNumber: string; title: string; items: { description: string; amountRupees: string }[] } | null
}

interface TemplateRecord {
  id: string
  name: string
  type: 'INVOICE' | 'RECEIPT'
  isDefault: boolean
  content: any
  createdAt: string
}

interface GatewayConfig {
  provider: string
  enabled: boolean
  mode: 'TEST' | 'LIVE'
  keyId: string
  hasKeySecret: boolean
  currency: string
  supportedMethods: string[]
  webhookConfigured: boolean
  webhookUrl: string
}

export default function FinancePage() {
  const toast = useToast()
  const sp = useSearchParams()

  // Navigation tabs (10 Control Center Panels)
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'INVOICES' | 'PLANS' | 'HEADS' | 'PAYMENTS' | 'RECEIPTS' | 'CONCESSIONS' | 'TEMPLATES' | 'GATEWAY'
  >('OVERVIEW')

  // Core Data States
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [feePlans, setFeePlans] = useState<FeePlan[]>([])
  const [feeHeads, setFeeHeads] = useState<FeeHeadRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([])
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null)
  const [concessions, setConcessions] = useState<{ discounts: any[]; policies: any }>({ discounts: [], policies: {} })
  const [students, setStudents] = useState<StudentOpt[]>([])

  // Filters & Searching
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals & Drawers
  const [detail, setDetail] = useState<Detail | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [headOpen, setHeadOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null)
  const [receiptDetail, setReceiptDetail] = useState<ReceiptDetail | null>(null)
  const [busy, setBusy] = useState(false)

  // Bulk Invoicing Preview State
  const [bulkPreview, setBulkPreview] = useState<{
    title: string
    summary: { totalStudents: number; eligibleCount: number; skippedCount: number; totalGrossRupees: number; totalNetRupees: number }
    students: { studentId: string; studentName: string; admissionNo: string; classroom: string; isEligible: boolean; netCents: number; reason: string }[]
  } | null>(null)
  const [selectedFeePlanId, setSelectedFeePlanId] = useState<string>('')

  // 1. Load dashboard metrics
  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fees/dashboard').then((r) => r.json())
      if (res.success) setMetrics(res.data)
    } catch {}
  }, [])

  // 2. Load Invoices
  const loadInvoices = useCallback(async () => {
    try {
      const url = statusFilter === 'ALL' ? '/api/v1/invoices' : `/api/v1/invoices?status=${statusFilter}`
      const [invRes, stuRes] = await Promise.all([
        fetch(url).then((r) => r.json()),
        fetch('/api/v1/students?pageSize=100').then((r) => r.json()),
      ])
      if (invRes.success) setInvoices(invRes.data)
      if (stuRes.success) {
        setStudents(
          stuRes.data.map((s: { id: string; name: string; admissionNo: string }) => ({
            id: s.id,
            name: s.name,
            admissionNo: s.admissionNo,
          }))
        )
      }
    } catch {}
  }, [statusFilter])

  // 3. Load Fee Structures
  const loadFeePlans = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fees/structures').then((r) => r.json())
      if (res.success) setFeePlans(res.data)
    } catch {}
  }, [])

  // 4. Load Fee Heads
  const loadFeeHeads = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fees/heads?activeOnly=false').then((r) => r.json())
      if (res.success) setFeeHeads(res.data)
    } catch {}
  }, [])

  // 5. Load Payments
  const loadPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payments').then((r) => r.json())
      if (res.success) setPayments(res.data)
    } catch {}
  }, [])

  // 6. Load Receipts
  const loadReceipts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/receipts').then((r) => r.json())
      if (res.success) setReceipts(res.data)
    } catch {}
  }, [])

  // 7. Load Concessions
  const loadConcessions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fees/concessions').then((r) => r.json())
      if (res.success) setConcessions(res.data)
    } catch {}
  }, [])

  // 8. Load Templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/finance/templates').then((r) => r.json())
      if (res.success) setTemplates(res.data)
    } catch {}
  }, [])

  // 9. Load Gateway Config
  const loadGateway = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/finance/gateway').then((r) => r.json())
      if (res.success) setGatewayConfig(res.data)
    } catch {}
  }, [])

  const reloadAll = useCallback(() => {
    loadMetrics()
    loadInvoices()
    loadFeePlans()
    loadFeeHeads()
    loadPayments()
    loadReceipts()
    loadConcessions()
    loadTemplates()
    loadGateway()
  }, [loadMetrics, loadInvoices, loadFeePlans, loadFeeHeads, loadPayments, loadReceipts, loadConcessions, loadTemplates, loadGateway])

  useEffect(() => {
    reloadAll()
  }, [reloadAll])

  const openDetail = useCallback(async (id: string) => {
    try {
      const j = await fetch(`/api/v1/invoices/${id}`).then((r) => r.json())
      if (j.success) setDetail(j.data)
    } catch {}
  }, [])

  useEffect(() => {
    const inv = sp.get('invoice')
    if (inv) Promise.resolve().then(() => openDetail(inv))
  }, [sp, openDetail])

  const viewReceipt = async (receiptId: string) => {
    setBusy(true)
    try {
      const j = await fetch(`/api/v1/receipts/${receiptId}`).then((r) => r.json())
      setBusy(false)
      if (j.success) setReceiptDetail(j.data)
      else toast.error('Could not load receipt', j.error?.message)
    } catch (e: any) {
      setBusy(false)
      toast.error('Error fetching receipt', e.message)
    }
  }

  const exportCsv = (type: 'invoices' | 'payments') => {
    const url = `/api/v1/fees/export?type=${type}${statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''}`
    window.open(url, '_blank')
  }

  // --- ACTIONS ---

  // Create Fee Head
  const createFeeHead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/fees/heads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          code: fd.get('code') || undefined,
          category: fd.get('category') || 'OTHER',
          description: fd.get('description') || undefined,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Fee Head Created', `${json.data.name} is now available in structures`)
        setHeadOpen(false)
        loadFeeHeads()
      } else {
        toast.error('Failed to create Fee Head', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('System error', err.message)
    }
  }

  // Toggle Fee Head status
  const toggleFeeHead = async (id: string, currentStatus: boolean) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/fees/heads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Fee Head Updated', `Status changed to ${!currentStatus ? 'Active' : 'Inactive'}`)
        loadFeeHeads()
      }
    } catch {
      setBusy(false)
    }
  }

  // Record Payment
  const recordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!detail) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const rupees = parseFloat(String(fd.get('rupees') || '0'))
    try {
      const res = await fetch(`/api/v1/invoices/${detail.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: Math.round(rupees * 100),
          method: fd.get('method'),
          transactionRef: fd.get('ref') || undefined,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Payment Recorded', `Receipt ${json.data.receiptNumber} generated`)
        setPayOpen(false)
        openDetail(detail.id)
        reloadAll()
      } else {
        toast.error('Payment Failed', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('System error', err.message)
    }
  }

  // Void Invoice
  const voidInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to void this invoice? This action is immutable.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VOID', reason: 'Administrative cancellation' }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Invoice Voided', 'Invoice has been cancelled and audited.')
        if (detail?.id === invoiceId) setDetail(null)
        reloadAll()
      } else {
        toast.error('Cannot void invoice', json.error?.message)
      }
    } catch {
      setBusy(false)
    }
  }

  // Create Single Invoice
  const createInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const rupees = parseFloat(String(fd.get('amount') || '0'))
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: fd.get('studentId'),
          title: fd.get('title') || 'Fee Invoice',
          dueDate: fd.get('dueDate'),
          lineItems: [
            {
              description: String(fd.get('desc') || 'Fee'),
              amountCents: Math.round(rupees * 100),
              feeHead: fd.get('feeHead') || 'TUITION',
            },
          ],
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Invoice Raised', json.data.invoiceNumber)
        setCreateOpen(false)
        reloadAll()
      } else {
        toast.error('Failed to raise invoice', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('System error', err.message)
    }
  }

  // Load bulk preview
  const fetchBulkPreview = async (planId?: string) => {
    setBusy(true)
    try {
      const url = planId ? `/api/v1/invoices/bulk?feePlanId=${planId}` : '/api/v1/invoices/bulk'
      const res = await fetch(url).then((r) => r.json())
      setBusy(false)
      if (res.success) setBulkPreview(res.data)
    } catch {
      setBusy(false)
    }
  }

  // Execute bulk invoice
  const triggerBulkInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/invoices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feePlanId: fd.get('feePlanId') || undefined,
          title: fd.get('title') || 'Term Fee Invoice',
          dueDate: fd.get('dueDate'),
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Bulk Generation Complete', `Created ${json.data.createdCount} invoices (${json.data.skippedCount} skipped)`)
        setBulkOpen(false)
        reloadAll()
      } else {
        toast.error('Bulk Invoicing Failed', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('System error', err.message)
    }
  }

  // Create Fee Structure
  const createFeePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name'))
    const programType = String(fd.get('programType'))
    const tuitionRupees = parseFloat(String(fd.get('tuition') || '0'))
    const materialsRupees = parseFloat(String(fd.get('materials') || '0'))
    const activityRupees = parseFloat(String(fd.get('activity') || '0'))

    const items = [
      { feeHead: 'TUITION', label: 'Tuition Fee', amountCents: Math.round(tuitionRupees * 100) },
      { feeHead: 'MATERIALS', label: 'Learning Materials', amountCents: Math.round(materialsRupees * 100) },
      { feeHead: 'ACTIVITY', label: 'Activities & Sports', amountCents: Math.round(activityRupees * 100) },
    ].filter((i) => i.amountCents > 0)

    try {
      const res = await fetch('/api/v1/fees/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, programType, items }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Fee Structure Created', `${json.data.name} saved`)
        setPlanOpen(false)
        reloadAll()
      } else {
        toast.error('Failed to create plan', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('System error', err.message)
    }
  }

  // Create Document Template
  const createTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/finance/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          type: fd.get('type'),
          isDefault: fd.get('isDefault') === 'on',
          content: {
            headerTitle: fd.get('headerTitle') || 'Official School Invoice',
            termsText: fd.get('termsText') || 'Fee once paid is non-refundable.',
            showLogo: true,
            showGstin: true,
            showSignature: true,
          },
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Template Saved', `${json.data.name} template registered`)
        setTemplateOpen(false)
        loadTemplates()
      }
    } catch {
      setBusy(false)
    }
  }

  // Preview Template
  const openTemplatePreview = async (templateId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/finance/templates/${templateId}/preview`, { method: 'POST' }).then((r) => r.json())
      setBusy(false)
      if (res.success) setPreviewTemplate(res.data)
    } catch {
      setBusy(false)
    }
  }

  // Update Gateway Config
  const saveGatewayConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/v1/finance/gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: fd.get('provider'),
          enabled: fd.get('enabled') === 'on',
          mode: fd.get('mode'),
          keyId: fd.get('keyId') || undefined,
          keySecret: fd.get('keySecret') || undefined,
          webhookSecret: fd.get('webhookSecret') || undefined,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Gateway Updated', 'Payment gateway credentials and status saved.')
        loadGateway()
      }
    } catch {
      setBusy(false)
    }
  }

  // Test Gateway Connection
  const testGateway = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/finance/gateway/test', { method: 'POST' }).then((r) => r.json())
      setBusy(false)
      if (res.success && res.data.success) {
        toast.success('Gateway Connected', res.data.message)
      } else {
        toast.error('Gateway Connection Failed', res.data?.message || 'Check credentials')
      }
    } catch (e: any) {
      setBusy(false)
      toast.error('Test error', e.message)
    }
  }

  // Filtered invoices
  const filteredInvoices = (invoices || []).filter((i) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.studentName.toLowerCase().includes(q) ||
      i.admissionNo.toLowerCase().includes(q)
    )
  })

  return (
    <>
      <PageHead
        eyebrow="FINANCE"
        badge={<span className="badge b-primary b-dot">Reconciled Live</span>}
        title="Finance"
        sub="Track fees, invoices, receipts and outstanding balances."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => exportCsv('invoices')} disabled={busy}>
              <Download size={15} /> Export Invoices
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                fetchBulkPreview()
                setBulkOpen(true)
              }}
            >
              <Layers size={15} /> Bulk Billing
            </button>
            <button className="btn btn-outline" onClick={() => setHeadOpen(true)}>
              <Tag size={15} /> New Fee Head
            </button>
            <button className="btn btn-outline" onClick={() => setPlanOpen(true)}>
              <Building2 size={15} /> New Fee Structure
            </button>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> Raise Invoice
            </button>
          </div>
        }
      />

      {/* CANONICAL METRIC STRIP */}
      <div className="metric-strip" style={{ marginBottom: 16 }}>
        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Total Billed</span>
            <IndianRupee size={15} style={{ color: 'var(--primary)' }} />
          </div>
          <div className="m-val">{inr(metrics?.totalBilledCents || 0, { compact: true })}</div>
          <div className="m-meta">{metrics?.counts?.totalInvoices || 0} active invoices</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Total Collected</span>
            <Wallet size={15} style={{ color: 'var(--success)' }} />
          </div>
          <div className="m-val m-success">{inr(metrics?.totalCollectedCents || 0, { compact: true })}</div>
          <div className="m-meta" style={{ color: 'var(--success)' }}>{metrics?.collectionRate || 0}% collection rate</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Outstanding Balance</span>
            <Receipt size={15} style={{ color: 'var(--warning)' }} />
          </div>
          <div className="m-val" style={{ color: 'var(--warning)' }}>{inr(metrics?.totalBalanceCents || 0, { compact: true })}</div>
          <div className="m-meta">{metrics?.counts?.partiallyPaid || 0} part · {metrics?.counts?.issued || 0} pending</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Overdue Balance</span>
            <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
          </div>
          <div className="m-val" style={{ color: 'var(--danger)' }}>{inr(metrics?.totalOverdueCents || 0, { compact: true })}</div>
          <div className="m-meta">{metrics?.counts?.overdue || 0} overdue invoices</div>
        </div>
      </div>

      {/* COMMAND CENTER TAB NAVIGATION */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 16, overflowX: 'auto' }}>
        {[
          { key: 'OVERVIEW', label: 'Overview', icon: <TrendingUp size={15} /> },
          { key: 'INVOICES', label: 'Invoices', icon: <Receipt size={15} /> },
          { key: 'PLANS', label: 'Fee Structures', icon: <Building2 size={15} /> },
          { key: 'HEADS', label: 'Fee Heads', icon: <Tag size={15} /> },
          { key: 'PAYMENTS', label: 'Payments', icon: <CreditCard size={15} /> },
          { key: 'RECEIPTS', label: 'Receipts', icon: <FileText size={15} /> },
          { key: 'CONCESSIONS', label: 'Discounts', icon: <Percent size={15} /> },
          { key: 'TEMPLATES', label: 'Templates', icon: <Sliders size={15} /> },
          { key: 'GATEWAY', label: 'Payment Gateway', icon: <ShieldCheck size={15} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="btn btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Collection Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Collection Efficiency</span>
                  <strong>{metrics?.collectionRate || 0}%</strong>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, metrics?.collectionRate || 0)}%`,
                      height: '100%',
                      background: 'var(--success)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                <div style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8 }}>
                  <div className="t-caption">Total Billed</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{inr(metrics?.totalBilledCents || 0)}</div>
                </div>
                <div style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8 }}>
                  <div className="t-caption">Collected</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--success)' }}>
                    {inr(metrics?.totalCollectedCents || 0)}
                  </div>
                </div>
                <div style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8 }}>
                  <div className="t-caption">Pending Balance</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--warning)' }}>
                    {inr(metrics?.totalBalanceCents || 0)}
                  </div>
                </div>
                <div style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8 }}>
                  <div className="t-caption">Overdue</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--danger)' }}>
                    {inr(metrics?.totalOverdueCents || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Quick Financial Workflows</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-outline"
                style={{ justifyContent: 'space-between' }}
                onClick={() => {
                  fetchBulkPreview()
                  setBulkOpen(true)
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} /> Batch Term Fee Generation
                </span>
                <ArrowRight size={15} />
              </button>
              <button
                className="btn btn-outline"
                style={{ justifyContent: 'space-between' }}
                onClick={() => setCreateOpen(true)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={16} /> Raise Single Student Invoice
                </span>
                <ArrowRight size={15} />
              </button>
              <button
                className="btn btn-outline"
                style={{ justifyContent: 'space-between' }}
                onClick={() => setHeadOpen(true)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag size={16} /> Create Custom Fee Head
                </span>
                <ArrowRight size={15} />
              </button>
              <button
                className="btn btn-outline"
                style={{ justifyContent: 'space-between' }}
                onClick={() => exportCsv('payments')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Download size={16} /> Export Complete Payment Ledger
                </span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES LEDGER */}
      {activeTab === 'INVOICES' && (
        <div className="dtable-wrap">
          <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
              <Search size={16} style={{ color: 'var(--muted)' }} />
              <input
                className="input"
                style={{ height: 36 }}
                placeholder="Search student, admission #, invoice #"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="seg">
              {['ALL', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => (
                <button key={s} className={statusFilter === s ? 'on' : ''} onClick={() => setStatusFilter(s)}>
                  {s === 'ALL' ? 'All' : enumLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="dtable-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Student</th>
                  <th>Fee Payer</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((i) => (
                  <tr key={i.id}>
                    <td onClick={() => openDetail(i.id)}>
                      <span className="cell-strong" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {i.invoiceNumber}
                      </span>
                      <span className="cell-sub">{i.title}</span>
                    </td>
                    <td onClick={() => openDetail(i.id)}>
                      <StudentIdentityChip
                        name={i.studentName}
                        admissionNo={i.admissionNo}
                        size="sm"
                      />
                    </td>
                    <td onClick={() => openDetail(i.id)}>{i.feePayer || '—'}</td>
                    <td onClick={() => openDetail(i.id)}>{fmtDate(i.dueDate)}</td>
                    <td style={{ textAlign: 'right' }} className="tabular-nums" onClick={() => openDetail(i.id)}>
                      {inr(i.totalCents)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }} className="tabular-nums" onClick={() => openDetail(i.id)}>
                      {inr(i.paidCents)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: i.balanceCents > 0 ? 'var(--danger)' : 'var(--success)',
                      }}
                      className="tabular-nums"
                      onClick={() => openDetail(i.id)}
                    >
                      {inr(i.balanceCents)}
                    </td>
                    <td onClick={() => openDetail(i.id)}>
                      <StatusPill status={i.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 12, height: 26 }}
                          onClick={() => openDetail(i.id)}
                        >
                          <Eye size={13} /> View
                        </button>
                        {i.status === 'ISSUED' && i.paidCents === 0 && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '2px 8px', fontSize: 12, height: 26, color: 'var(--danger)' }}
                            onClick={() => voidInvoice(i.id)}
                            title="Void Invoice"
                          >
                            <X size={13} /> Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invoices?.length === 0 && (
              <EmptyState
                icon={<Wallet size={40} />}
                title="No invoices found"
                message="Invoices appear when raised manually or generated in bulk."
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FEE STRUCTURES */}
      {activeTab === 'PLANS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Program Fee Structures</h3>
              <p className="t-caption" style={{ margin: '2px 0 0' }}>
                Defined fee packages linked to academic programs and branches.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setPlanOpen(true)}>
              <Plus size={15} /> Add Structure
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {feePlans.map((plan) => (
              <div key={plan.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{plan.name}</h4>
                    <span className="badge b-blue" style={{ marginTop: 4 }}>
                      {enumLabel(plan.programType)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                      {inr(plan.totalAnnualCents)}
                    </div>
                    <span className="t-caption">{plan.installmentCount} installments</span>
                  </div>
                </div>

                <div style={{ marginTop: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <div className="t-caption" style={{ fontWeight: 600, marginBottom: 6 }}>
                    FEE COMPONENTS
                  </div>
                  {plan.items.map((item) => (
                    <div
                      key={item.id}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}
                    >
                      <span>{item.label || enumLabel(item.feeHead)}</span>
                      <strong>{inr(item.amountCents)}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge b-success">ACTIVE</span>
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '2px 10px', height: 28 }}
                    onClick={() => {
                      setSelectedFeePlanId(plan.id)
                      fetchBulkPreview(plan.id)
                      setBulkOpen(true)
                    }}
                  >
                    Invoice Structure
                  </button>
                </div>
              </div>
            ))}
            {feePlans.length === 0 && (
              <div style={{ gridColumn: '1/-1' }}>
                <EmptyState
                  icon={<Building2 size={40} />}
                  title="No Fee Structures Configured"
                  message="Create program-specific fee templates with itemized heads."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FEE HEADS (DATABASE-CONFIGURED) */}
      {activeTab === 'HEADS' && (
        <div className="dtable-wrap">
          <div className="table-toolbar">
            <div>
              <div className="card-title">Fee Heads Master</div>
              <p className="t-caption" style={{ margin: '2px 0 0' }}>
                User-created, database-backed charge heads for fee structures.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setHeadOpen(true)}>
              <Plus size={15} /> Create Fee Head
            </button>
          </div>

          <div className="dtable-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Fee Head Name</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feeHeads.map((h) => (
                  <tr key={h.id}>
                    <td className="cell-strong">{h.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{h.code}</td>
                    <td>
                      <span className="badge b-blue">{enumLabel(h.category)}</span>
                    </td>
                    <td>{h.description || '—'}</td>
                    <td>{h._count?.planItems || 0} structures</td>
                    <td>
                      <span className={`badge ${h.isActive ? 'b-success' : 'b-warning'}`}>
                        {h.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '2px 8px', fontSize: 12, height: 26 }}
                        onClick={() => toggleFeeHead(h.id, h.isActive)}
                      >
                        {h.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {feeHeads.length === 0 && (
              <EmptyState icon={<Tag size={40} />} title="No Custom Fee Heads" message="Create your school's unique fee heads." />
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="dtable-wrap">
          <div className="table-toolbar">
            <div className="card-title">Payment Transaction History</div>
            <button className="btn btn-outline" onClick={() => exportCsv('payments')}>
              <Download size={15} /> Export Payments CSV
            </button>
          </div>
          <div className="dtable-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Student</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Ref / UTR</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.paymentNumber}</td>
                    <td>
                      <div className="cell-strong">{p.studentName}</div>
                      <div className="cell-sub">{p.admissionNo}</div>
                    </td>
                    <td>{fmtDate(p.paymentDate)}</td>
                    <td>{enumLabel(p.method)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.transactionRef || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      {inr(p.amountCents)}
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td>
                      {p.receiptId ? (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 12, height: 26 }}
                          onClick={() => viewReceipt(p.receiptId!)}
                        >
                          <Printer size={13} /> {p.receiptNumber}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payments.length === 0 && (
              <EmptyState icon={<CreditCard size={40} />} title="No payments recorded" message="Payments will appear here." />
            )}
          </div>
        </div>
      )}

      {/* TAB 6: RECEIPTS */}
      {activeTab === 'RECEIPTS' && (
        <div className="dtable-wrap">
          <div className="table-toolbar">
            <div className="card-title">Issued Official Receipts</div>
          </div>
          <div className="dtable-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Student</th>
                  <th>Issued Date</th>
                  <th>Method</th>
                  <th>Payment #</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                      {r.receiptNumber}
                    </td>
                    <td>
                      <div className="cell-strong">{r.studentName}</div>
                      <div className="cell-sub">{r.admissionNo}</div>
                    </td>
                    <td>{fmtDate(r.issuedAt)}</td>
                    <td>{enumLabel(r.method)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.paymentNumber}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{inr(r.amountCents)}</td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '2px 10px', fontSize: 12, height: 26 }}
                        onClick={() => viewReceipt(r.id)}
                      >
                        <Printer size={13} /> Print Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {receipts.length === 0 && (
              <EmptyState icon={<FileText size={40} />} title="No receipts issued" message="Receipts are issued on payment." />
            )}
          </div>
        </div>
      )}

      {/* TAB 7: CONCESSIONS & DISCOUNTS */}
      {activeTab === 'CONCESSIONS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Active Concession & Discount Rules</h3>
            <p className="t-caption" style={{ marginBottom: 14 }}>
              Configured financial discounts applied automatically based on family or scholarship eligibility.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {concessions.discounts.map((d: any) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-sunken)',
                    padding: 14,
                    borderRadius: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                    <div className="t-caption">
                      Code: {d.code} · Head: {d.appliesTo} · {d.description}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge b-success" style={{ fontSize: 13, fontWeight: 700 }}>
                      {d.value}% OFF
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Financial Statutory Policies</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8 }}>
                <div className="t-caption">Statutory Cash Limit (IT Act §269ST)</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>₹50,000 max per receipt</div>
              </div>
              <div style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8 }}>
                <div className="t-caption">Default Due Window</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>15 days from issue date</div>
              </div>
              <div style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8 }}>
                <div className="t-caption">Family Link Resolver</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>Guardian → StudentGuardian</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: TEMPLATES */}
      {activeTab === 'TEMPLATES' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Document Templates</h3>
              <p className="t-caption" style={{ margin: '2px 0 0' }}>
                Configurable layouts for official Invoices and Fee Receipts.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setTemplateOpen(true)}>
              <Plus size={15} /> Create Template
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {templates.map((t) => (
              <div key={t.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t.name}</h4>
                    <span className="badge b-blue" style={{ marginTop: 4 }}>
                      {t.type}
                    </span>
                  </div>
                  {t.isDefault && <span className="badge b-success">DEFAULT</span>}
                </div>
                <div className="t-caption" style={{ marginTop: 12 }}>
                  Header: {t.content?.headerTitle || 'Default Title'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '2px 10px', height: 28 }}
                    onClick={() => openTemplatePreview(t.id)}
                  >
                    <Eye size={13} /> Live Preview
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <div style={{ gridColumn: '1/-1' }}>
                <EmptyState icon={<Sliders size={40} />} title="No Custom Templates" message="Default system templates are active." />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: PAYMENT GATEWAY */}
      {activeTab === 'GATEWAY' && (
        <div style={{ maxWidth: 640 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Payment Gateway Integration</h3>
                <p className="t-caption" style={{ margin: '2px 0 0' }}>
                  Configure online collections via UPI, Net Banking, and Credit/Debit Cards.
                </p>
              </div>
              <span className={`badge ${gatewayConfig?.enabled ? 'b-success' : 'b-warning'}`}>
                {gatewayConfig?.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <form onSubmit={saveGatewayConfig}>
              <div className="form-grid">
                <div className="field">
                  <label>Provider</label>
                  <select className="select" name="provider" defaultValue={gatewayConfig?.provider || 'RAZORPAY'}>
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="CASHFREE">Cashfree Payments</option>
                    <option value="PAYU">PayU Enterprise</option>
                  </select>
                </div>
                <div className="field">
                  <label>Environment Mode</label>
                  <select className="select" name="mode" defaultValue={gatewayConfig?.mode || 'TEST'}>
                    <option value="TEST">Sandbox / Test Mode</option>
                    <option value="LIVE">Production Live</option>
                  </select>
                </div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>API Key ID</label>
                  <input className="input" name="keyId" placeholder="rzp_test_..." defaultValue={gatewayConfig?.keyId || ''} />
                </div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>API Key Secret (Stored Securely)</label>
                  <input className="input" name="keySecret" type="password" placeholder={gatewayConfig?.hasKeySecret ? '••••••••••••••••' : 'Enter Secret'} />
                </div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Webhook Secret</label>
                  <input className="input" name="webhookSecret" type="password" placeholder="Webhook Signature Secret" />
                </div>
                <div className="field" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="enabled" name="enabled" defaultChecked={gatewayConfig?.enabled} />
                  <label htmlFor="enabled" style={{ margin: 0, fontWeight: 600 }}>Enable Online Payments for Parents</label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                <button type="button" className="btn btn-outline" onClick={testGateway} disabled={busy}>
                  <ShieldCheck size={15} /> Test Connection
                </button>
                <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>
                  Save Gateway Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. INVOICE DETAIL MODAL */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? detail.invoiceNumber : ''}
        subtitle={detail ? `${detail.student.name} · ${detail.student.classroom || ''}` : ''}
        icon={<Receipt size={22} />}
        wide
      >
        {detail && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <StatusBadge status={detail.status} />
              <span className="t-caption">Due {fmtDate(detail.dueDate)}</span>
            </div>
            <table className="dtable" style={{ border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, ix) => (
                  <tr key={ix} style={{ cursor: 'default' }}>
                    <td>
                      {it.description}
                      <span className="cell-sub">{enumLabel(it.feeHead)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{inr(it.amountCents)}</td>
                  </tr>
                ))}
                {detail.discountCents > 0 && (
                  <tr style={{ cursor: 'default', color: 'var(--success)' }}>
                    <td>Sibling / Family Discount</td>
                    <td style={{ textAlign: 'right' }}>- {inr(detail.discountCents)}</td>
                  </tr>
                )}
                <tr style={{ cursor: 'default' }}>
                  <td className="cell-strong">Total Billed</td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>{inr(detail.totalCents)}</td>
                </tr>
                <tr style={{ cursor: 'default' }}>
                  <td>Amount Paid</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{inr(detail.paidCents)}</td>
                </tr>
                <tr style={{ cursor: 'default' }}>
                  <td className="cell-strong">Balance Outstanding</td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 800,
                      color: detail.balanceCents > 0 ? 'var(--danger)' : 'var(--success)',
                    }}
                  >
                    {inr(detail.balanceCents)}
                  </td>
                </tr>
              </tbody>
            </table>

            {detail.payments.length > 0 && (
              <>
                <div className="sm-title" style={{ marginTop: 16 }}>
                  Payment History
                </div>
                {detail.payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--success-soft)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 12.5 }}>
                      <strong>{p.paymentNumber}</strong> · {inr(p.amountCents)} · {enumLabel(p.method)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge b-success">
                        <BadgeCheck size={12} /> {p.receiptNumber}
                      </span>
                      {p.receiptId && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 12, height: 26 }}
                          onClick={() => viewReceipt(p.receiptId!)}
                          title="View & Print Official Receipt"
                        >
                          <Printer size={13} /> View Receipt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>
                Close
              </button>
              {detail.balanceCents > 0 && !['CANCELLED', 'WRITTEN_OFF'].includes(detail.status) && (
                <button className="btn btn-primary" onClick={() => setPayOpen(true)}>
                  <IndianRupee size={15} /> Record Payment
                </button>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* 2. OFFICIAL PRINTABLE RECEIPT MODAL */}
      <Modal
        open={!!receiptDetail}
        onClose={() => setReceiptDetail(null)}
        title={receiptDetail ? `Official Fee Receipt — ${receiptDetail.receiptNumber}` : ''}
        subtitle="Server-verified financial acknowledgment (IT §269ST Compliant)"
        icon={<FileText size={22} />}
        wide
      >
        {receiptDetail && (
          <div>
            <div
              style={{
                padding: 24,
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                background: 'var(--surface)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{receiptDetail.school.name}</h3>
                  <div className="t-caption" style={{ marginTop: 4 }}>
                    {receiptDetail.school.address || ''} {receiptDetail.school.city ? `· ${receiptDetail.school.city}` : ''}
                  </div>
                  {receiptDetail.school.gstNumber && (
                    <div className="t-caption">GSTIN: {receiptDetail.school.gstNumber}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: 18,
                      color: 'var(--primary)',
                    }}
                  >
                    {receiptDetail.receiptNumber}
                  </div>
                  <div className="t-caption" style={{ marginTop: 4 }}>
                    Date: {fmtDate(receiptDetail.issuedAt)}
                  </div>
                  <span className="badge b-success" style={{ marginTop: 6 }}>
                    PAYMENT VERIFIED
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div className="t-caption" style={{ fontWeight: 600 }}>
                    RECEIVED FROM / STUDENT
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{receiptDetail.student.name}</div>
                  <div className="t-caption">Admission No: {receiptDetail.student.admissionNo}</div>
                  {receiptDetail.student.classroom && (
                    <div className="t-caption">Classroom: {receiptDetail.student.classroom}</div>
                  )}
                </div>
                <div>
                  <div className="t-caption" style={{ fontWeight: 600 }}>
                    PAYMENT DETAILS
                  </div>
                  <div className="t-caption" style={{ marginTop: 4 }}>
                    Payment #: {receiptDetail.payment.paymentNumber}
                  </div>
                  <div className="t-caption">Method: {enumLabel(receiptDetail.payment.method)}</div>
                  {receiptDetail.payment.transactionRef && (
                    <div className="t-caption">Ref/UTR: {receiptDetail.payment.transactionRef}</div>
                  )}
                  {receiptDetail.invoice && (
                    <div className="t-caption">Invoice: {receiptDetail.invoice.invoiceNumber}</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--primary-soft)',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 15 }}>Total Amount Received</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                  ₹{receiptDetail.amountRupees}
                </span>
              </div>

              <div className="t-caption" style={{ marginTop: 14, textAlign: 'center', color: 'var(--muted)' }}>
                Computer-generated receipt issued by PreOne Plus School OS. Strictly compliant with IT Act Section 269ST.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setReceiptDetail(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={15} /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. BULK INVOICE MODAL */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Generate Bulk Invoices"
        subtitle="Server-side preview & batch generation with duplicate protection"
        icon={<Layers size={22} />}
        wide
      >
        <form onSubmit={triggerBulkInvoice}>
          <div className="form-grid">
            <div className="field">
              <label>Select Fee Structure</label>
              <select
                className="select"
                name="feePlanId"
                value={selectedFeePlanId}
                onChange={(e) => {
                  setSelectedFeePlanId(e.target.value)
                  fetchBulkPreview(e.target.value)
                }}
              >
                <option value="">Default Term Fee</option>
                {feePlans.map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.name} ({inr(fp.totalAnnualCents)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Invoice Title <span className="req">*</span></label>
              <input className="input" name="title" defaultValue="Term 1 Tuition & Activity Fee" required />
            </div>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Due Date <span className="req">*</span></label>
              <input
                className="input"
                name="dueDate"
                type="date"
                defaultValue={new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>

          {bulkPreview && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  background: 'var(--surface-sunken)',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div className="t-caption">Total Students</div>
                  <strong>{bulkPreview.summary.totalStudents}</strong>
                </div>
                <div>
                  <div className="t-caption">Already Invoiced</div>
                  <strong style={{ color: 'var(--warning)' }}>{bulkPreview.summary.skippedCount}</strong>
                </div>
                <div>
                  <div className="t-caption">To Generate</div>
                  <strong style={{ color: 'var(--success)' }}>{bulkPreview.summary.eligibleCount}</strong>
                </div>
                <div>
                  <div className="t-caption">Total Est. Value</div>
                  <strong style={{ color: 'var(--primary)' }}>
                    ₹{bulkPreview.summary.totalNetRupees.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                <table className="dtable">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Classroom</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.students.map((it) => (
                      <tr key={it.studentId}>
                        <td>
                          <strong>{it.studentName}</strong> ({it.admissionNo})
                        </td>
                        <td>{it.classroom}</td>
                        <td>{inr(it.netCents)}</td>
                        <td>
                          {!it.isEligible ? (
                            <span className="badge b-warning">Already Invoiced</span>
                          ) : (
                            <span className="badge b-success">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setBulkOpen(false)}>
              Cancel
            </button>
            <button
              className={`btn btn-primary ${busy ? 'is-loading' : ''}`}
              disabled={busy || !bulkPreview?.summary.eligibleCount}
            >
              Generate {bulkPreview?.summary.eligibleCount || 0} Invoices
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. CREATE SINGLE INVOICE MODAL */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Raise Single Invoice"
        subtitle="Individual invoice with custom fee head"
        icon={<Plus size={22} />}
        wide
      >
        <form onSubmit={createInvoice}>
          <div className="form-grid">
            <div className="field">
              <label>Student <span className="req">*</span></label>
              <select className="select" name="studentId" required defaultValue="">
                <option value="" disabled>
                  Select student
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.admissionNo})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Fee Head <span className="req">*</span></label>
              <select className="select" name="feeHead" defaultValue="TUITION">
                {feeHeads.length > 0
                  ? feeHeads.map((h) => (
                      <option key={h.id} value={h.category}>
                        {h.name} ({enumLabel(h.category)})
                      </option>
                    ))
                  : ['TUITION', 'ADMISSION', 'TRANSPORT', 'MEAL', 'ACTIVITY', 'MATERIALS', 'OTHER'].map((fh) => (
                      <option key={fh} value={fh}>
                        {enumLabel(fh)}
                      </option>
                    ))}
              </select>
            </div>
            <div className="field">
              <label>Invoice Title <span className="req">*</span></label>
              <input className="input" name="title" defaultValue="Term Tuition Fee" required />
            </div>
            <div className="field">
              <label>Description</label>
              <input className="input" name="desc" defaultValue="Standard term fees" />
            </div>
            <div className="field">
              <label>Amount (₹) <span className="req">*</span></label>
              <input className="input" name="amount" type="number" min="1" step="0.01" placeholder="15000" required />
            </div>
            <div className="field">
              <label>Due Date <span className="req">*</span></label>
              <input
                className="input"
                name="dueDate"
                type="date"
                defaultValue={new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>
              Raise Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. CREATE FEE HEAD MODAL */}
      <Modal
        open={headOpen}
        onClose={() => setHeadOpen(false)}
        title="Create Custom Fee Head"
        subtitle="Define a reusable, database-backed charge head"
        icon={<Tag size={22} />}
      >
        <form onSubmit={createFeeHead}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Fee Head Name <span className="req">*</span></label>
              <input className="input" name="name" placeholder="e.g. Daycare Extended Hours" required />
            </div>
            <div className="field">
              <label>Code (Optional)</label>
              <input className="input" name="code" placeholder="e.g. DAYCARE_EXT" />
            </div>
            <div className="field">
              <label>Category <span className="req">*</span></label>
              <select className="select" name="category" defaultValue="OTHER">
                {['TUITION', 'ADMISSION', 'TRANSPORT', 'MEAL', 'ACTIVITY', 'MATERIALS', 'LATE_FEE', 'OTHER'].map((c) => (
                  <option key={c} value={c}>
                    {enumLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Description</label>
              <input className="input" name="description" placeholder="Notes on this fee component" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setHeadOpen(false)}>
              Cancel
            </button>
            <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>
              Save Fee Head
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. CREATE FEE STRUCTURE MODAL */}
      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Create Program Fee Structure"
        subtitle="Define fee breakdowns for a specific program"
        icon={<Building2 size={22} />}
        wide
      >
        <form onSubmit={createFeePlan}>
          <div className="form-grid">
            <div className="field">
              <label>Structure Name <span className="req">*</span></label>
              <input className="input" name="name" placeholder="Playgroup Standard 2026-27" required />
            </div>
            <div className="field">
              <label>Program Type <span className="req">*</span></label>
              <select className="select" name="programType" defaultValue="PLAYGROUP">
                {['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE'].map((p) => (
                  <option key={p} value={p}>
                    {enumLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tuition Fee (₹)</label>
              <input className="input" name="tuition" type="number" min="0" defaultValue="15000" />
            </div>
            <div className="field">
              <label>Materials & Books (₹)</label>
              <input className="input" name="materials" type="number" min="0" defaultValue="3000" />
            </div>
            <div className="field">
              <label>Activities & Events (₹)</label>
              <input className="input" name="activity" type="number" min="0" defaultValue="2000" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setPlanOpen(false)}>
              Cancel
            </button>
            <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>
              Save Structure
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. CREATE TEMPLATE MODAL */}
      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Create Document Template"
        subtitle="Configure an invoice or receipt presentation template"
        icon={<Sliders size={22} />}
      >
        <form onSubmit={createTemplate}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Template Name <span className="req">*</span></label>
              <input className="input" name="name" placeholder="e.g. Pune Campus Official Invoice" required />
            </div>
            <div className="field">
              <label>Document Type <span className="req">*</span></label>
              <select className="select" name="type" defaultValue="INVOICE">
                <option value="INVOICE">Invoice Template</option>
                <option value="RECEIPT">Receipt Template</option>
              </select>
            </div>
            <div className="field">
              <label>Header Title</label>
              <input className="input" name="headerTitle" placeholder="Fee Invoice" />
            </div>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Terms & Conditions / Disclaimer</label>
              <textarea className="input" name="termsText" rows={2} defaultValue="Fees once paid are non-refundable." />
            </div>
            <div className="field" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="isDefault" name="isDefault" />
              <label htmlFor="isDefault" style={{ margin: 0 }}>Set as Default for School</label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setTemplateOpen(false)}>
              Cancel
            </button>
            <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>
              Save Template
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. LIVE TEMPLATE PREVIEW MODAL */}
      <Modal
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={previewTemplate ? `Template Preview — ${previewTemplate.template?.name}` : ''}
        subtitle="Rendered with realistic database-backed sample data (Preview Only)"
        icon={<Eye size={22} />}
        wide
      >
        {previewTemplate && (
          <div>
            <div style={{ padding: 20, border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{previewTemplate.school.name}</h3>
                  <div className="t-caption">{previewTemplate.school.address} · {previewTemplate.school.city}</div>
                  <div className="t-caption">GSTIN: {previewTemplate.school.gstNumber}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>
                    {previewTemplate.invoice.invoiceNumber}
                  </div>
                  <div className="t-caption">Date: {previewTemplate.invoice.date}</div>
                  <span className="badge b-warning" style={{ marginTop: 4 }}>SAMPLE PREVIEW</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '14px 0' }}>
                <div>
                  <div className="t-caption" style={{ fontWeight: 600 }}>STUDENT</div>
                  <div><strong>{previewTemplate.student.name}</strong> ({previewTemplate.student.admissionNo})</div>
                  <div className="t-caption">{previewTemplate.student.classroom}</div>
                </div>
                <div>
                  <div className="t-caption" style={{ fontWeight: 600 }}>FEE PAYER</div>
                  <div>{previewTemplate.guardian.name} ({previewTemplate.guardian.relationship})</div>
                  <div className="t-caption">{previewTemplate.guardian.phone}</div>
                </div>
              </div>

              <table className="dtable" style={{ border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewTemplate.invoice.items.map((it: any, ix: number) => (
                    <tr key={ix}>
                      <td>{it.description} ({it.feeHead})</td>
                      <td style={{ textAlign: 'right' }}>₹{it.amountRupees}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Discount ({previewTemplate.invoice.discountReason})</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>- ₹{previewTemplate.invoice.discountRupees}</td>
                  </tr>
                  <tr>
                    <td className="cell-strong">Total Billed</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>₹{previewTemplate.invoice.totalRupees}</td>
                  </tr>
                </tbody>
              </table>

              <div className="t-caption" style={{ marginTop: 14, textAlign: 'center' }}>
                {previewTemplate.template.content?.termsText || 'Standard School Policy'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setPreviewTemplate(null)}>Close Preview</button>
            </div>
          </div>
        )}
      </Modal>

      {/* 9. RECORD PAYMENT MODAL */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record Payment"
        subtitle={detail ? `Balance ${inr(detail.balanceCents)}` : ''}
        icon={<IndianRupee size={22} />}
      >
        {detail && (
          <form onSubmit={recordPayment}>
            <div className="form-grid">
              <div className="field">
                <label>Amount (₹) <span className="req">*</span></label>
                <input
                  className="input"
                  name="rupees"
                  type="number"
                  min="1"
                  max={detail.balanceCents / 100}
                  step="0.01"
                  defaultValue={detail.balanceCents / 100}
                  required
                />
              </div>
              <div className="field">
                <label>Method <span className="req">*</span></label>
                <select className="select" name="method" defaultValue="UPI">
                  {['UPI', 'CASH', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'WALLET'].map((m) => (
                    <option key={m} value={m}>
                      {enumLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label>Transaction Ref / UTR</label>
                <input className="input" name="ref" placeholder="e.g. UPI-UTR-20260913-001" />
              </div>
            </div>
            <p className="helper" style={{ margin: '10px 0 0' }}>
              Receipt auto-generated on save. Strict limit: cash above ₹50,000 is blocked (IT §269ST).
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPayOpen(false)}>
                Cancel
              </button>
              <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>
                Confirm Payment
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
