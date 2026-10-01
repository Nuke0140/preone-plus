/**
 * PreOne — Reports & Analytics Domain Service
 *
 * Primary coordinator wrapping Report Registry, KPI calculations,
 * Report Query execution, Custom Report Builder, and Audit Logging.
 */

import { getReportById, getReportsForRole, REPORT_REGISTRY } from './report-registry'
import { KpiEngine } from './kpi-engine'
import { ReportQueryEngine } from './report-query-engine'
import { CustomReportEngine } from './custom-report-engine'
import { ExportEngine } from './export-engine'
import {
  CustomReportPayload,
  ExportFormat,
  QueryOptions,
  ReportDefinition,
  ReportResult,
  ScopeContext,
} from './report-types'
import { AuditService } from '@/lib/audit/audit-service'

export class ReportService {
  /**
   * Retrieves registered reports accessible by current user.
   */
  static getRegistry(ctx: ScopeContext): ReportDefinition[] {
    return getReportsForRole(ctx.actorRole, ctx.roles)
  }

  /**
   * Computes executive/domain dashboard KPIs with strict role scoping.
   */
  static async getDashboardKPIs(ctx: ScopeContext) {
    return KpiEngine.getExecutiveKPIs(ctx)
  }

  /**
   * Executes standard report query.
   */
  static async queryReport(
    reportId: string,
    options: QueryOptions,
    ctx: ScopeContext
  ): Promise<ReportResult> {
    const reportDef = getReportById(reportId)
    if (!reportDef) {
      throw new Error(`Report '${reportId}' not found`)
    }

    // Role permission check
    const allowed = ctx.roles.includes('PLATFORM_ADMIN') ||
      ctx.roles.includes('OWNER') ||
      reportDef.allowedRoles.some((r) => ctx.roles.includes(r))

    if (!allowed) {
      throw new Error(`Forbidden: Role not authorized for report '${reportId}'`)
    }

    return ReportQueryEngine.executeReport(reportId, options, ctx)
  }

  /**
   * Exports report dataset with audit trail.
   */
  static async exportReport(
    reportId: string,
    format: ExportFormat,
    options: QueryOptions,
    ctx: ScopeContext
  ) {
    // 1. Fetch exact authoritative report dataset
    const result = await this.queryReport(reportId, options, ctx)

    // 2. Generate export content
    const exportResult = ExportEngine.generateExport(result, format)

    // 3. Log export event to AuditLog
    await AuditService.record({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || null,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'REPORT_EXPORTED',
      entity: 'Report',
      entityId: reportId,
      module: 'REPORTS',
      summary: `Exported report '${result.title}' in ${format} format (${result.total} records)`,
      severity: 'INFO',
    })

    return exportResult
  }

  /**
   * Generates live preview for custom report builder.
   */
  static async previewCustomReport(payload: CustomReportPayload, ctx: ScopeContext) {
    return CustomReportEngine.generatePreview(payload, ctx)
  }

  /**
   * Saves custom report.
   */
  static async saveCustomReport(payload: CustomReportPayload, ctx: ScopeContext) {
    const saved = await CustomReportEngine.saveReport(payload, ctx)

    await AuditService.record({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || null,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'SAVED_REPORT_CREATED',
      entity: 'SavedReport',
      entityId: saved.id,
      module: 'REPORTS',
      summary: `Created saved report '${saved.name}' for source '${saved.source}'`,
      severity: 'INFO',
    })

    return saved
  }

  /**
   * Lists saved custom reports.
   */
  static async listCustomReports(ctx: ScopeContext) {
    return CustomReportEngine.listSavedReports(ctx)
  }

  /**
   * Soft-deletes a saved custom report.
   */
  static async deleteCustomReport(id: string, ctx: ScopeContext) {
    const deleted = await CustomReportEngine.deleteSavedReport(id, ctx)

    await AuditService.record({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || null,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'SAVED_REPORT_DELETED',
      entity: 'SavedReport',
      entityId: id,
      module: 'REPORTS',
      summary: `Deleted saved report '${deleted.name}'`,
      severity: 'INFO',
    })

    return deleted
  }
}
