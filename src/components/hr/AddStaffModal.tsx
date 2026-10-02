'use client'

import React, { useState } from 'react'
import { Users, Plus } from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { Field } from '@/components/preone/ui'
import type { BranchOption } from './types'

interface AddStaffModalProps {
  open: boolean
  onClose: () => void
  branches: BranchOption[]
  onSubmit: (formData: any) => Promise<void>
  loading?: boolean
}

export function AddStaffModal({
  open,
  onClose,
  branches,
  onSubmit,
  loading,
}: AddStaffModalProps) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'TEACHER',
    employeeCode: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    designation: 'Montessori Educator',
    department: 'Academics',
    qualification: 'ECCE Diploma',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: 'REGULAR',
    branchId: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    basicSalary: 22000,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Onboard Preschool Staff"
      subtitle="Create employee record, system login, and initial salary structure"
      icon={<Users size={18} />}
      wide
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !form.fullName || !form.email || !form.employeeCode}
            onClick={handleSubmit}
          >
            {loading ? 'Onboarding...' : 'Complete Onboarding'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Section 1: Basic Identity */}
        <div>
          <h4 className="font-semibold text-foreground border-b border-border/60 pb-1 mb-2.5">
            1. Identity & System Login
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Full Name" required>
              <input
                className="input text-xs w-full"
                placeholder="e.g. Priya Sharma"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </Field>
            <Field label="Work Email" required>
              <input
                type="email"
                className="input text-xs w-full"
                placeholder="priya@preschool.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Phone Number">
              <input
                className="input text-xs w-full"
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {/* Section 2: Role & Employment */}
        <div>
          <h4 className="font-semibold text-foreground border-b border-border/60 pb-1 mb-2.5">
            2. Preschool Employment Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Employee Code" required>
              <input
                className="input text-xs w-full font-mono font-medium"
                value={form.employeeCode}
                onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                required
              />
            </Field>
            <Field label="Role" required>
              <select
                className="select text-xs w-full"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="TEACHER">Teacher</option>
                <option value="STAFF">Staff / Operations</option>
                <option value="ACCOUNTS">Accounts & Billing</option>
                <option value="RECEPTIONIST">Front Desk / Receptionist</option>
                <option value="ATTENDANT">Attendant / Caregiver</option>
                <option value="DRIVER">Driver</option>
                <option value="COORDINATOR">Academic Coordinator</option>
                <option value="PRINCIPAL">Principal / Head</option>
              </select>
            </Field>
            <Field label="Campus / Branch">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
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
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="Transport">Transport</option>
              </select>
            </Field>
            <Field label="Qualification">
              <input
                className="input text-xs w-full"
                placeholder="e.g. ECCE / Montessori Diploma"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {/* Section 3: Salary & Joining */}
        <div>
          <h4 className="font-semibold text-foreground border-b border-border/60 pb-1 mb-2.5">
            3. Joining Date & Basic Salary
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date of Joining" required>
              <input
                type="date"
                className="input text-xs w-full"
                value={form.joiningDate}
                onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
              />
            </Field>
            <Field label="Monthly Basic Salary (₹)" required>
              <input
                type="number"
                className="input text-xs w-full font-mono"
                value={form.basicSalary}
                onChange={(e) => setForm({ ...form, basicSalary: parseFloat(e.target.value) || 0 })}
              />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  )
}
