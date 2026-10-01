'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  BarChart3, Download, Filter, RefreshCw, Calendar, FileSpreadsheet,
  FileText, Printer, Search, Plus, Trash2, Eye, CheckCircle2,
  Users, CalendarCheck, IndianRupee, HeartPulse, Sparkles, Bus, Package,
  Sliders, AlertTriangle
} from 'lucide-react'
import { PageHead, Segmented, KpiTile, EmptyState, Field, StatusBadge } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { DataTable, Column } from '@/components/preone/DataTable'
import { useToast } from '@/components/preone/Toast'

type TabKey = 'executive' | 'students' | 'attendance' | 'finance' | 'hr' | 'transport' | 'inventory' | 'custom'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'executive', label: 'Executive MIS' },
  { key: 'students', label: 'Students' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'finance', label: 'Fees & Finance' },
  { key: 'hr', label: 'HR & Workforce' },
  { key: 'transport', label: 'Transport' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'custom', label: 'Custom Builder' },
]

export default function ReportsClient() {
  const [tab, setTab] = useState<TabKey>('executive')
  const [kpis, setKpis] = useState<any[]>([])
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const toast = useToast()

  // Global filters
  const [selectedBranch, setSelectedBranch] = useState('')
  const [search, setSearch] = useState('')

  // Custom Report Builder state
  const [customSources] = useState([
    { id: 'STUDENTS', label: 'Students Directory', fields: ['admissionNumber', 'firstName', 'lastName', 'programType', 'status'] },
    { id: 'INVOICES', label: 'Fee Invoices', fields: ['invoiceNumber', 'totalAmountCents', 'paidAmountCents', 'balanceCents', 'status'] },
    { id: 'ATTENDANCE', label: 'Student Attendance', fields: ['date', 'status', 'arrivalTime', 'notes'] },
    { id: 'STAFF', label: 'Staff & Workforce', fields: ['employeeCode', 'designation', 'department', 'employmentType'] },
    { id: 'TRANSPORT', label: 'Transport Routes', fields: ['code', 'name', 'status'] },
    { id: 'INVENTORY', label: 'Inventory Stock', fields: ['code', 'name', 'unitPriceCents', 'isConsumable'] },
  ])
  const [customSource, setCustomSource] = useState('STUDENTS')
  const [customReportName, setCustomReportName] = useState('')
  const [selectedFields, setSelectedFields] = useState<string[]>(['admissionNumber', 'firstName', 'lastName', 'status'])
  const [previewRows, setPreviewRows] = useState<any[]>([])
  const [previewColumns, setPreviewColumns] = useState<any[]>([])
  const [savedReports, setSavedReports] = useState<any[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load Executive KPIs
  const loadKpis = useCallback(async () => {
    try {
      setLoadingKpis(true)
      const res = await fetch('/api/v1/reports/dashboard').then((r) => r.json())
      if (res.success) {
        setKpis(res.kpis || [])
      }
    } catch {
      toast.error('Failed to load dashboard KPIs')
    } finally {
      setLoadingKpis(false)
    }
  }, [toast])

  // Load Report Data by Tab
  const loadReport = useCallback(async (reportId: string) => {
    try {
      setLoadingReport(true)
      const res = await fetch('/api/v1/reports/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          options: { page: 1, pageSize: 50 },
        }),
      }).then((r) => r.json())

      if (res.success) {
        setReportData(res.report)
      } else {
        toast.error(res.error || 'Failed to load report')
      }
    } catch {
      toast.error('Failed to execute report query')
    } finally {
      setLoadingReport(false)
    }
  }, [toast])

  // Load Saved Custom Reports
  const loadSavedReports = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/reports/custom').then((r) => r.json())
      if (res.success) {
        setSavedReports(res.reports || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  useEffect(() => {
    if (tab === 'executive') {
      loadKpis()
    } else if (tab === 'students') {
      loadReport('students-strength')
    } else if (tab === 'attendance') {
      loadReport('attendance-daily')
    } else if (tab === 'finance') {
      loadReport('finance-outstanding')
    } else if (tab === 'hr') {
      loadReport('hr-headcount')
    } else if (tab === 'transport') {
      loadReport('transport-utilization')
    } else if (tab === 'inventory') {
      loadReport('inventory-valuation')
    } else if (tab === 'custom') {
      loadSavedReports()
    }
  }, [tab, loadKpis, loadReport, loadSavedReports])

  // Export Trigger
  const handleExport = async (format: 'CSV' | 'XLSX' | 'PRINT') => {
    const reportIdMap: Record<TabKey, string> = {
      executive: 'students-strength',
      students: 'students-strength',
      attendance: 'attendance-daily',
      finance: 'finance-outstanding',
      hr: 'hr-headcount',
      transport: 'transport-utilization',
      inventory: 'inventory-valuation',
      custom: 'students-strength',
    }

    const activeReportId = reportIdMap[tab]
    try {
      setExporting(true)
      const res = await fetch('/api/v1/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: activeReportId,
          format,
        }),
      })

      if (!res.ok) {
        throw new Error('Export failed')
      }

      if (format === 'PRINT') {
        const html = await res.text()
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(html)
          win.document.close()
        }
      } else {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeReportId}_export.${format === 'XLSX' ? 'xls' : 'csv'}`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      toast.success(`Exported ${format} successfully`)
    } catch {
      toast.error('Failed to download report export')
    } finally {
      setExporting(false)
    }
  }

  // Custom Preview Trigger
  const handlePreviewCustom = async () => {
    try {
      setPreviewLoading(true)
      const res = await fetch('/api/v1/reports/custom/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: customSource,
          fields: selectedFields,
          filters: [],
        }),
      }).then((r) => r.json())

      if (res.success) {
        setPreviewRows(res.preview.previewRows || [])
        setPreviewColumns(res.preview.columns || [])
        toast.success(`Generated preview (${res.preview.totalPreview} rows)`)
      } else {
        toast.error(res.error || 'Failed to preview')
      }
    } catch {
      toast.error('Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Save Custom Report
  const handleSaveCustom = async () => {
    if (!customReportName.trim()) {
      toast.error('Please enter a report name')
      return
    }

    try {
      const res = await fetch('/api/v1/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customReportName,
          source: customSource,
          fields: selectedFields,
          filters: [],
        }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Custom report saved successfully')
        setCustomReportName('')
        loadSavedReports()
      } else {
        toast.error(res.error || 'Failed to save custom report')
      }
    } catch {
      toast.error('Error saving custom report')
    }
  }

  const columns: Column<any>[] = React.useMemo(() => {
    if (!reportData?.columns) return []
    return reportData.columns.map((c: any) => ({
      key: c.key,
      header: c.label,
      align: c.align || 'left',
      render: (row: any) => {
        const val = row[c.key]
        if (c.type === 'ENUM') {
          return <StatusBadge status={String(val || '')} />
        }
        return <span>{val ?? '—'}</span>
      },
    }))
  }, [reportData])

  return (
    <div className="page-container">
      <PageHead
        title="Reports & Analytics"
        sub="Cross-module intelligence, operational reporting, and custom report builder"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => handleExport('CSV')}
              disabled={exporting}
              title="Download CSV"
            >
              <Download size={14} style={{ marginRight: 6 }} /> CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => handleExport('XLSX')}
              disabled={exporting}
              title="Download Excel"
            >
              <FileSpreadsheet size={14} style={{ marginRight: 6 }} /> Excel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleExport('PRINT')}
              disabled={exporting}
              title="Print / PDF View"
            >
              <Printer size={14} style={{ marginRight: 6 }} /> Print / PDF
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <Segmented
          options={TABS}
          value={tab}
          onChange={(k) => setTab(k as TabKey)}
        />
      </div>

      {/* TAB 1: EXECUTIVE MIS */}
      {tab === 'executive' && (
        <div>
          {loadingKpis ? (
            <div className="metric-strip mb-6">
              <div className="metric-cell" style={{ padding: 20 }}>Loading executive KPIs...</div>
            </div>
          ) : kpis.length > 0 ? (
            <div className="metric-strip mb-6">
              {kpis.map((kpi) => (
                <div key={kpi.key} className="metric-cell">
                  <div className="metric-cell-label">{kpi.label}</div>
                  <div className="metric-cell-value">
                    {kpi.value}
                    {kpi.unit && <span className="metric-cell-sub"> {kpi.unit}</span>}
                  </div>
                  <div className="metric-cell-meta">Domain: {kpi.domain}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card mb-6">
              <EmptyState
                icon={<BarChart3 size={32} />}
                title="No KPIs Available"
                message="No activity records found for current tenant scope."
              />
            </div>
          )}

          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              Core School Summary & Lineage Tracking
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              All metrics above are calculated in real-time by querying authoritative domain models (
              <code>Student</code>, <code>Attendance</code>, <code>Invoice</code>, <code>StaffProfile</code>,{' '}
              <code>TransportRoute</code>, <code>InventoryStock</code>) directly without duplicating transactional records.
            </p>
          </div>
        </div>
      )}

      {/* TABS 2-7: DOMAIN REPORT DATA TABLES */}
      {tab !== 'executive' && tab !== 'custom' && (
        <div className="table-workspace">
          <div className="table-workspace-header">
            <div>
              <div className="table-workspace-title">
                {reportData?.title || 'Report Records'}
              </div>
              <div className="table-workspace-meta">
                Freshness: {reportData?.freshness || 'REAL_TIME'} · Total records: {reportData?.total ?? 0}
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (tab === 'students') loadReport('students-strength')
                if (tab === 'attendance') loadReport('attendance-daily')
                if (tab === 'finance') loadReport('finance-outstanding')
                if (tab === 'hr') loadReport('hr-headcount')
                if (tab === 'transport') loadReport('transport-utilization')
                if (tab === 'inventory') loadReport('inventory-valuation')
              }}
            >
              <RefreshCw size={13} style={{ marginRight: 4 }} /> Refresh
            </button>
          </div>

          <DataTable
            columns={columns}
            data={reportData?.data || []}
            loading={loadingReport}
            emptyIcon="reports"
            emptyTitle="No report records available"
            emptyMessage="No operational records matched the selected date range and filter criteria. Try widening your date range or adjusting filters."
          />
        </div>
      )}

      {/* TAB 8: CUSTOM REPORT BUILDER */}
      {tab === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Builder Controls */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
              Build Custom Report (FR-049)
            </h3>

            <Field label="1. Select Canonical Source">
              <select
                className="input"
                value={customSource}
                onChange={(e) => {
                  setCustomSource(e.target.value)
                  const src = customSources.find((s) => s.id === e.target.value)
                  if (src) setSelectedFields(src.fields.slice(0, 4))
                }}
              >
                {customSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>
                2. Select Projected Fields
              </label>
              {customSources
                .find((s) => s.id === customSource)
                ?.fields.map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      id={`f-${f}`}
                      checked={selectedFields.includes(f)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFields([...selectedFields, f])
                        } else {
                          setSelectedFields(selectedFields.filter((x) => x !== f))
                        }
                      }}
                    />
                    <label htmlFor={`f-${f}`} style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
                      {f}
                    </label>
                  </div>
                ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <Field label="3. Report Template Name">
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Active Student Roster"
                  value={customReportName}
                  onChange={(e) => setCustomReportName(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn btn-outline"
                onClick={handlePreviewCustom}
                disabled={previewLoading || selectedFields.length === 0}
              >
                <Eye size={14} style={{ marginRight: 6 }} /> Preview 10 Rows
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveCustom}
                disabled={!customReportName.trim() || selectedFields.length === 0}
              >
                <Plus size={14} style={{ marginRight: 6 }} /> Save Custom Report
              </button>
            </div>
          </div>

          {/* Preview & Saved Reports */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Live Preview Panel */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Live Preview (Max 10 Rows)
                </h4>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Source: <strong>{customSource}</strong>
                </span>
              </div>

              {previewRows.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {previewColumns.map((col) => (
                          <th key={col.key} style={{ padding: '8px 12px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx}>
                          {previewColumns.map((col) => (
                            <td key={col.key} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                              {String(row[col.key] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Click "Preview 10 Rows" to execute a live projection query.
                </div>
              )}
            </div>

            {/* Saved Custom Reports */}
            <div className="card">
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                Saved Custom Reports ({savedReports.length})
              </h4>
              {savedReports.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {savedReports.map((sr) => (
                    <div
                      key={sr.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: 'var(--surface-subtle)',
                        borderRadius: 6,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{sr.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Source: {sr.source} | Created by: {sr.createdByName}
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={async () => {
                          await fetch(`/api/v1/reports/custom/${sr.id}`, { method: 'DELETE' })
                          toast.success('Report deleted')
                          loadSavedReports()
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No saved custom report templates created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
