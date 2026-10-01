/**
 * PreOne Authoritative Audit System
 * Centralized re-export from @/lib/audit/audit-service for 100% backward compatibility.
 */
export {
  AuditService,
  recordAudit,
  audit,
  getRequestMeta,
  computeDiff,
  redactSensitive,
  deriveSeverity,
  type AuditEntry,
  type AuditSeverity,
  type AuditModule,
} from './audit/audit-service'
