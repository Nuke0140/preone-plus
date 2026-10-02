/**
 * PreOne — Reports & Analytics Module Types
 *
 * Types for CQRS read-model, Report Registry, KPI calculations,
 * Custom Report Builder, and Multi-format Exports.
 */

export type ReportDomain =
  | 'EXECUTIVE'
  | 'ADMISSIONS'
  | 'STUDENTS'
  | 'ATTENDANCE'
  | 'OPERATIONS'
  | 'ACADEMICS'
  | 'FINANCE'
  | 'HR'
  | 'TRANSPORT'
  | 'INVENTORY'
  | 'ADMINISTRATION'
  | 'COMPLIANCE'

export type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'BETWEEN'
  | 'IN'

export type FieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'CURRENCY' | 'ENUM' | 'PERCENTAGE'

export type FreshnessType = 'REAL_TIME' | 'NEAR_REAL_TIME' | 'PERIODIC' | 'HISTORICAL'

export type ExportFormat = 'CSV' | 'XLSX' | 'PDF' | 'PRINT'

export interface ScopeContext {
  tenantId: string
  branchId?: string | null
  academicSessionId?: string | null
  actorId: string
  actorName: string
  actorRole: string
  roles: string[]
}

export interface ReportColumn {
  key: string
  label: string
  type: FieldType
  sortable?: boolean
  filterable?: boolean
  align?: 'left' | 'center' | 'right'
  format?: string
}

export interface FilterClause {
  field: string
  operator: FilterOperator
  value: any
}

export interface SortClause {
  field: string
  order: 'asc' | 'desc'
}

export interface QueryOptions {
  page?: number
  pageSize?: number
  filters?: FilterClause[]
  sort?: SortClause
  groupBy?: string
  startDate?: string
  endDate?: string
  branchId?: string | null
  academicSessionId?: string | null
  classroomId?: string | null
  studentId?: string | null
}

export interface ReportDefinition {
  id: string
  title: string
  description: string
  domain: ReportDomain
  canonicalSource: string
  requiredPermission: string
  allowedRoles: string[]
  supportsClassroomScope?: boolean
  supportsParentScope?: boolean
  freshness: FreshnessType
  columns: ReportColumn[]
  defaultSort?: SortClause
  availableFilters: string[]
  drilldownTarget?: string
}

export interface KPIResult {
  key: string
  label: string
  value: number | string
  unit?: string
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  domain: ReportDomain
  drilldownReportId?: string
  freshness: FreshnessType
}

export interface ReportResult<T = any> {
  reportId: string
  title: string
  domain: ReportDomain
  freshness: FreshnessType
  total: number
  page: number
  pageSize: number
  totalPages: number
  summary?: Record<string, any>
  columns: ReportColumn[]
  data: T[]
}

export interface CustomReportPayload {
  name: string
  description?: string
  module: string
  source: string
  fields: string[]
  filters: FilterClause[]
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  groupBy?: string
  isPublic?: boolean
}

export interface DrilldownQuery {
  metricKey: string
  bucketKey?: string
  filters?: FilterClause[]
}
