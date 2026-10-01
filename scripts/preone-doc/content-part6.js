// content-part6.js — Sections 25-28
module.exports = function build(H) {
  const { h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow } = H;
  const out = [];

  // ================= 25. STATE MACHINES =================
  out.push(h1("25. State Machines"));
  out.push(p("This section gives the explicit machine for every major entity: states, allowed actions per state, resulting states, and the transitions that are irreversible. Every transition is permission-gated per Sec. 24 and audit-logged per Sec. 22; invalid transitions return 409 with the current state in the error details."));
  out.push(h2("25.1 School (Tenant)"));
  out.push(flow([
    "DRAFT --commit--> PENDING_ACTIVATION --activate(gate pass)--> ONBOARDING --checklist done--> ACTIVE",
    "PENDING_ACTIVATION --trial path--> TRIALING --convert--> ONBOARDING ; TRIALING --expire--> ARCHIVED",
    "ACTIVE --suspend(payment/violation)--> SUSPENDED --resolve--> ACTIVE",
    "ACTIVE|SUSPENDED --offboard(30d window)--> ARCHIVED --purge(retention done)--> [IRREVERSIBLE]",
  ]));
  out.push(h2("25.2 User (Staff / Owner / Parent)"));
  out.push(flow([
    "PENDING_VERIFICATION --accept invite + set password--> ACTIVE",
    "ACTIVE --5 fails / admin--> LOCKED --cooldown/admin unlock--> ACTIVE",
    "ACTIVE --deactivate--> INACTIVE --reactivate--> ACTIVE",
    "ACTIVE|INACTIVE --delete(soft, reason)--> DELETED [no login; recoverable within window; then purge]",
    "any --password reset / role change--> sessions revoked (state unchanged)",
  ]));
  out.push(h2("25.3 Admission Lead"));
  out.push(flow([
    "NEW --first outreach--> CONTACTED --fit confirmed--> QUALIFIED --application created--> CONVERTED [terminal]",
    "NEW|CONTACTED|QUALIFIED --drip--> NURTURE --re-engage--> QUALIFIED ; --close(reason)--> LOST [terminal]",
    "any --duplicate detected--> DUPLICATE [terminal, merged pointer]  ;  LOST reason mandatory, audited",
  ]));
  out.push(h2("25.4 Application"));
  out.push(flow([
    "DRAFT --submit(lock form)--> SUBMITTED --checklist open--> DOCUMENT_PENDING",
    "DOCUMENT_PENDING --all docs VERIFIED--> DOCUMENT_VERIFIED --enter review--> UNDER_REVIEW",
    "UNDER_REVIEW --approve chain complete--> APPROVED --offer accepted--> CONVERTED [terminal -> Sec. 11]",
    "UNDER_REVIEW --reject(reason)--> REJECTED [terminal; appeal flag]",
    "UNDER_REVIEW --capacity full--> WAITLISTED --seat opens--> APPROVED ; --cycle end--> REJECTED",
    "DRAFT --withdraw/cancel--> CANCELLED [terminal] ; APPROVED --offer expired (7-15d)--> CANCELLED",
  ]));
  out.push(h2("25.5 Document (per checklist item)"));
  out.push(flow([
    "PENDING --verify--> VERIFIED [terminal for cycle]",
    "PENDING --reject(reason)--> REJECTED --parent resubmits--> RESUBMIT --re-verify--> VERIFIED|REJECTED",
  ]));
  out.push(h2("25.6 Enrollment"));
  out.push(flow([
    "OFFERED --parent accepts (<= expiry)--> ACCEPTED --invoice raised--> FEE_PENDING",
    "FEE_PENDING --first installment success / approved waiver--> ENROLLED [terminal -> student ACTIVE]",
    "OFFERED --expiry--> CANCELLED [terminal] ; FEE_PENDING --window exceeded + Principal cancel--> CANCELLED",
  ]));
  out.push(h2("25.7 Student"));
  out.push(flow([
    "PROVISIONAL --fee/waiver confirmed--> ACTIVE",
    "ACTIVE --temporary exit(reason)--> INACTIVE --reinstate--> ACTIVE",
    "ACTIVE --year end / completion--> GRADUATED [exit]",
    "ACTIVE --transfer internal--> ACTIVE (branch rescope) ; --transfer external (TC)--> TRANSFERRED [exit]",
    "ACTIVE|INACTIVE --withdraw (dues cleared)--> WITHDRAWN [exit]",
    "GRADUATED|TRANSFERRED|WITHDRAWN --retention/archive job or admin(reason)--> ARCHIVED --purge--> [IRREVERSIBLE]",
  ]));
  out.push(h2("25.8 Parent"));
  out.push(flow([
    "CAPTURED --student enrolled--> LINKED --invite accepted--> ACTIVE",
    "ACTIVE --opt-out (non-emergency)--> PAUSED --opt-in--> ACTIVE",
    "ACTIVE --all children exited--> CLOSED [access revoked; profile retained per policy]",
    "any --verified DPDP erasure--> ERASED [token destruction; IRREVERSIBLE; certificate issued]",
  ]));
  out.push(h2("25.9 Attendance (day-state per student)"));
  out.push(flow([
    "UNMARKED --mark/submit--> MARKED --same-day edit (reason)--> MARKED (edited, audit kept)",
    "MARKED --next-day+--> CORRECTION_REQUESTED --approve--> MARKED (corrected) ; --reject--> MARKED",
    "monthly summary COMPUTED (absorbs correction count; never blocks later corrections)",
  ]));
  out.push(h2("25.10 Invoice / Payment"));
  out.push(flow([
    "Invoice: DRAFT --issue--> ISSUED --part pay--> PARTIALLY_PAID --full pay--> PAID",
    "ISSUED|PARTIALLY_PAID --due passed--> OVERDUE --full pay--> PAID",
    "DRAFT --cancel--> CANCELLED ; ISSUED --credit note--> CREDITED ; bad debt (2-tier)--> WRITTEN_OFF",
    "[IRREVERSIBLE: ISSUE (draft-only edits end), PAID (no mutation; refunds only), WRITTEN_OFF]",
    "Payment: PENDING --gateway--> SUCCESS | FAILED ; SUCCESS --refund full--> REFUNDED ; partial -> PARTIALLY_REFUNDED",
  ]));
  out.push(h2("25.11 Growth Passport (RECOMMENDED)"));
  out.push(flow([
    "EMERGING(record-level) -> term COMPILE -> REVIEW (teacher+principal) -> PUBLISHED -> parent visible",
    "PUBLISHED --amendment--> REVISION (v+1, audit kept)  ;  no deletion after PUBLISHED",
  ]));
  out.push(h2("25.12 Notification"));
  out.push(flow([
    "QUEUED --engine--> SENT --webhook--> DELIVERED --open--> READ",
    "QUEUED|SENT --provider fail x3--> FAILED --retry policy--> DLQ [manual ops]",
    "CANCELLED only before SENT (broadcast abort)",
  ]));

  // ================= 26. API FLOW =================
  out.push(h1("26. API Flow"));
  out.push(p("Every feature follows one request path and one response envelope. The canonical stack merges the Backend TD pipeline with the API catalog conventions and fixes the envelope, code and pagination conflicts (C19, C20, C34)."));
  out.push(h2("26.1 Canonical Request Path"));
  out.push(flow([
    "UI (Next.js) -> HTTPS -> API Gateway (TLS 1.3, WAF, rate limit)",
    "  -> Middleware: traceId, tenant extraction (JWT tid), request logging",
    "  -> JwtAuthGuard (401 on missing/invalid/expired)",
    "  -> PermissionsGuard (module:action + scope; 403 before any data access; 60s perm cache)",
    "  -> ValidationPipe (DTO class-validator + Zod; 422)",
    "  -> Idempotency check (writes that need it; 409 on key reuse with different payload)",
    "  -> Controller -> Application Service (tx boundary, audit hook) -> Domain (aggregates, invariants)",
    "  -> Repository (Prisma, tenant middleware + RLS) -> PostgreSQL",
    "  -> Outbox insert (same tx) -> domain events -> Redis Streams -> workers",
    "  -> Response envelope { success, data | error, meta, traceId }",
  ]));
  out.push(h2("26.2 Response Envelope (resolves C19)"));
  out.push(p("Success: { success: true, data: <resource | array>, meta: { page, pageSize, total, totalPages, hasMore, nextCursor? }, traceId }. Error: { success: false, error: { code, message, field?, details[] }, traceId }. The OpenAPI document is to be regenerated from the API catalog with this envelope; unwrapped resource responses are void."));
  out.push(h2("26.3 Error Code Families (resolves C20)"));
  out.push(cap("Table 26-1: HTTP and code mapping"));
  out.push(tbl(
    ["HTTP", "When", "Code family / examples"],
    [
      ["400", "Malformed request body / JSON parse", "REQUEST_MALFORMED"],
      ["401", "Missing, invalid, expired token; disabled account", "AUTH_001, TOKEN_EXPIRED, TOKEN_INVALID, SESSION_REVOKED, ACCOUNT_DISABLED"],
      ["403", "Permission or scope failure; suspended tenant", "PERMISSION_DENIED, SCOPE_VIOLATION, TENANT_SUSPENDED, TENANT_PENDING"],
      ["404", "Not found or cross-tenant existence hiding", "STUDENT_NOT_FOUND, LEAD_NOT_FOUND, NOT_FOUND"],
      ["409", "Conflict: duplicates, state-machine violation, idempotency, version", "DUPLICATE_ADMISSION_NUMBER, ATTENDANCE_ALREADY_MARKED, INVALID_STATE_TRANSITION, VERSION_MISMATCH, IDEMPOTENCY_CONFLICT"],
      ["422", "DTO / semantic validation failure", "VALIDATION_001, DOB_FUTURE_DATE, FIELD_TOO_LONG, AGE_INELIGIBLE"],
      ["423", "Account locked", "ACCOUNT_LOCKED (retry-after)"],
      ["429", "Rate limit exceeded", "RATE_LIMIT_001 (Retry-After header)"],
      ["503", "Maintenance mode", "MAINTENANCE_001"],
    ],
    [8, 40, 52]
  ));
  out.push(h2("26.4 Conventions"));
  out.push(...bullets([
    "Paths: /api/v1/{module}/{resource} kebab-case plural (e.g. /api/v1/admissions/applications, /api/v1/finance/invoices); module prefixes resolve C-path ambiguity; PUT forbidden; PATCH for partial updates; DELETE is soft-delete/archive.",
    "Pagination: page-based default (page, pageSize <= 100); cursor pagination mandatory for feeds > 10k rows (audit search, attendance history); filters eq/ne/gte/lte/between/in/nin/like; sort whitelist only; q = full-text on indexed fields.",
    "Idempotency-Key mandatory on: payments, refunds, invoice issue, admission submit, tenant create, file upload complete; 24h replay window; same key + same payload = cached response; different payload = 409.",
    "Rate limits: anonymous 60/min/IP; authenticated 600/min/user; service keys 6,000/min; auth login 5/min; sensitive ops 10/min.",
    "Versioning: URL-versioned; deprecation via Sunset header + 12-month support; breaking DTO changes get V2 suffix; workflow definition changes follow ADR-040 minor/major rules.",
    "Realtime: WebSocket channels /ws/chat, /ws/attendance, /ws/notifications, /ws/dashboard, /ws/location (v1.1); rooms keyed tenant:branch; reconnect backoff 1s..30s.",
    "Webhooks (merged set, C34): admission.approved, student.admitted, fee.paid, invoice.generated, attendance.marked, student.promoted, reportcard.published; HMAC-SHA256 signature header; at-least-once with retry backoff.",
    "File uploads: pre-signed URL flow (15-min URL), magic-byte + MIME whitelist, ClamAV scan, quarantine on failure, keys tenants/{tenantId}/...",
  ]));

  // ================= 27. DATABASE RELATIONSHIP FLOW =================
  out.push(h1("27. Database Relationship Flow"));
  out.push(p("The canonical schema merges the two documentation generations (ERD v3.0 school_id world and Prisma v3.0 tenantId world) into one model. The ruling: the ERD is the domain-complete baseline (it contains admissions depth, observation/milestone/portfolio, communication logs, finance detail that Prisma lacks), Prisma contributes the implementation conventions (tenant/branch discriminators, 7-column audit block, soft delete middleware, version columns). The merged model adopts ERD table coverage with Prisma conventions, snake_case plural tables, and the audit block on every business table."));
  out.push(h2("27.1 Canonical Entity Catalog (Core)"));
  out.push(cap("Table 27-1: Core entities"));
  out.push(tbl(
    ["Entity", "PK / keys", "Core relationships", "Status column", "Scope", "Audit cols"],
    [
      ["tenant", "id uuid7; email unique", "1-N branch, user via tenant_user; 1-1 subscription", "PENDING_ACTIVATION|TRIALING|ONBOARDING|ACTIVE|SUSPENDED|ARCHIVED", "-", "yes"],
      ["branch", "id; (tenant_id, code) unique", "N-1 tenant; 1-N classroom, staff assignment", "ACTIVE|INACTIVE|SUSPENDED|CLOSED", "tenant", "yes"],
      ["academic_year / session", "id; (tenant_id) one ACTIVE", "1-N terms; partitions attendance, invoice, promotion", "UPCOMING|ACTIVE|ARCHIVED", "tenant", "yes"],
      ["user", "id; email/phone identity", "N-M role via user_role (scope TENANT/BRANCH/CLASS); 1-1 staff for employees", "PENDING_VERIFICATION|ACTIVE|INACTIVE|LOCKED|DELETED", "platform-global identity + tenant memberships", "yes"],
      ["role / permission / role_permission", "role.code unique", "role N-M permission; bundles = named sets", "is_system, is_active", "platform catalog + tenant custom (v1.1)", "yes"],
      ["student", "id; admission_no unique per tenant", "N-1 branch(current), classroom(current); 1-N guardian link; 1-N enrollment", "PROVISIONAL|ACTIVE|INACTIVE|GRADUATED|TRANSFERRED|WITHDRAWN|ARCHIVED", "tenant", "yes + version"],
      ["guardian", "id; (tenant, phone) dedup", "N-M student via student_guardian (is_primary, is_fee_payer, can_pickup, custody)", "-", "tenant", "yes"],
      ["application", "id; app_no APP-YYYY-NNNNN unique", "N-1 lead (nullable), branch, session; 1-N documents, approvals; 1-1 admission", "see Sec. 10.1", "tenant", "yes + version"],
      ["admission_document", "id", "N-1 application; file_upload ref; hash dedup", "PENDING|VERIFIED|REJECTED|RESUBMIT", "tenant", "yes"],
      ["enrollment", "id; unique (student, academic_year)", "N-1 student, class, fee_plan", "OFFERED|ACCEPTED|FEE_PENDING|ENROLLED", "tenant", "yes"],
      ["classroom / section", "id", "N-1 branch, academic year, program; N-M teachers via teacher_class", "-", "tenant", "yes"],
      ["attendance", "unique (student, date)", "N-1 student, classroom, session", "PRESENT|ABSENT|LATE|HALF_DAY|LEAVE", "tenant (partitioned by year)", "yes"],
      ["attendance_correction", "id", "N-1 attendance; approver ref", "PENDING|APPROVED|REJECTED", "tenant", "yes"],
      ["observation / activity / milestone / milestone_assessment / portfolio_item", "id", "N-1 student, classroom; observer ref", "observation: shared flag + ai_draft; assessment: 5 levels", "tenant", "yes"],
      ["fee_head / fee_plan / fee_plan_item / fee_installment", "id", "plan N-1 program (branch optional); items N-1 head", "-", "tenant", "yes"],
      ["invoice / invoice_item", "invoice_no unique per school per FY; version", "N-1 student, fee_plan; 1-N items, payments via allocation", "DRAFT|ISSUED|PARTIALLY_PAID|PAID|OVERDUE|CANCELLED|WRITTEN_OFF", "tenant", "yes + version"],
      ["payment / payment_allocation / receipt", "payment_no, receipt_no (per branch per FY)", "payment N-M invoice via allocation; receipt 1-1 payment", "payment: PENDING|SUCCESS|FAILED|REFUNDED", "tenant", "yes"],
      ["refund / credit_note", "refund_no; credit_no", "N-1 payment, invoice; approvals 1-N", "REQUESTED|APPROVED|PROCESSED|REJECTED|CANCELLED", "tenant", "yes"],
      ["announcement / broadcast / chat_room / chat_message", "id", "audiences; recipients log with delivery + read", "DRAFT|SCHEDULED|PUBLISHED|CANCELLED (announcement)", "tenant", "yes"],
      ["notification_queue / *_log (sms/whatsapp/email/push)", "id", "trigger_event, template ref, provider refs", "QUEUED|RUNNING|COMPLETED|FAILED|CANCELLED", "tenant", "yes"],
      ["ai_insight / ai_usage (NEW)", "id", "related_entity polymorphic; reviewer ref", "DRAFT|ACCEPTED|EDITED|REJECTED", "tenant", "yes"],
      ["audit_log", "id; BRIN occurred_at", "actor, entity polymorphic", "-", "tenant + platform mirror", "append-only"],
    ],
    [22, 16, 26, 16, 10, 10],
    { cellSize: 16 }
  ));
  out.push(h2("27.2 Cross-Cutting Conventions"));
  out.push(...bullets([
    "PKs: UUID v7 for all new tables (time-sortable); composite PKs where tenant isolation demands (tenant_id, id); foreign keys RESTRICT for financial links, SET NULL for soft references (created_by).",
    "Audit block on every business table: created_at/by, updated_at/by, deleted_at/by (soft delete), version int; partial index WHERE deleted_at IS NULL.",
    "Money: bigint paise; percents numeric(5,2); timestamps timestamptz UTC; dates DATE (attendance_date); enums as PG native enums only when stable, otherwise varchar + CHECK.",
    "Partitioning: attendance, audit_log, notifications by tenant + month/year (ADR-051/046); invoice/report archives to cold storage per retention policy.",
    "Sequence counters table (per branch per FY per doc type) drives application/invoice/receipt numbering inside the issuing transaction (SELECT ... FOR UPDATE).",
    "The Prisma-only additions retained: credit_note, journal_entry (ledger projection), financial_year; the ERD-only tables retained: fee_installment, payment_allocation, cheque handling, late_fee_rule, lead scoring, guardians join model.",
  ]));

  // ================= 28. EDGE CASES =================
  out.push(h1("28. Edge Cases"));
  out.push(p("The audit brief lists 29 edge situations that the flow must survive. The table below defines the canonical system behaviour for each, which becomes the QA acceptance baseline (Test Strategy flows reference this table). All edge-case actions are audit-logged; where a reason is marked mandatory, the API returns 422 without it."));
  out.push(cap("Table 28-1: Edge case register"));
  out.push(tbl(
    ["#", "Edge case", "Canonical behaviour"],
    [
      ["1", "Duplicate admission (same child twice)", "(branch, session, child dob+name hash) unique check -> 409 ADMISSION_DUPLICATE with link to existing application"],
      ["2", "Duplicate student (same child re-admitted)", "Allowed as READMISSION type with new admission number; history links prior records via guardian+dob match; never a second ACTIVE enrollment in the same year"],
      ["3", "Duplicate parent", "Guardian dedup by phone+tenant on create/link; merge tool unifies duplicates (GuardianMerge workflow); merged record becomes alias"],
      ["4", "Missing documents at submission", "Application may submit but stays DOCUMENT_PENDING; approval action blocked (422 CHECKLIST_INCOMPLETE); window reminder cadence to parent"],
      ["5", "Invalid document (corrupt/wrong type)", "Upload validation: MIME whitelist + magic bytes + size; verification rejection with reason -> RESUBMIT loop; OCR mismatch flags manual review"],
      ["6", "Rejected application", "Status REJECTED + reason + feedback_to_parent + appeal_eligible; re-application creates a NEW application (no status resurrection)"],
      ["7", "Withdrawn application", "Parent-initiated WITHDRAWN with confirmation; lead (if any) returns to NURTURE or LOST per counsellor choice"],
      ["8", "Cancelled admission", "School-initiated (offer expiry, duplicate, fraud); cancellation reason mandatory; payments already made flow to refund pipeline"],
      ["9", "Student transfer (internal)", "New classroom/branch assignment next day onward; attendance/fees re-scope; history TRANSFERRED event; same-day attendance rows preserved in old class"],
      ["10", "Student transfer (external)", "TC generated, dues cleared mandatory, status TRANSFERRED; parent access revoked at effective date"],
      ["11", "Student promotion", "Year-boundary job: next-year class assignment + history; students failing criteria flagged for Principal case review (BRC R-OPS-005 / R-ACD-011)"],
      ["12", "Student withdrawal", "Dues settlement check (block if outstanding without Owner countersign); status WITHDRAWN; reminders stop; parent access revoked"],
      ["13", "Archived student in lists", "Excluded by default; Show-deleted/Archive toggle for admins; archive register page lists reason + retention date"],
      ["14", "Inactive student in operations", "INACTIVE excluded from rosters, attendance, transport and reminders; visible in student list with badge; reinstate restores"],
      ["15", "Suspended school", "All writes 403 TENANT_SUSPENDED; reads + exports allowed; platform banner; parent app shows maintenance notice"],
      ["16", "Deleted user (staff)", "Soft delete: sessions revoked, assignments removed, audit author preserved by id; records keep created_by meaning"],
      ["17", "Deactivated user mid-flow", "Open tasks (approvals, corrections) auto-reassign to role queue; notification to Principal; nothing orphaned"],
      ["18", "Teacher reassignment mid-year", "Teacher-class mapping update from effective date; past attendance/observations keep original teacher; today's unsubmitted sheets follow new mapping"],
      ["19", "Class reassignment (student)", "Same as internal transfer but within branch; unique (student, year) constraint forces closing the previous assignment first"],
      ["20", "Branch transfer of staff", "Assignment scope updated; multi-branch staff keep two scoped assignments; dashboards follow active branch switcher"],
      ["21", "Fee overdue", "Reminder cadence (Table 19-2) + late-fee slabs; > 60d service hold needs Principal approval; student remains ACTIVE (welfare rule)"],
      ["22", "Partial payment", "payment_allocation across invoices; invoice PARTIALLY_PAID; receipt for paid amount; balance recomputed (total - paid) with DB CHECK"],
      ["23", "Failed payment", "Payment FAILED with gateway reason; invoice state unchanged; parent retry allowed; webhook/idempotency prevents double charge (SERIALIZABLE on money)"],
      ["24", "Refund request", "Eligibility (90-day window) + tier approval (Table 24-3); processed via gateway reversal or manual transfer with proof; receipt annotated; audit every step"],
      ["25", "Attendance correction after lock", "No hard lock: CorrectionRequest path with reason + approver; monthly summary recomputes on approval; both values audited"],
      ["26", "Missing parent (no guardian)", "Enrollment blocked (>= 1 guardian mandatory); legacy imports allowed with guardian_placeholder flag + Principal attestation task"],
      ["27", "Multiple guardians", "Exactly one is_primary; fee payer and pickup flags independent; communication goes to all non-opted-out guardians; custody flags restrict as configured"],
      ["28", "Missing teacher (class unassigned)", "Class creation requires a teacher before go-live checklist item 5; interim: Principal holds marking rights; attendance escalation path covers gaps"],
      ["29", "Missing fee plan", "Enrollment FEE_PENDING allowed with invoice deferred; setup-progress card flags program without plan; invoice generation job skips + alerts Accountant"],
    ],
    [5, 24, 71],
    { cellSize: 18 }
  ));

  return out;
};
