'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Package,
  Layers,
  ArrowRight,
  Plus,
  RefreshCw,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  DollarSign,
  Truck,
  ShoppingCart,
  Check,
  X,
  FileText,
  Boxes,
  TrendingDown,
  AlertCircle,
  Archive,
  BarChart3,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Tag,
  Warehouse,
} from 'lucide-react'
import { PageHead, StatusBadge, EmptyState, KpiTile, Skeleton, Field } from '@/components/preone/ui'
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

export function InventoryClient({ session }: { session: SessionProps }) {
  const toast = useToast()
  const role = session.role
  const isTeacher = normalizeRole(role) === 'TEACHER'
  const isStaff = ['TEACHER', 'STAFF', 'ACCOUNTS', 'DRIVER'].includes(normalizeRole(role))
  const canApprove = ['OWNER', 'PRINCIPAL', 'PLATFORM_ADMIN'].includes(normalizeRole(role))
  const canProcure = ['OWNER', 'PRINCIPAL', 'ACCOUNTS', 'PLATFORM_ADMIN'].includes(normalizeRole(role))
  const canManageStock = ['OWNER', 'PRINCIPAL', 'ACCOUNTS', 'PLATFORM_ADMIN'].includes(normalizeRole(role))

  // Subtabs
  type TabKey = 'OVERVIEW' | 'ITEMS' | 'REQUESTS' | 'STORES' | 'PROCUREMENT' | 'RECEIVING' | 'VENDORS' | 'ANALYTICS'
  const [activeTab, setActiveTab] = useState<TabKey>(isTeacher ? 'REQUESTS' : 'OVERVIEW')

  // Data states
  const [metrics, setMetrics] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [stocks, setStocks] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [grns, setGrns] = useState<any[]>([])
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [reconciliation, setReconciliation] = useState<any>(null)

  // Loading and search
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [busy, setBusy] = useState(false)

  // Modals
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [grnModalOpen, setGrnModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState<any>(null)

  // Form lines states
  const [requestLines, setRequestLines] = useState<Array<{ itemId: string; quantityRequested: number; notes: string }>>([
    { itemId: '', quantityRequested: 1, notes: '' },
  ])
  const [poLines, setPoLines] = useState<Array<{ itemId: string; quantityOrdered: number; unitPriceCents: number; taxRatePercent: number }>>([
    { itemId: '', quantityOrdered: 10, unitPriceCents: 1000, taxRatePercent: 0 },
  ])
  const [grnLines, setGrnLines] = useState<Array<{ itemId: string; quantityReceived: number; unitPriceCents: number; batchNumber: string }>>([])
  const [issueLines, setIssueLines] = useState<Array<{ itemId: string; quantity: number }>>([
    { itemId: '', quantity: 1 },
  ])

  // Fetch functions
  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/inventory/dashboard').then((r) => r.json())
      if (res.success) setMetrics(res.data)
    } catch {}
  }, [])

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/inventory/items?pageSize=100').then((r) => r.json())
      if (res.success) setItems(res.data.items || [])
    } catch {}
  }, [])

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/inventory/material-requests?pageSize=100').then((r) => r.json())
      if (res.success) setRequests(res.data.requests || [])
    } catch {}
  }, [])

  const loadProcurement = useCallback(async () => {
    try {
      const [poRes, grnRes, recRes] = await Promise.all([
        fetch('/api/v1/inventory/purchase-orders?pageSize=100').then((r) => r.json()),
        fetch('/api/v1/inventory/grn?pageSize=100').then((r) => r.json()),
        fetch('/api/v1/inventory/reports?type=reconciliation').then((r) => r.json()),
      ])
      if (poRes.success) setOrders(poRes.data.orders || [])
      if (grnRes.success) setGrns(grnRes.data.receipts || [])
      if (recRes.success) setReconciliation(recRes.data)
    } catch {}
  }, [])

  const loadStores = useCallback(async () => {
    try {
      const [stkRes, locRes] = await Promise.all([
        fetch('/api/v1/inventory/stock').then((r) => r.json()),
        fetch('/api/v1/inventory/locations').then((r) => r.json()),
      ])
      if (stkRes.success) setStocks(stkRes.data || [])
      if (locRes.success) setLocations(locRes.data || [])
    } catch {}
  }, [])

  const loadVendorsAndMasters = useCallback(async () => {
    try {
      const [vRes, catRes, uRes, clsRes] = await Promise.all([
        fetch('/api/v1/inventory/vendors').then((r) => r.json()),
        fetch('/api/v1/inventory/categories').then((r) => r.json()),
        fetch('/api/v1/inventory/units').then((r) => r.json()),
        fetch('/api/v1/classrooms').then((r) => r.json()),
      ])
      if (vRes.success) setVendors(vRes.data || [])
      if (catRes.success) setCategories(catRes.data || [])
      if (uRes.success) setUnits(uRes.data || [])
      if (clsRes.success) setClassrooms(clsRes.data || [])
    } catch {}
  }, [])

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/inventory/reports?type=consumption').then((r) => r.json())
      if (res.success) setAnalytics(res.data)
    } catch {}
  }, [])

  const reloadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      loadDashboard(),
      loadItems(),
      loadRequests(),
      loadStores(),
      loadVendorsAndMasters(),
      loadProcurement(),
      loadAnalytics(),
    ])
    setLoading(false)
  }, [loadDashboard, loadItems, loadRequests, loadStores, loadVendorsAndMasters, loadProcurement, loadAnalytics])

  useEffect(() => {
    reloadAll()
  }, [reloadAll])

  // Handlers
  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const validItems = requestLines.filter((l) => l.itemId && l.quantityRequested > 0)
      if (validItems.length === 0) {
        toast.error('Validation Error', 'Please add at least one valid item with quantity > 0')
        setBusy(false)
        return
      }

      const payload = {
        classroomId: fd.get('classroomId') || undefined,
        priority: fd.get('priority') || 'MEDIUM',
        requiredByDate: fd.get('requiredByDate') ? new Date(String(fd.get('requiredByDate'))) : undefined,
        reason: fd.get('reason') || 'Preschool classroom supplies',
        items: validItems,
      }

      const res = await fetch('/api/v1/inventory/material-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Material Request Submitted', `Request ${json.data.requestNumber} created successfully`)
        setRequestModalOpen(false)
        setRequestLines([{ itemId: '', quantityRequested: 1, notes: '' }])
        loadRequests()
        loadDashboard()
      } else {
        toast.error('Submission Failed', json.error?.message || 'Could not submit material request')
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('Error', err.message)
    }
  }

  const handleApproveRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/inventory/material-requests/${id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast.success('Approved', 'Material request approved')
        loadRequests()
        loadDashboard()
      } else {
        toast.error('Approval Failed', json.error?.message)
      }
    } catch (err: any) {
      toast.error('Error', err.message)
    }
  }

  const handleRejectRequest = async (id: string) => {
    const reason = window.prompt('Enter reason for rejection:') || 'Not approved'
    try {
      const res = await fetch(`/api/v1/inventory/material-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Rejected', 'Material request rejected')
        loadRequests()
        loadDashboard()
      } else {
        toast.error('Rejection Failed', json.error?.message)
      }
    } catch (err: any) {
      toast.error('Error', err.message)
    }
  }

  const handleCreatePO = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const validItems = poLines.filter((l) => l.itemId && l.quantityOrdered > 0)
      if (validItems.length === 0) {
        toast.error('Validation Error', 'Add at least one item')
        setBusy(false)
        return
      }

      const payload = {
        vendorId: fd.get('vendorId'),
        destinationLocationId: fd.get('destinationLocationId'),
        expectedDeliveryDate: fd.get('expectedDeliveryDate') ? new Date(String(fd.get('expectedDeliveryDate'))) : undefined,
        paymentTerms: fd.get('paymentTerms') || 'NET_30',
        shippingAddress: fd.get('shippingAddress') || undefined,
        notes: fd.get('notes') || undefined,
        items: validItems,
      }

      const res = await fetch('/api/v1/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Purchase Order Created', `PO ${json.data.poNumber} created`)
        setPoModalOpen(false)
        loadProcurement()
        loadDashboard()
      } else {
        toast.error('PO Creation Failed', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('Error', err.message)
    }
  }

  const handleApprovePO = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/inventory/purchase-orders/${id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast.success('PO Approved', 'Purchase order status updated to ORDERED')
        loadProcurement()
        loadDashboard()
      } else {
        toast.error('Approval Failed', json.error?.message)
      }
    } catch (err: any) {
      toast.error('Error', err.message)
    }
  }

  const openGRNModal = (po: any) => {
    setSelectedPO(po)
    const lines = po.items.map((pi: any) => {
      const remaining = pi.quantityOrdered - pi.quantityReceived
      return {
        purchaseOrderItemId: pi.id,
        itemId: pi.itemId,
        itemCode: pi.item?.code || '',
        itemName: pi.item?.name || '',
        unitSymbol: pi.item?.unit?.symbol || '',
        ordered: pi.quantityOrdered,
        alreadyReceived: pi.quantityReceived,
        quantityReceived: remaining > 0 ? remaining : 0,
        unitPriceCents: pi.unitPriceCents,
        batchNumber: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      }
    })
    setGrnLines(lines)
    setGrnModalOpen(true)
  }

  const handleCreateGRN = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const validItems = grnLines.filter((l) => l.quantityReceived > 0)
      if (validItems.length === 0) {
        toast.error('Validation Error', 'Enter at least one item quantity > 0')
        setBusy(false)
        return
      }

      const payload = {
        purchaseOrderId: selectedPO.id,
        locationId: fd.get('locationId') || selectedPO.destinationLocationId,
        vendorInvoiceNumber: fd.get('vendorInvoiceNumber') || undefined,
        challanNumber: fd.get('challanNumber') || undefined,
        notes: fd.get('notes') || 'Goods receipt verification',
        items: validItems.map((l: any) => ({
          purchaseOrderItemId: l.purchaseOrderItemId,
          itemId: l.itemId,
          quantityReceived: Number(l.quantityReceived),
          unitPriceCents: Number(l.unitPriceCents),
          batchNumber: l.batchNumber || undefined,
        })),
      }

      const res = await fetch('/api/v1/inventory/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Goods Received (GRN)', `GRN ${json.data.grnNumber} finalized. Stock incremented and vendor bill posted.`)
        setGrnModalOpen(false)
        loadProcurement()
        loadStores()
        loadDashboard()
      } else {
        toast.error('GRN Failed', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('Error', err.message)
    }
  }

  const handleIssueStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      const validItems = issueLines.filter((l) => l.itemId && l.quantity > 0)
      if (validItems.length === 0) {
        toast.error('Validation Error', 'Enter valid items and quantities')
        setBusy(false)
        return
      }

      const payload = {
        fromLocationId: fd.get('fromLocationId'),
        destinationType: fd.get('destinationType'),
        classroomId: fd.get('classroomId') || undefined,
        purpose: fd.get('purpose') || 'Classroom activity distribution',
        notes: fd.get('notes') || undefined,
        items: validItems.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
        })),
      }

      const res = await fetch('/api/v1/inventory/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Stock Issued', `Issue ${json.data.issueNumber} recorded. Materials deducted from inventory.`)
        setIssueModalOpen(false)
        setIssueLines([{ itemId: '', quantity: 1 }])
        loadStores()
        loadDashboard()
        loadAnalytics()
      } else {
        toast.error('Stock Issue Failed', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('Error', err.message)
    }
  }

  const exportCsv = (type: 'stock' | 'movements' | 'procurement' | 'consumption') => {
    window.open(`/api/v1/inventory/export?type=${type}`, '_blank')
  }

  return (
    <>
      <PageHead
        title="Inventory & Procurement"
        sub="Preschool material catalog, store inventory, teacher requisitions, purchase orders, GRN receiving and vendor payables."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => exportCsv('stock')} title="Export current stock inventory to CSV">
              <Download size={15} /> Export Stock
            </button>
            <button className="btn btn-outline" onClick={reloadAll} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {isTeacher || isStaff ? (
              <button className="btn btn-primary" onClick={() => setRequestModalOpen(true)}>
                <Sparkles size={15} /> Request Materials
              </button>
            ) : null}
            {!isTeacher && canManageStock ? (
              <button className="btn btn-outline" onClick={() => setIssueModalOpen(true)}>
                <Truck size={15} /> Issue Stock
              </button>
            ) : null}
            {!isTeacher && canProcure ? (
              <button className="btn btn-primary" onClick={() => setPoModalOpen(true)}>
                <ShoppingCart size={15} /> New Purchase Order
              </button>
            ) : null}
          </div>
        }
      />

      {/* CANONICAL METRIC STRIP */}
      {!isTeacher && (
        <div className="metric-strip" style={{ marginBottom: 16 }}>
          <div className="metric-cell">
            <div className="m-top">
              <span className="m-lbl">Total Inventory Value</span>
              <DollarSign size={15} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="m-val">{inr(metrics?.totalInventoryValueCents || 0, { compact: true })}</div>
            <div className="m-meta">{metrics?.totalItems || 0} unique items across stores</div>
          </div>

          <div className="metric-cell">
            <div className="m-top">
              <span className="m-lbl">Low Stock Alerts</span>
              <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
            </div>
            <div className="m-val" style={{ color: metrics?.lowStockItemsCount > 0 ? 'var(--danger)' : 'var(--foreground)' }}>
              {metrics?.lowStockItemsCount || 0}
            </div>
            <div className="m-meta">{metrics?.lowStockItemsCount > 0 ? 'Action required' : 'All healthy'}</div>
          </div>

          <div className="metric-cell">
            <div className="m-top">
              <span className="m-lbl">Pending Requisitions</span>
              <Clock size={15} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="m-val">{metrics?.pendingMaterialRequestsCount || 0}</div>
            <div className="m-meta">{metrics?.pendingPurchaseRequestsCount || 0} purchase requests</div>
          </div>

          <div className="metric-cell">
            <div className="m-top">
              <span className="m-lbl">Open Purchase Orders</span>
              <Truck size={15} style={{ color: 'var(--success)' }} />
            </div>
            <div className="m-val m-success">{metrics?.openPurchaseOrdersCount || 0}</div>
            <div className="m-meta">Pending delivery & GRN</div>
          </div>
        </div>
      )}

      {/* SUBTAB NAVIGATION */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 16, overflowX: 'auto' }}>
        {!isTeacher && (
          <button
            className={`btn btn-ghost ${activeTab === 'OVERVIEW' ? 'active font-bold border-b-2' : ''}`}
            onClick={() => setActiveTab('OVERVIEW')}
            style={{ borderRadius: 0, borderBottom: activeTab === 'OVERVIEW' ? '2px solid var(--primary)' : 'none' }}
          >
            <BarChart3 size={15} /> Overview
          </button>
        )}
        <button
          className={`btn btn-ghost ${activeTab === 'REQUESTS' ? 'active font-bold border-b-2' : ''}`}
          onClick={() => setActiveTab('REQUESTS')}
          style={{ borderRadius: 0, borderBottom: activeTab === 'REQUESTS' ? '2px solid var(--primary)' : 'none' }}
        >
          <Sparkles size={15} /> Material Requests
        </button>
        {!isTeacher && (
          <>
            <button
              className={`btn btn-ghost ${activeTab === 'ITEMS' ? 'active font-bold border-b-2' : ''}`}
              onClick={() => setActiveTab('ITEMS')}
              style={{ borderRadius: 0, borderBottom: activeTab === 'ITEMS' ? '2px solid var(--primary)' : 'none' }}
            >
              <Package size={15} /> Material Catalog
            </button>
            <button
              className={`btn btn-ghost ${activeTab === 'STORES' ? 'active font-bold border-b-2' : ''}`}
              onClick={() => setActiveTab('STORES')}
              style={{ borderRadius: 0, borderBottom: activeTab === 'STORES' ? '2px solid var(--primary)' : 'none' }}
            >
              <Warehouse size={15} /> Store Stock & Balances
            </button>
            <button
              className={`btn btn-ghost ${activeTab === 'PROCUREMENT' ? 'active font-bold border-b-2' : ''}`}
              onClick={() => setActiveTab('PROCUREMENT')}
              style={{ borderRadius: 0, borderBottom: activeTab === 'PROCUREMENT' ? '2px solid var(--primary)' : 'none' }}
            >
              <ShoppingCart size={15} /> Purchase Orders
            </button>
            <button
              className={`btn btn-ghost ${activeTab === 'RECEIVING' ? 'active font-bold border-b-2' : ''}`}
              onClick={() => setActiveTab('RECEIVING')}
              style={{ borderRadius: 0, borderBottom: activeTab === 'RECEIVING' ? '2px solid var(--primary)' : 'none' }}
            >
              <Truck size={15} /> Goods Receipt (GRN)
            </button>
            <button
              className={`btn btn-ghost ${activeTab === 'VENDORS' ? 'active font-bold border-b-2' : ''}`}
              onClick={() => setActiveTab('VENDORS')}
              style={{ borderRadius: 0, borderBottom: activeTab === 'VENDORS' ? '2px solid var(--primary)' : 'none' }}
            >
              <Building2 size={15} /> Vendors & Payables
            </button>
            <button
              className={`btn btn-ghost ${activeTab === 'ANALYTICS' ? 'active font-bold border-b-2' : ''}`}
              onClick={() => setActiveTab('ANALYTICS')}
              style={{ borderRadius: 0, borderBottom: activeTab === 'ANALYTICS' ? '2px solid var(--primary)' : 'none' }}
            >
              <Boxes size={15} /> Classroom Consumption
            </button>
          </>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="var(--warning)" /> Low Stock Attention
            </h3>
            {metrics?.lowStockItems?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {metrics.lowStockItems.map((item: any) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {item.code} · Reorder Level: {item.reorderPoint} {item.unit?.symbol}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge b-danger">Shortage</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>All inventory items currently meet or exceed safety reorder levels.</p>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--primary)" /> Urgent Requisitions
            </h3>
            {requests.filter((r) => r.status === 'PENDING').slice(0, 5).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requests.filter((r) => r.status === 'PENDING').slice(0, 5).map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.requestNumber} - {r.classroom?.name || 'School General'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Req by {r.requestedBy?.name || 'Staff'} · {r.items?.length || 0} items</div>
                    </div>
                    {canApprove && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => handleApproveRequest(r.id)}>Approve</button>
                        <button className="btn btn-sm btn-outline" onClick={() => handleRejectRequest(r.id)}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending requisitions awaiting approval.</p>
            )}
          </div>

          <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={18} color="var(--success)" /> Procurement & Finance Alignment
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total PO Committed</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{inr(reconciliation?.totalPOCommittedCents || 0)}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Goods Received Value (GRN)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{inr(reconciliation?.totalGRNValueCents || 0)}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vendor Bills Posted</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{inr(reconciliation?.totalVendorBillsPostedCents || 0)}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vendor Payable Balance</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4, color: 'var(--danger)' }}>{inr(reconciliation?.vendorPayableBalanceCents || 0)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MATERIAL REQUESTS (TEACHER & ADMIN) */}
      {activeTab === 'REQUESTS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ position: 'relative', width: 280 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="Search requests..."
                style={{ paddingLeft: 34 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setRequestModalOpen(true)}>
              <Plus size={15} /> Raise Material Request
            </button>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Classroom / Destination</th>
                  <th>Requested By</th>
                  <th>Required By</th>
                  <th>Items</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No material requests found. Click "Raise Material Request" to request supplies.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.requestNumber}</td>
                      <td>{r.classroom?.name || 'Preschool Operations'}</td>
                      <td>{r.requestedBy?.name || 'Staff'}</td>
                      <td>{fmtDate(r.requiredByDate)}</td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {r.items?.map((it: any) => `${it.quantityRequested}x ${it.item?.name}`).join(', ')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${r.priority === 'HIGH' || r.priority === 'URGENT' ? 'b-danger' : 'b-neutral'}`}>
                          {r.priority}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        {r.status === 'PENDING' && canApprove ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-primary" onClick={() => handleApproveRequest(r.id)}>
                              Approve
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => handleRejectRequest(r.id)}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No actions</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MATERIAL CATALOG */}
      {activeTab === 'ITEMS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 280 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="Search items..."
                style={{ paddingLeft: 34 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setItemModalOpen(true)}>
              <Plus size={15} /> Add Inventory Item
            </button>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Cost Price</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No inventory items found. Add items to track preschool stock.
                    </td>
                  </tr>
                ) : (
                  items
                    .filter((it) => !searchQuery || it.name.toLowerCase().includes(searchQuery.toLowerCase()) || it.code.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((it) => (
                      <tr key={it.id}>
                        <td style={{ fontWeight: 600 }}>{it.code}</td>
                        <td>{it.name}</td>
                        <td>{it.category?.name || 'Unassigned'}</td>
                        <td><StatusBadge status={it.itemType} /></td>
                        <td>{it.unit?.name} ({it.unit?.symbol})</td>
                        <td>{inr(it.costPriceCents || 0)}</td>
                        <td>{it.reorderPoint}</td>
                        <td><StatusBadge status={it.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: STORES & STOCK BALANCES */}
      {activeTab === 'STORES' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Live Physical Store Balances</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setAdjustModalOpen(true)}>
                <Boxes size={15} /> Physical Count Adjustment
              </button>
              <button className="btn btn-primary" onClick={() => setIssueModalOpen(true)}>
                <Truck size={15} /> Issue Stock
              </button>
            </div>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th>Batch #</th>
                  <th>Quantity on Hand</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {stocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No stock currently on hand in any store location. Receive goods through GRN to populate stock.
                    </td>
                  </tr>
                ) : (
                  stocks.map((stk) => (
                    <tr key={stk.id}>
                      <td style={{ fontWeight: 600 }}>{stk.location?.name} ({stk.location?.code})</td>
                      <td>{stk.item?.code}</td>
                      <td>{stk.item?.name}</td>
                      <td>{stk.batchNumber || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{stk.quantity} {stk.item?.unit?.symbol}</td>
                      <td>{stk.reservedQuantity} {stk.item?.unit?.symbol}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{stk.availableQuantity} {stk.item?.unit?.symbol}</td>
                      <td>{stk.expiryDate ? fmtDate(stk.expiryDate) : 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PURCHASE ORDERS */}
      {activeTab === 'PROCUREMENT' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Purchase Orders</h3>
            <button className="btn btn-primary" onClick={() => setPoModalOpen(true)}>
              <Plus size={15} /> Create Purchase Order
            </button>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Vendor</th>
                  <th>Order Date</th>
                  <th>Expected Delivery</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No purchase orders recorded. Create a PO to procure goods.
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poNumber}</td>
                      <td>{po.vendor?.name}</td>
                      <td>{fmtDate(po.orderDate)}</td>
                      <td>{fmtDate(po.expectedDeliveryDate)}</td>
                      <td style={{ fontWeight: 700 }}>{inr(po.grandTotalCents)}</td>
                      <td><StatusBadge status={po.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {po.status === 'DRAFT' && canApprove && (
                            <button className="btn btn-sm btn-primary" onClick={() => handleApprovePO(po.id)}>
                              Approve
                            </button>
                          )}
                          {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                            <button className="btn btn-sm btn-outline" onClick={() => openGRNModal(po)}>
                              <Truck size={14} /> Receive Goods
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: GOODS RECEIPT (GRN) */}
      {activeTab === 'RECEIVING' && (
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Goods Receipt Notes (GRN) History</h3>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>GRN #</th>
                  <th>PO Reference</th>
                  <th>Vendor</th>
                  <th>Received Date</th>
                  <th>Total Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {grns.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No goods receipts recorded yet. Receive items against approved POs.
                    </td>
                  </tr>
                ) : (
                  grns.map((grn) => (
                    <tr key={grn.id}>
                      <td style={{ fontWeight: 600 }}>{grn.grnNumber}</td>
                      <td>{grn.purchaseOrder?.poNumber || 'Direct'}</td>
                      <td>{grn.vendor?.name}</td>
                      <td>{fmtDate(grn.receivedDate)}</td>
                      <td style={{ fontWeight: 700 }}>{inr(grn.totalReceivedValueCents)}</td>
                      <td><StatusBadge status={grn.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: VENDORS */}
      {activeTab === 'VENDORS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Approved Vendors & Suppliers</h3>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Code</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Payment Terms</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No vendors registered.
                    </td>
                  </tr>
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.name}</td>
                      <td>{v.code}</td>
                      <td>{v.contactPerson || '—'}</td>
                      <td>{v.email || '—'}</td>
                      <td>{v.phone || '—'}</td>
                      <td>{v.paymentTerms || 'NET_30'}</td>
                      <td><StatusBadge status={v.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: CLASSROOM CONSUMPTION ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Consumption by Destination</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {(Array.isArray(analytics?.byDestination)
                ? analytics.byDestination
                : analytics?.byDestination && typeof analytics.byDestination === 'object'
                  ? Object.entries(analytics.byDestination).map(([destinationType, d]: [string, any]) => ({
                      destinationType,
                      totalValueCents: d.totalValueCents ?? Math.round((d.value || 0) * 100),
                    }))
                  : []
              ).map((d: any) => (
                <div key={d.destinationType} style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.destinationType}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{inr(d.totalValueCents || 0)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Classroom Supplies Distribution</h3>
            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Classroom</th>
                  <th>Total Consumed Value</th>
                </tr>
              </thead>
              <tbody>
                {(!Array.isArray(analytics?.byClassroom) || analytics.byClassroom.length === 0) ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No classroom consumption recorded yet.</td>
                  </tr>
                ) : (
                  analytics.byClassroom.map((c: any) => (
                    <tr key={c.classroomId}>
                      <td style={{ fontWeight: 600 }}>{c.classroomName || c.name || c.classroomId}</td>
                      <td style={{ fontWeight: 700 }}>{inr(c.totalValueCents || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: TEACHER / STAFF SIMPLE REQUEST MATERIALS */}
      <Modal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request Materials & Supplies"
        subtitle="1-step simple requisition for preschool classroom activities and supplies"
        icon={<Sparkles size={20} />}
        iconClass="ic-purple"
        wide
      >
        <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Classroom" required>
              <select name="classroomId" className="input" required>
                <option value="">-- Select Classroom --</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </Field>

            <Field label="Required By Date">
              <input type="date" name="requiredByDate" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Priority">
              <select name="priority" className="input" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Today/Tomorrow)</option>
              </select>
            </Field>

            <Field label="Purpose / Reason" required>
              <input type="text" name="reason" className="input" placeholder="e.g. Painting activity, Montessori block play" required />
            </Field>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Requested Items</label>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setRequestLines([...requestLines, { itemId: '', quantityRequested: 1, notes: '' }])}
              >
                <Plus size={14} /> Add Another Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requestLines.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 2fr auto', gap: 8, alignItems: 'center' }}>
                  <select
                    className="input"
                    value={line.itemId}
                    onChange={(e) => {
                      const updated = [...requestLines]
                      updated[idx].itemId = e.target.value
                      setRequestLines(updated)
                    }}
                    required
                  >
                    <option value="">-- Choose Item --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>{it.name} ({it.unit?.symbol})</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    className="input"
                    placeholder="Qty"
                    value={line.quantityRequested}
                    onChange={(e) => {
                      const updated = [...requestLines]
                      updated[idx].quantityRequested = Number(e.target.value)
                      setRequestLines(updated)
                    }}
                    required
                  />

                  <input
                    type="text"
                    className="input"
                    placeholder="Notes (e.g. Red color, pack of 12)"
                    value={line.notes}
                    onChange={(e) => {
                      const updated = [...requestLines]
                      updated[idx].notes = e.target.value
                      setRequestLines(updated)
                    }}
                  />

                  {requestLines.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setRequestLines(requestLines.filter((_, i) => i !== idx))}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setRequestModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ADD INVENTORY ITEM */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title="Add Inventory Item"
        subtitle="Register new material, consumable or preschool learning kit"
        icon={<Package size={20} />}
        iconClass="ic-blue"
        wide
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            const fd = new FormData(e.currentTarget)
            try {
              const res = await fetch('/api/v1/inventory/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  categoryId: fd.get('categoryId'),
                  unitId: fd.get('unitId'),
                  name: fd.get('name'),
                  code: fd.get('code'),
                  itemType: fd.get('itemType'),
                  costPriceCents: Math.round(Number(fd.get('costPrice') || 0) * 100),
                  reorderPoint: Number(fd.get('reorderPoint') || 10),
                  reorderQuantity: Number(fd.get('reorderQuantity') || 20),
                  trackExpiry: fd.get('trackExpiry') === 'on',
                }),
              })
              const json = await res.json()
              setBusy(false)
              if (json.success) {
                toast.success('Item Added', `${json.data.name} saved`)
                setItemModalOpen(false)
                loadItems()
              } else {
                toast.error('Failed', json.error?.message)
              }
            } catch (err: any) {
              setBusy(false)
              toast.error('Error', err.message)
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Item Name" required>
              <input type="text" name="name" className="input" placeholder="e.g. Non-toxic Finger Paint (500ml)" required />
            </Field>
            <Field label="Item Code / SKU" required>
              <input type="text" name="code" className="input" placeholder="e.g. ART-PNT-500" required />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Category" required>
              <select name="categoryId" className="input" required>
                <option value="">-- Choose Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Item Type" required>
              <select name="itemType" className="input" defaultValue="CONSUMABLE" required>
                <option value="CONSUMABLE">Consumable</option>
                <option value="STATIONERY">Stationery</option>
                <option value="LEARNING_KIT">Learning Kit</option>
                <option value="ASSET">Asset (Durable)</option>
                <option value="UNIFORM">Uniform</option>
                <option value="FIRST_AID">First Aid</option>
                <option value="CLEANING">Cleaning Supplies</option>
                <option value="KITCHEN_PANTRY">Kitchen & Pantry</option>
              </select>
            </Field>

            <Field label="Measurement Unit" required>
              <select name="unitId" className="input" required>
                <option value="">-- Choose Unit --</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Cost Price (₹)">
              <input type="number" step="0.01" name="costPrice" className="input" placeholder="0.00" />
            </Field>
            <Field label="Reorder Point">
              <input type="number" name="reorderPoint" className="input" defaultValue="10" />
            </Field>
            <Field label="Reorder Quantity">
              <input type="number" name="reorderQuantity" className="input" defaultValue="20" />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input type="checkbox" name="trackExpiry" /> Track Batch Expiry (Recommended for first aid, kitchen & paints)
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setItemModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save Item</button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: CREATE PURCHASE ORDER */}
      <Modal
        open={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        title="Create Purchase Order"
        subtitle="Procure goods from approved vendor with automated tax and bill reconciliation"
        icon={<ShoppingCart size={20} />}
        iconClass="ic-green"
        wide
      >
        <form onSubmit={handleCreatePO} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Vendor" required>
              <select name="vendorId" className="input" required>
                <option value="">-- Select Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                ))}
              </select>
            </Field>

            <Field label="Receiving Location" required>
              <select name="destinationLocationId" className="input" required>
                <option value="">-- Choose Store / Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Expected Delivery Date">
              <input type="date" name="expectedDeliveryDate" className="input" />
            </Field>
            <Field label="Payment Terms">
              <select name="paymentTerms" className="input" defaultValue="NET_30">
                <option value="IMMEDIATE">Immediate</option>
                <option value="NET_15">Net 15 Days</option>
                <option value="NET_30">Net 30 Days</option>
                <option value="ADVANCE">Advance Payment</option>
              </select>
            </Field>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>PO Line Items</label>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setPoLines([...poLines, { itemId: '', quantityOrdered: 10, unitPriceCents: 1000, taxRatePercent: 0 }])}
              >
                <Plus size={14} /> Add Line
              </button>
            </div>

            {poLines.map((line, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select
                  className="input"
                  value={line.itemId}
                  onChange={(e) => {
                    const updated = [...poLines]
                    updated[idx].itemId = e.target.value
                    setPoLines(updated)
                  }}
                  required
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} ({it.unit?.symbol})</option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  className="input"
                  placeholder="Qty"
                  value={line.quantityOrdered}
                  onChange={(e) => {
                    const updated = [...poLines]
                    updated[idx].quantityOrdered = Number(e.target.value)
                    setPoLines(updated)
                  }}
                  required
                />

                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="Price (₹)"
                  value={line.unitPriceCents / 100}
                  onChange={(e) => {
                    const updated = [...poLines]
                    updated[idx].unitPriceCents = Math.round(Number(e.target.value) * 100)
                    setPoLines(updated)
                  }}
                  required
                />

                <select
                  className="input"
                  value={line.taxRatePercent}
                  onChange={(e) => {
                    const updated = [...poLines]
                    updated[idx].taxRatePercent = Number(e.target.value)
                    setPoLines(updated)
                  }}
                >
                  <option value="0">0% GST</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST</option>
                </select>

                {poLines.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setPoLines(poLines.filter((_, i) => i !== idx))}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setPoModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Create PO</button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: GOODS RECEIPT (GRN) WITH PARTIAL RECEIVING VISUALIZATION */}
      <Modal
        open={grnModalOpen}
        onClose={() => setGrnModalOpen(false)}
        title="Receive Goods (GRN)"
        subtitle={`PO ${selectedPO?.poNumber || ''} — Receive items, record batches, update stock & post vendor bill`}
        icon={<Truck size={20} />}
        iconClass="ic-blue"
        wide
      >
        <form onSubmit={handleCreateGRN} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Vendor Invoice Number">
              <input type="text" name="vendorInvoiceNumber" className="input" placeholder="e.g. INV-98742" />
            </Field>
            <Field label="Store / Receiving Location" required>
              <select name="locationId" className="input" defaultValue={selectedPO?.destinationLocationId} required>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8, display: 'block' }}>
              Receiving Checklist (Partial receiving supported)
            </label>

            <table className="table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Ordered</th>
                  <th>Already Received</th>
                  <th>Receiving Now</th>
                  <th>Batch / Lot #</th>
                </tr>
              </thead>
              <tbody>
                {grnLines.map((line: any, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{line.itemName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{line.itemCode}</div>
                    </td>
                    <td>{line.ordered} {line.unitSymbol}</td>
                    <td>{line.alreadyReceived} {line.unitSymbol}</td>
                    <td style={{ width: 120 }}>
                      <input
                        type="number"
                        min="0"
                        max={line.ordered - line.alreadyReceived}
                        className="input"
                        value={line.quantityReceived}
                        onChange={(e) => {
                          const updated = [...grnLines]
                          updated[idx].quantityReceived = Number(e.target.value)
                          setGrnLines(updated)
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input"
                        placeholder="Batch #"
                        value={line.batchNumber}
                        onChange={(e) => {
                          const updated = [...grnLines]
                          updated[idx].batchNumber = e.target.value
                          setGrnLines(updated)
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setGrnModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Processing...' : 'Finalize GRN & Post Bill'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: ISSUE STOCK TO CLASSROOM / DESTINATION */}
      <Modal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title="Issue Stock from Store"
        subtitle="Disburse materials to classrooms, kitchen, cleaning or operations"
        icon={<Truck size={20} />}
        iconClass="ic-orange"
        wide
      >
        <form onSubmit={handleIssueStock} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="From Store Location" required>
              <select name="fromLocationId" className="input" required>
                <option value="">-- Choose Store --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </Field>

            <Field label="Destination Type" required>
              <select name="destinationType" className="input" defaultValue="CLASSROOM" required>
                <option value="CLASSROOM">Classroom</option>
                <option value="KITCHEN">Kitchen & Pantry</option>
                <option value="CLEANING">Cleaning & Sanitization</option>
                <option value="FIRST_AID">Infirmary / First Aid</option>
                <option value="OPERATIONS">General Operations</option>
              </select>
            </Field>
          </div>

          <Field label="Classroom (if applicable)">
            <select name="classroomId" className="input">
              <option value="">-- None / General --</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </Field>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Items to Issue</label>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setIssueLines([...issueLines, { itemId: '', quantity: 1 }])}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {issueLines.map((line, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select
                  className="input"
                  value={line.itemId}
                  onChange={(e) => {
                    const updated = [...issueLines]
                    updated[idx].itemId = e.target.value
                    setIssueLines(updated)
                  }}
                  required
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} ({it.unit?.symbol})</option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  className="input"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => {
                    const updated = [...issueLines]
                    updated[idx].quantity = Number(e.target.value)
                    setIssueLines(updated)
                  }}
                  required
                />

                {issueLines.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setIssueLines(issueLines.filter((_, i) => i !== idx))}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIssueModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Issue Stock</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
