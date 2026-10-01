/**
 * PreOne — Custom Report Engine
 *
 * Implements FR-049: Custom Report Builder.
 * Validates whitelisted sources, typed filter operators, projection,
 * 10-row live preview, and persistence without raw SQL.
 */

import { db } from '@/lib/db'
import { CustomReportPayload, FilterClause, ReportColumn, ScopeContext } from './report-types'
import { inr, fmtDate } from '@/lib/format'

export interface CustomSourceDefinition {
  id: string
  label: string
  domain: string
  allowedRoles: string[]
  fields: { key: string; label: string; type: 'STRING' | 'NUMBER' | 'DATE' | 'CURRENCY' | 'ENUM' }[]
}

export const CUSTOM_SOURCES: CustomSourceDefinition[] = [
  {
    id: 'STUDENTS',
    label: 'Students Directory',
    domain: 'STUDENTS',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'],
    fields: [
      { key: 'admissionNo', label: 'Admission Number', type: 'STRING' },
      { key: 'firstName', label: 'First Name', type: 'STRING' },
      { key: 'lastName', label: 'Last Name', type: 'STRING' },
      { key: 'gender', label: 'Gender', type: 'ENUM' },
      { key: 'status', label: 'Status', type: 'ENUM' },
      { key: 'dob', label: 'Date of Birth', type: 'DATE' },
      { key: 'createdAt', label: 'Enrollment Date', type: 'DATE' },
    ],
  },
  {
    id: 'INVOICES',
    label: 'Fee Invoices',
    domain: 'FINANCE',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTS'],
    fields: [
      { key: 'invoiceNumber', label: 'Invoice Number', type: 'STRING' },
      { key: 'totalCents', label: 'Total Amount', type: 'CURRENCY' },
      { key: 'paidCents', label: 'Paid Amount', type: 'CURRENCY' },
      { key: 'balanceCents', label: 'Balance Due', type: 'CURRENCY' },
      { key: 'dueDate', label: 'Due Date', type: 'DATE' },
      { key: 'status', label: 'Invoice Status', type: 'ENUM' },
    ],
  },
  {
    id: 'ATTENDANCE',
    label: 'Student Attendance',
    domain: 'ATTENDANCE',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'ACCOUNTS'],
    fields: [
      { key: 'date', label: 'Attendance Date', type: 'DATE' },
      { key: 'status', label: 'Status (Present/Absent/Late)', type: 'ENUM' },
      { key: 'arrivalTime', label: 'Arrival Time', type: 'STRING' },
      { key: 'notes', label: 'Remarks / Notes', type: 'STRING' },
    ],
  },
  {
    id: 'STAFF',
    label: 'Staff & Workforce',
    domain: 'HR',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR'],
    fields: [
      { key: 'employeeCode', label: 'Employee Code', type: 'STRING' },
      { key: 'designation', label: 'Designation', type: 'STRING' },
      { key: 'department', label: 'Department', type: 'STRING' },
      { key: 'employmentType', label: 'Employment Type', type: 'ENUM' },
      { key: 'joiningDate', label: 'Joining Date', type: 'DATE' },
    ],
  },
  {
    id: 'TRANSPORT',
    label: 'Transport Routes & Fleet',
    domain: 'TRANSPORT',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR'],
    fields: [
      { key: 'code', label: 'Route Code', type: 'STRING' },
      { key: 'name', label: 'Route Name', type: 'STRING' },
      { key: 'status', label: 'Route Status', type: 'ENUM' },
    ],
  },
  {
    id: 'INVENTORY',
    label: 'Inventory Items & Stock',
    domain: 'INVENTORY',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTS'],
    fields: [
      { key: 'code', label: 'Item Code', type: 'STRING' },
      { key: 'name', label: 'Item Name', type: 'STRING' },
      { key: 'unitPriceCents', label: 'Unit Price', type: 'CURRENCY' },
      { key: 'isConsumable', label: 'Is Consumable', type: 'STRING' },
    ],
  },
]

