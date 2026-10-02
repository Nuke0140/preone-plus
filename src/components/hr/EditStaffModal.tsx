'use client'

import React, { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { Field } from '@/components/preone/ui'
import type { BranchOption } from './types'

interface EditStaffModalProps {
  open: boolean
  onClose: () => void
  staff: any | null
  branches: BranchOption[]
  onSave: (payload: any) => Promise<void>
  loading?: boolean
}

export function EditStaffModal({
  open,
  onClose,
  staff,
  branches,
  onSave,
  loading,
}: EditStaffModalProps) {
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    if (staff) {
      setForm({
        id: staff.id,
        fullName: staff.name || staff.user?.fullName || '',
        phone: staff.phone || staff.user?.phone || '',
        designation: staff.designation || '',
        department: staff.department || 'Academics',
        qualification: staff.qualification || '',
        employmentType: staff.employmentType || 'REGULAR',
        branchId: staff.branchId || '',
        panNumber: staff.panNumber || '',
        aadhaarNumber: staff.aadhaarNumber || '',
        uanNumber: staff.uanNumber || '',
        basicSalary: staff.salaryStructure?.basicSalary || staff.basicSalary || 20000,
        hra: staff.salaryStructure?.hra || staff.hra || 8000,
        specialAllowance: staff.salaryStructure?.specialAllowance || staff.specialAllowance || 4000,
      })
    }
  }, [staff])

  if (!form) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Employee — ${form.fullName}`}
      subtitle="Update designation, campus assignment, and compensation structure"
      icon={<Pencil size={18} />}
      wide
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !form.fullName}
            onClick={handleSubmit}
          >
            {loading ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Full Name" required>
            <input
              className="input text-xs w-full"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              className="input text-xs w-full"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Branch / Campus">
            <select
              className="select text-xs w-full"
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              <option value="">Main Campus (Default)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Designation">
            <input
              className="input text-xs w-full"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
          </Field>
          <Field label="Department">
            <select
              className="select text-xs w-full"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              <option value="Academics">Academics</option>
              <option value="Administration">Administration</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Transport">Transport</option>
            </select>
          </Field>
          <Field label="Qualification">
            <input
              className="input text-xs w-full"
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            />
          </Field>
        </div>

        <div>
          <h4 className="font-semibold text-foreground border-b border-border/60 pb-1 mb-2.5">
            Salary Structure (Monthly Base)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Basic Salary (₹)" required>
              <input
                type="number"
                className="input text-xs w-full font-mono"
                value={form.basicSalary}
                onChange={(e) => setForm({ ...form, basicSalary: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="HRA (₹)">
              <input
                type="number"
                className="input text-xs w-full font-mono"
                value={form.hra}
                onChange={(e) => setForm({ ...form, hra: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Special Allowance (₹)">
              <input
                type="number"
                className="input text-xs w-full font-mono"
                value={form.specialAllowance}
                onChange={(e) => setForm({ ...form, specialAllowance: parseFloat(e.target.value) || 0 })}
              />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  )
}
