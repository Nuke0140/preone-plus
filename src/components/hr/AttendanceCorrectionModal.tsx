'use client'

import React, { useEffect, useState } from 'react'
import { Edit3, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { Field } from '@/components/preone/ui'
import type { AttendanceRecord } from './types'

interface AttendanceCorrectionModalProps {
  open: boolean
  onClose: () => void
  record: AttendanceRecord | null
  date: string
  onSave: (payload: {
    staffProfileId: string
    date: string
    status: string
    checkIn?: string
    checkOut?: string
    reason: string
  }) => Promise<void>
  loading?: boolean
}

export function AttendanceCorrectionModal({
  open,
  onClose,
  record,
  date,
  onSave,
  loading,
}: AttendanceCorrectionModalProps) {
  const [form, setForm] = useState({
    status: 'PRESENT',
    checkIn: '08:30',
    checkOut: '15:30',
    reason: 'Biometric missed punch / on-duty classroom observation',
  })

  useEffect(() => {
    if (record) {
      const getHourMin = (iso?: string | null) => {
        if (!iso) return ''
        const d = new Date(iso)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }

      setForm({
        status: record.status === 'UNMARKED' ? 'PRESENT' : record.status,
        checkIn: getHourMin(record.checkIn) || '08:30',
        checkOut: getHourMin(record.checkOut) || '15:30',
        reason: record.notes || 'Biometric missed punch verification',
      })
    }
  }, [record])

  if (!record) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.reason.trim()) return

    // Construct full ISO datetime for checkIn/checkOut
    const checkInIso = form.checkIn ? `${date}T${form.checkIn}:00.000Z` : undefined
    const checkOutIso = form.checkOut ? `${date}T${form.checkOut}:00.000Z` : undefined

    await onSave({
      staffProfileId: record.staffProfileId,
      date,
      status: form.status,
      checkIn: checkInIso,
      checkOut: checkOutIso,
      reason: form.reason.trim(),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Correct Attendance — ${record.name}`}
      subtitle={`Adjusting attendance punch on ${new Date(date).toLocaleDateString('en-IN')}`}
      icon={<Edit3 size={18} />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !form.reason.trim()}
            onClick={handleSubmit}
          >
            {loading ? 'Recording...' : 'Save Audit Correction'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 rounded-lg bg-info/10 border border-info/30 flex items-start gap-2 text-info-foreground">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-info" />
          <span>
            Every attendance correction is permanently preserved in the immutable PreOne Audit Log with your user ID and timestamp.
          </span>
        </div>

        <Field label="Attendance Status" required>
          <select
            className="select text-xs w-full"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="PRESENT">Present</option>
            <option value="LATE">Late Arrival</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="ABSENT">Absent</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-In Time">
            <input
              type="time"
              className="input text-xs w-full font-mono"
              value={form.checkIn}
              onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
            />
          </Field>
          <Field label="Check-Out Time">
            <input
              type="time"
              className="input text-xs w-full font-mono"
              value={form.checkOut}
              onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Mandatory Audit Reason" required helper="Explain why this correction is being recorded">
          <textarea
            className="input text-xs w-full min-h-[70px]"
            rows={2}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="e.g. Card reader offline in morning; verified physical presence in Montessori Class 1"
            required
          />
        </Field>
      </form>
    </Modal>
  )
}
