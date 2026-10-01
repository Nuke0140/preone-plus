'use client'

import React, { useState } from 'react'
import {
  Upload, FileSpreadsheet, Download, AlertTriangle, AlertCircle,
  CheckCircle2, RefreshCw, ChevronRight, X, Check, FileCheck, HelpCircle
} from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { CsvUploadIllustration } from '@/components/preone'

interface CsvImportModalProps {
  open: boolean
  onClose: () => void
  type: 'STAFF' | 'FAMILY'
  onSuccess: () => void
}

export function CsvImportModal({ open, onClose, type, onSuccess }: CsvImportModalProps) {
  const toast = useToast()

  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW' | 'RESULT'>('UPLOAD')
  const [inputMode, setInputMode] = useState<'FILE' | 'PASTE'>('FILE')
  const [isDragging, setIsDragging] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState('')
  const [validating, setValidating] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    loadCsvFile(file)
  }

  const loadCsvFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Invalid File Type', 'Please choose a standard .csv spreadsheet file')
      return
    }
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text || '')
    }
    reader.readAsText(file)
  }

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    loadCsvFile(file)
  }

  const handleDownloadTemplate = (templateName: string) => {
    window.location.href = `/api/v1/users/csv?template=${templateName}`
  }

  const handleValidate = async () => {
    if (!csvText.trim()) {
      toast.error('CSV Empty', 'Please select a CSV file or paste CSV content')
      return
    }

    setValidating(true)
    try {
      const res = await fetch('/api/v1/users/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          type,
          csv: csvText,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Validation failed')
      }

      setPreviewData(json.data)
      setStep('PREVIEW')
    } catch (err: any) {
      toast.error('Validation Error', err.message || 'Could not parse CSV')
    } finally {
      setValidating(false)
    }
  }

  const handleExecute = async () => {
    if (!previewData || !previewData.rows) return

    setExecuting(true)
    try {
      const res = await fetch('/api/v1/users/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          type,
          previewRows: previewData.rows,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Import execution failed')
      }

      setImportResult(json.data)
      setStep('RESULT')
      toast.success(
        'CSV Import Completed',
        `Processed ${json.data.total} records.`
      )
      onSuccess()
    } catch (err: any) {
      toast.error('Import Failed', err.message || 'An error occurred during import')
    } finally {
      setExecuting(false)
    }
  }

  const resetModal = () => {
    setStep('UPLOAD')
    setInputMode('FILE')
    setCsvFile(null)
    setCsvText('')
    setPreviewData(null)
    setImportResult(null)
    setIsDragging(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={type === 'STAFF' ? 'Bulk Import Staff Users (CSV)' : 'Bulk Import Family Users (CSV)'}
      icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
      iconClass="ic-green"
      wide
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {step === 'PREVIEW' && (
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setStep('UPLOAD')}
                disabled={executing}
              >
                ← Back to Upload
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'RESULT' && (
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={handleClose}
                disabled={validating || executing}
              >
                Cancel
              </button>
            )}

            {step === 'UPLOAD' && (
              <button
                type="button"
                className="btn btn-primary text-xs flex items-center gap-1.5 font-semibold"
                onClick={handleValidate}
                disabled={validating || !csvText.trim()}
              >
                {validating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating CSV...</span>
                  </>
                ) : (
                  <span>Validate & Preview Rows →</span>
                )}
              </button>
            )}

            {step === 'PREVIEW' && previewData && (
              <button
                type="button"
                className="btn btn-primary text-xs flex items-center gap-1.5 font-semibold"
                onClick={handleExecute}
                disabled={executing || previewData.validRows + previewData.warningRows === 0}
              >
                {executing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Import...</span>
                  </>
                ) : (
                  <span>
                    Execute Import ({previewData.validRows + previewData.warningRows} Ready Rows)
                  </span>
                )}
              </button>
            )}

            {step === 'RESULT' && (
              <button
                type="button"
                className="btn btn-primary text-xs font-semibold"
                onClick={handleClose}
              >
                Done & View Workspace
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* STEP 1: Upload Workspace */}
        {step === 'UPLOAD' && (
          <div className="space-y-3.5">
            {/* Input Mode Toggle (File Upload vs Direct Paste) + Quick Template Download */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="seg text-xs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === 'FILE'}
                  onClick={() => setInputMode('FILE')}
                  className={`flex items-center gap-1.5 ${inputMode === 'FILE' ? 'on' : ''}`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>File Upload</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === 'PASTE'}
                  onClick={() => setInputMode('PASTE')}
                  className={`flex items-center gap-1.5 ${inputMode === 'PASTE' ? 'on' : ''}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Paste Raw CSV</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {type === 'STAFF' ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('staff')}
                    className="btn btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
                    title="Download clean staff CSV template"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-600" />
                    <span>Download Staff Template</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('family')}
                    className="btn btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
                    title="Download clean family CSV template"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-600" />
                    <span>Download Family Template</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mode 1: Drag & Drop File Upload */}
            {inputMode === 'FILE' && (
              <>
                {!csvFile ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all ${
                      isDragging
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/30 ring-2 ring-purple-200'
                        : 'border-[var(--border-default)] hover:border-purple-400 bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <CsvUploadIllustration size={80} className="mx-auto mb-2.5" />
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">
                      Select or Drop your {type === 'STAFF' ? 'Staff' : 'Family'} CSV File
                    </h4>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <label className="btn btn-primary text-xs cursor-pointer inline-flex items-center gap-1.5 font-semibold py-2 px-4 shadow-xs">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Browse CSV File</span>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {csvFile.name}
                        </div>
                        <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2 mt-0.5">
                          <span>{(csvFile.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>Ready for validation</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="btn btn-secondary text-xs cursor-pointer">
                        <span>Replace File</span>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCsvFile(null)
                          setCsvText('')
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Mode 2: Paste Raw CSV */}
            {inputMode === 'PASTE' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Direct CSV Text Content
                  </label>
                  {csvText && (
                    <button
                      type="button"
                      onClick={() => setCsvText('')}
                      className="text-[11px] text-gray-400 hover:text-red-600"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value)
                    if (csvFile) setCsvFile(null)
                  }}
                  placeholder={
                    type === 'STAFF'
                      ? 'username,fullName,email,phone,role,branchCode,employeeCode,designation\npriya.sharma,Priya Sharma,priya@preschool.com,+919876543210,TEACHER,MAIN,EMP-101,Lead Guide'
                      : 'fullName,email,phone,role,relationship,studentAdmissionNo,isPrimaryPayer,canPickup,pickupPin\nRajesh Kumar,rajesh@gmail.com,+919876543210,PARENT,Father,ADM-2026-001,true,true,1234'
                  }
                  className="input w-full font-mono text-xs p-3 leading-relaxed"
                  style={{ minHeight: 140 }}
                />
              </div>
            )}

            {/* Schema Guide & Column Reference */}
            <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1.5">
                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>Expected Schema Columns</span>
                  <span className="text-[11px] text-gray-400 font-normal">(* required)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {type === 'STAFF' ? (
                    <>
                      <span className="badge b-primary text-[11px] font-mono">fullName *</span>
                      <span className="badge b-primary text-[11px] font-mono">email *</span>
                      <span className="badge b-primary text-[11px] font-mono">role *</span>
                      <span className="badge b-neutral text-[11px] font-mono">username</span>
                      <span className="badge b-neutral text-[11px] font-mono">phone</span>
                      <span className="badge b-neutral text-[11px] font-mono">branchCode</span>
                      <span className="badge b-neutral text-[11px] font-mono">employeeCode</span>
                      <span className="badge b-neutral text-[11px] font-mono">designation</span>
                    </>
                  ) : (
                    <>
                      <span className="badge b-primary text-[11px] font-mono">fullName *</span>
                      <span className="badge b-primary text-[11px] font-mono">role *</span>
                      <span className="badge b-primary text-[11px] font-mono">studentAdmissionNo *</span>
                      <span className="badge b-neutral text-[11px] font-mono">email</span>
                      <span className="badge b-neutral text-[11px] font-mono">phone</span>
                      <span className="badge b-neutral text-[11px] font-mono">relationship</span>
                      <span className="badge b-neutral text-[11px] font-mono">isPrimaryPayer</span>
                      <span className="badge b-neutral text-[11px] font-mono">canPickup</span>
                      <span className="badge b-neutral text-[11px] font-mono">pickupPin</span>
                    </>
                  )}
                </div>
              </div>

              {type === 'STAFF' && (
                <div className="shrink-0">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Roles: TEACHER, STAFF, ACCOUNTS, RECEPTIONIST, DRIVER, ATTENDANT, PRINCIPAL, COORDINATOR
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Preview & Validation Table */}
        {step === 'PREVIEW' && previewData && (
          <div className="space-y-4">
            {/* KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-[11px] text-gray-500 uppercase font-semibold">Total Rows</span>
                <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{previewData.totalRows}</div>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Valid Rows</span>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{previewData.validRows}</div>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Warnings</span>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5">{previewData.warningRows}</div>
              </div>
              <div className="p-2.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800">
                <span className="text-[11px] text-red-600 dark:text-red-400 uppercase font-semibold">Blocked Rows</span>
                <div className="text-lg font-bold text-red-700 dark:text-red-400 mt-0.5">{previewData.blockedRows}</div>
              </div>
            </div>

            {/* Rows Table */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-2.5 w-10">#</th>
                    <th className="p-2.5 w-20">Status</th>
                    <th className="p-2.5 w-20">Action</th>
                    <th className="p-2.5">Name / Identifier</th>
                    <th className="p-2.5 w-24">Role</th>
                    <th className="p-2.5">Details</th>
                    <th className="p-2.5">Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {previewData.rows.map((r: any) => (
                    <tr
                      key={r.rowNumber}
                      className={
                        r.status === 'BLOCKED'
                          ? 'bg-red-50/40 dark:bg-red-950/20'
                          : r.status === 'WARNING'
                          ? 'bg-amber-50/30 dark:bg-amber-950/10'
                          : ''
                      }
                    >
                      <td className="p-2.5 font-mono text-gray-400">{r.rowNumber}</td>
                      <td className="p-2.5">
                        <span
                          className={`badge text-[10px] font-semibold ${
                            r.status === 'VALID'
                              ? 'b-success'
                              : r.status === 'WARNING'
                              ? 'b-warning'
                              : 'b-danger'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        {r.action}
                      </td>
                      <td className="p-2.5 font-medium text-gray-900 dark:text-gray-100">
                        {r.name}
                        <div className="text-[10px] text-gray-400 font-mono">{r.identifier}</div>
                      </td>
                      <td className="p-2.5">
                        <span className="badge b-neutral text-[10px]">{r.role}</span>
                      </td>
                      <td className="p-2.5 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {r.details}
                      </td>
                      <td className="p-2.5 text-[11px]">
                        {r.errors.length > 0 && (
                          <div className="text-red-600 dark:text-red-400 font-medium">
                            {r.errors.join('; ')}
                          </div>
                        )}
                        {r.warnings.length > 0 && (
                          <div className="text-amber-600 dark:text-amber-400">
                            {r.warnings.join('; ')}
                          </div>
                        )}
                        {r.errors.length === 0 && r.warnings.length === 0 && (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: Execution Result Report */}
        {step === 'RESULT' && importResult && (
          <div className="space-y-4 py-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                Import Processed Successfully
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Staff accounts and roles have been provisioned in the directory
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-center text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-gray-400 block font-medium">Total Rows</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{importResult.total}</span>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="block font-medium">Imported / Linked</span>
                <span className="text-lg font-bold mt-0.5">
                  {(importResult.createdCount || 0) + (importResult.linkedCount || 0) + (importResult.updatedCount || 0)}
                </span>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800">
                <span className="block font-medium">Blocked / Skipped</span>
                <span className="text-lg font-bold mt-0.5">{importResult.blockedCount || 0}</span>
              </div>
            </div>

            {importResult.errors?.length > 0 && (
              <div className="text-left max-w-lg mx-auto bg-red-50 dark:bg-red-950/30 p-3.5 rounded-xl border border-red-200 dark:border-red-800 text-xs space-y-1">
                <strong className="text-red-700 dark:text-red-400 block font-semibold">Row-level notices:</strong>
                {importResult.errors.map((e: any, idx: number) => (
                  <div key={idx} className="text-red-600 dark:text-red-400 font-mono text-[11px]">
                    Row {e.rowNumber}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
