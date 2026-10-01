'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  ScrollText,
  ShieldCheck,
  Download,
  Filter,
  Eye,
  Globe,
  Terminal,
  Search,
  RefreshCw,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Clock,
  Layers,
  FileCode2,
} from 'lucide-react'
import { PageHead, EmptyState, Skeleton, KpiTile } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { fmtDate, timeAgo } from '@/lib/format'

interface Log {
  id: string
  action: string
  entity: string
  entityId: string | null
  module: string | null
  summary: string | null
  severity: string
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  branchId: string | null
  academicSessionId: string | null
  ipAddress: string | null
  userAgent: string | null
  requestId: string | null
  oldValues: string | null
  newValues: string | null
  createdAt: string
}

interface Kpis {
  totalEvents: number
  todayEvents: number
  securityEvents: number
  criticalEvents: number
  failedActions: number
  exportEvents: number
}

const ACTION_CLS: Record<string, string> = {
  CREATE: 'b-success',
  UPDATE: 'b-info',
  DELETE: 'b-danger',
  LOGIN: 'b-primary',
  APPROVE: 'b-success',
  REJECT: 'b-danger',
  PUBLISH: 'b-orange',
  SCAN: 'b-pink',
  GATE_PICKUP: 'b-success',
  PICKUP_VERIFICATION_FAILED: 'b-danger',
  LOGIN_FAILED: 'b-danger',
  AUTHORIZATION_FAILED: 'b-danger',
  ROLE_CHANGED: 'b-danger',
  PERMISSION_CHANGED: 'b-danger',
  AUDIT_LOG_EXPORTED: 'b-neutral',
}

const MODULES = [
  'ALL',
  'Auth',
  'Users',
  'Setup',
  'Academics',
  'Admissions',
  'Students',
  'Operations',
  'Fees',
  'Announcements',
  'Settings',
  'Audit',
]

const SEVERITIES = ['ALL', 'INFO', 'WARNING', 'CRITICAL']

const CATEGORY_TABS = [
  { key: 'all', label: 'All Activity' },
  { key: 'security', label: 'Security Events' },
  { key: 'changes', label: 'Data Changes' },
  { key: 'finance', label: 'Payment Activity' },
  { key: 'exports', label: 'Exports' },
]