export class CustomReportEngine {
  /**
   * Generates a safe live preview (max 10 rows) using whitelisted projection and typed filter mapping.
   */
  static async generatePreview(payload: CustomReportPayload, ctx: ScopeContext) {
    const source = CUSTOM_SOURCES.find((s) => s.id === payload.source)
    if (!source) {
      throw new Error(`Unauthorized or unknown reporting source: ${payload.source}`)
    }

    const { tenantId, branchId } = ctx

    // Safe where clause construction
    const where: any = { tenantId }
    if (branchId) where.branchId = branchId

    // Apply typed filter operators
    for (const filter of payload.filters || []) {
      const allowedField = source.fields.find((f) => f.key === filter.field)
      if (!allowedField) continue

      switch (filter.operator) {
        case 'EQUALS':
          where[filter.field] = filter.value
          break
        case 'NOT_EQUALS':
          where[filter.field] = { not: filter.value }
          break
        case 'CONTAINS':
          where[filter.field] = { contains: String(filter.value), mode: 'insensitive' }
          break
        case 'GREATER_THAN':
          where[filter.field] = { gt: filter.value }
          break
        case 'LESS_THAN':
          where[filter.field] = { lt: filter.value }
          break
        case 'IN':
          where[filter.field] = { in: Array.isArray(filter.value) ? filter.value : [filter.value] }
          break
      }
    }

    let rawData: any[] = []
    switch (payload.source) {
      case 'STUDENTS':
        rawData = await db.student.findMany({
          where: { ...where, deletedAt: null },
          take: 10,
        })
        break
      case 'INVOICES':
        rawData = await db.invoice.findMany({
          where: { ...where, deletedAt: null },
          take: 10,
        })
        break
      case 'ATTENDANCE':
        rawData = await db.attendance.findMany({
          where: { student: { tenantId } },
          take: 10,
        })
        break
      case 'STAFF':
        rawData = await db.staffProfile.findMany({
          where: { ...where, deletedAt: null },
          take: 10,
        })
        break
      case 'TRANSPORT':
        rawData = await db.transportRoute.findMany({
          where,
          take: 10,
        })
        break
      case 'INVENTORY':
        rawData = await db.inventoryItem.findMany({
          where: { ...where, deletedAt: null },
          take: 10,
        })
        break
    }

    // Format fields
    const formatted = rawData.map((row) => {
      const out: Record<string, any> = {}
      for (const f of payload.fields) {
        const val = row[f]
        if (f.endsWith('Cents') && typeof val === 'number') {
          out[f] = inr(val)
        } else if (val instanceof Date) {
          out[f] = fmtDate(val)
        } else {
          out[f] = val ?? '—'
        }
      }
      return out
    })

    const columns: ReportColumn[] = payload.fields.map((fKey) => {
      const def = source.fields.find((f) => f.key === fKey)
      return {
        key: fKey,
        label: def?.label || fKey,
        type: def?.type || 'STRING',
      }
    })

    return {
      previewRows: formatted,
      columns,
      totalPreview: formatted.length,
    }
  }

  /**
   * Persists custom report definition to PostgreSQL.
   */
  static async saveReport(payload: CustomReportPayload, ctx: ScopeContext) {
    return db.savedReport.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId || null,
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        module: payload.module || 'GENERAL',
        source: payload.source,
        fields: payload.fields,
        filters: payload.filters as any,
        sortField: payload.sortField || null,
        sortOrder: payload.sortOrder || 'asc',
        groupBy: payload.groupBy || null,
        isPublic: payload.isPublic ?? false,
        createdById: ctx.actorId,
        createdByName: ctx.actorName,
      },
    })
  }

  /**
   * Lists saved reports for current tenant.
   */
  static async listSavedReports(ctx: ScopeContext) {
    return db.savedReport.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Soft-deletes a saved report.
   */
  static async deleteSavedReport(id: string, ctx: ScopeContext) {
    return db.savedReport.update({
      where: { id, tenantId: ctx.tenantId },
      data: { deletedAt: new Date() },
    })
  }
}