export default function AuditPage() {
  const toast = useToast()
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [selectedLog, setSelectedLog] = useState<Log | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [category, setCategory] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(async () => {
    setBusy(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', '25')
    if (category !== 'all') params.set('category', category)
    if (moduleFilter !== 'ALL') params.set('module', moduleFilter)
    if (severityFilter !== 'ALL') params.set('severity', severityFilter)
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)

    try {
      const res = await fetch(`/api/v1/audit-logs?${params.toString()}`)
      const j = await res.json()
      if (j.success) {
        setLogs(j.data)
        if (j.meta) {
          setTotalPages(j.meta.totalPages || 1)
          setTotalCount(j.meta.total || 0)
          if (j.meta.kpis) setKpis(j.meta.kpis)
        }
      } else {
        setLogs([])
        toast.error('Failed to load audit trail', j.error?.message || 'Server error')
      }
    } catch {
      setLogs([])
      toast.error('Failed to load audit trail', 'Network or connection error')
    } finally {
      setBusy(false)
    }
  }, [category, moduleFilter, severityFilter, searchQuery, dateFrom, dateTo, page, toast])

  useEffect(() => {
    load()
  }, [load])

  const handleExport = async () => {
    setExporting(true)
    const params = new URLSearchParams()
    if (moduleFilter !== 'ALL') params.set('module', moduleFilter)
    if (severityFilter !== 'ALL') params.set('severity', severityFilter)
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)

    try {
      const res = await fetch(`/api/v1/audit-logs/export?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Audit Log Exported', 'CSV downloaded and export action recorded')
      load() // Refresh to reflect AUDIT_LOG_EXPORTED
    } catch (e: any) {
      toast.error('Export failed', e.message || 'Could not export audit log')
    } finally {
      setExporting(false)
    }
  }

  // Parse JSON values safely
  const parseJsonSafe = (str: string | null) => {
    if (!str) return null
    try {
      return typeof str === 'string' ? JSON.parse(str) : str
    } catch {
      return str
    }
  }

  return (
    <>
      <PageHead
        title="Audit Logs & Governance"
        sub="Authoritative, tamper-evident forensic history and security event tracking across PreOne"
        actions={
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        }
      />

      {/* ── Canonical Metric Strip ── */}
      <div className="metric-strip" style={{ marginBottom: 16 }}>
        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Total Events</span>
            <ScrollText size={15} style={{ color: 'var(--primary)' }} />
          </div>
          <div className="m-val">{kpis?.totalEvents ?? '...'}</div>
          <div className="m-meta">System audit log</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Today's Activity</span>
            <Clock size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="m-val">{kpis?.todayEvents ?? '...'}</div>
          <div className="m-meta">Logged today</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Security Events</span>
            <ShieldCheck size={15} style={{ color: 'var(--warning)' }} />
          </div>
          <div className="m-val" style={{ color: 'var(--warning-text, var(--warning))' }}>{kpis?.securityEvents ?? '...'}</div>
          <div className="m-meta">Auth & access</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Critical Mutations</span>
            <Flame size={15} style={{ color: 'var(--danger)' }} />
          </div>
          <div className="m-val" style={{ color: 'var(--danger)' }}>{kpis?.criticalEvents ?? '...'}</div>
          <div className="m-meta">Data modifications</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Failed Actions</span>
            <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
          </div>
          <div className="m-val" style={{ color: 'var(--danger)' }}>{kpis?.failedActions ?? '...'}</div>
          <div className="m-meta">System rejections</div>
        </div>

        <div className="metric-cell">
          <div className="m-top">
            <span className="m-lbl">Audit Exports</span>
            <FileSpreadsheet size={15} style={{ color: 'var(--foreground-muted)' }} />
          </div>
          <div className="m-val">{kpis?.exportEvents ?? '...'}</div>
          <div className="m-meta">CSV generations</div>
        </div>
      </div>

      {/* ── Category Views / Views Bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          background: 'var(--surface-sunken)',
          padding: 4,
          borderRadius: 'var(--radius-12)',
          marginBottom: 14,
          overflowX: 'auto',
        }}
      >
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`btn btn-sm ${category === tab.key ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              padding: '6px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 'var(--radius-8)',
            }}
            onClick={() => {
              setCategory(tab.key)
              setPage(1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main Activity Table & Advanced Filters ── */}
      <div className="card" style={{ padding: 0 }}>
        {/* Filter Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search action, record, summary, actor..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              style={{
                width: '100%',
                height: 34,
                paddingLeft: 32,
                paddingRight: 10,
                fontSize: 13,
                borderRadius: 'var(--radius-8)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--foreground)',
              }}
            />
          </div>

          {/* Dropdown Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="t-caption" style={{ fontWeight: 600 }}>Module:</span>
              <select
                className="select"
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value)
                  setPage(1)
                }}
                style={{ height: 32, fontSize: 12.5, padding: '0 8px' }}
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m === 'ALL' ? 'All Modules' : m}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="t-caption" style={{ fontWeight: 600 }}>Severity:</span>
              <select
                className="select"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value)
                  setPage(1)
                }}
                style={{ height: 32, fontSize: 12.5, padding: '0 8px' }}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All Severities' : s}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="t-caption" style={{ fontWeight: 600 }}>From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                style={{
                  height: 32,
                  fontSize: 12,
                  padding: '0 6px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="t-caption" style={{ fontWeight: 600 }}>To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                style={{
                  height: 32,
                  fontSize: 12,
                  padding: '0 6px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => load()}
              disabled={busy}
              title="Refresh logs"
              style={{ padding: '4px 8px' }}
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Audit Data Table */}
        <div className="dtable-scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th>When</th>
                <th>Action & Severity</th>
                <th>Module</th>
                <th>Entity & ID</th>
                <th>Summary</th>
                <th>Actor</th>
                <th>Network</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelectedLog(l)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{timeAgo(l.createdAt)}</div>
                    <div className="t-caption">{fmtDate(l.createdAt)}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className={`badge ${ACTION_CLS[l.action] || 'b-neutral'}`}
                        style={{ fontSize: 11, fontWeight: 700 }}
                      >
                        {l.action}
                      </span>
                      <span
                        className={`badge ${
                          l.severity === 'CRITICAL'
                            ? 'b-danger'
                            : l.severity === 'WARNING'
                            ? 'b-orange'
                            : 'b-neutral'
                        }`}
                        style={{ fontSize: 9.5, padding: '1px 5px' }}
                      >
                        {l.severity}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5, fontWeight: 600 }}>{l.module || '-'}</td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{l.entity}</span>
                    {l.entityId && (
                      <span className="t-caption" style={{ display: 'block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        #{l.entityId.slice(0, 10)}
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--foreground)' }}>
                      {l.summary || '-'}
                    </span>
                    {(l.oldValues || l.newValues) && (
                      <span
                        className="badge b-info"
                        style={{ marginLeft: 6, fontSize: 9, padding: '1px 4px' }}
                      >
                        Diff Available
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{l.actorName || 'System'}</div>
                    <div className="t-caption">{l.actorRole || 'SYSTEM'}</div>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.ipAddress || '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 4 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedLog(l)
                      }}
                      title="Inspect log details"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {logs === null && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} h={38} />
              ))}
            </div>
          )}

          {logs?.length === 0 && (
            <EmptyState
              illustration="documents"
              eyebrow="Audit Trail"
              title="No audit events matched"
              description={
                searchQuery || moduleFilter !== 'ALL' || severityFilter !== 'ALL'
                  ? 'No audit log records match the selected filter criteria. Try clearing or widening your query.'
                  : 'As staff interact with PreOne OS, all authoritative mutations and security events land here.'
              }
              action={
                searchQuery || moduleFilter !== 'ALL' || severityFilter !== 'ALL'
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setSearchQuery('')
                        setModuleFilter('ALL')
                        setSeverityFilter('ALL')
                        setDateFrom('')
                        setDateTo('')
                        setPage(1)
                      },
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
          )}
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12.5,
            color: 'var(--muted)',
          }}
        >
          <div>
            Showing <b>{logs?.length || 0}</b> of <b>{totalCount}</b> total audit records
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page <b>{page}</b> of <b>{totalPages}</b>
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Forensic Log Detail Inspector Modal ── */}
      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `Forensic Audit Event #${selectedLog.id.slice(0, 8)}` : ''}
        subtitle="Authoritative tamper-evident snapshot & field-level diff"
        icon={<Terminal size={22} />}
        wide
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header Metadata Summary Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                background: 'var(--surface-sunken)',
                padding: 12,
                borderRadius: 10,
                fontSize: 12.5,
              }}
            >
              <div>
                <div className="t-caption">ACTION & SEVERITY</div>
                <div style={{ fontWeight: 700, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{selectedLog.action}</span>
                  <span
                    className={`badge ${
                      selectedLog.severity === 'CRITICAL'
                        ? 'b-danger'
                        : selectedLog.severity === 'WARNING'
                        ? 'b-orange'
                        : 'b-neutral'
                    }`}
                    style={{ fontSize: 9.5 }}
                  >
                    {selectedLog.severity}
                  </span>
                </div>
              </div>
              <div>
                <div className="t-caption">MODULE & ENTITY</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>
                  {selectedLog.module || 'System'} · {selectedLog.entity}
                </div>
              </div>
              <div>
                <div className="t-caption">ACTOR IDENTITY</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>
                  {selectedLog.actorName || 'System'} ({selectedLog.actorRole || 'SYSTEM'})
                </div>
              </div>
              <div>
                <div className="t-caption">TIMESTAMP</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>
                  {fmtDate(selectedLog.createdAt)}
                </div>
              </div>
            </div>

            {/* Event Summary */}
            <div>
              <div className="t-caption" style={{ fontWeight: 600, marginBottom: 4 }}>
                EVENT SUMMARY
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  background: 'var(--surface)',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {selectedLog.summary || 'No summary text recorded.'}
              </p>
            </div>

            {/* Context IDs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
                fontSize: 12,
                background: 'var(--surface)',
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <span className="t-caption">ENTITY ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                  {selectedLog.entityId || 'N/A'}
                </span>
              </div>
              <div>
                <span className="t-caption">BRANCH ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                  {selectedLog.branchId || 'All Branches'}
                </span>
              </div>
              <div>
                <span className="t-caption">ACADEMIC SESSION:</span>
                <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                  {selectedLog.academicSessionId || 'Global / N/A'}
                </span>
              </div>
              <div>
                <span className="t-caption">REQUEST ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                  {selectedLog.requestId || 'Internal'}
                </span>
              </div>
            </div>

            {/* Client / Network Forensics */}
            {(selectedLog.ipAddress || selectedLog.userAgent) && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  alignItems: 'center',
                  fontSize: 12,
                  color: 'var(--muted)',
                  padding: '4px 0',
                }}
              >
                {selectedLog.ipAddress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Globe size={13} /> IP Address: <b>{selectedLog.ipAddress}</b>
                  </div>
                )}
                {selectedLog.userAgent && (
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
                    Client Agent: <i>{selectedLog.userAgent}</i>
                  </div>
                )}
              </div>
            )}

            {/* Before / After Forensic Diff */}
            {(selectedLog.oldValues || selectedLog.newValues) && (
              <div>
                <div className="t-caption" style={{ fontWeight: 600, marginBottom: 6 }}>
                  FIELD-LEVEL MUTATION DIFF (BEFORE vs AFTER)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: selectedLog.oldValues ? '1fr 1fr' : '1fr',
                    gap: 10,
                  }}
                >
                  {selectedLog.oldValues && (
                    <div>
                      <div
                        className="t-caption"
                        style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}
                      >
                        BEFORE (ORIGINAL VALUES)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 10,
                          background: 'var(--surface-sunken)',
                          borderRadius: 8,
                          fontSize: 11,
                          maxHeight: 220,
                          overflow: 'auto',
                          fontFamily: 'var(--font-mono)',
                          border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
                        }}
                      >
                        {JSON.stringify(parseJsonSafe(selectedLog.oldValues), null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.newValues && (
                    <div>
                      <div
                        className="t-caption"
                        style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}
                      >
                        AFTER (COMMITTED VALUES)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 10,
                          background: 'var(--surface-sunken)',
                          borderRadius: 8,
                          fontSize: 11,
                          maxHeight: 220,
                          overflow: 'auto',
                          fontFamily: 'var(--font-mono)',
                          border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
                        }}
                      >
                        {JSON.stringify(parseJsonSafe(selectedLog.newValues), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
