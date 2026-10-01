// content-part7.js — Sections 29-32
module.exports = function build(H) {
  const { h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow } = H;
  const out = [];

  // ================= 29. END-TO-END FLOW DIAGRAMS =================
  out.push(h1("29. End-to-End Flow Diagrams"));
  out.push(p("Every flow below follows the normative shape: START > ACTION > VALIDATION > DECISION > SUCCESS / FAILURE > NEXT STATE. These are the QA-traceable flows: the Test Strategy's ten critical E2E journeys map onto flows 8-13, 17-20 and 22 of this section. Permissions cited are from Sec. 24; audit points are from Sec. 22."));
  out.push(h2("29.1 Platform & School Bootstrap"));
  out.push(flow([
    "F1 PLATFORM ONBOARDING: START -> platform admin signs in -> MFA -> [role ok? yes] -> platform console -> NEXT: F2",
    "F2 SCHOOL CREATION: START -> create tenant (5 steps) -> validate uniqueness + plan -> commit -> SUCCESS: tenant PENDING_ACTIVATION + owner invited / FAILURE: inline field errors -> NEXT: F3",
    "F3 SCHOOL ACTIVATION: START -> KYC + signatory + payment gate -> [all true?] -> SUCCESS: ONBOARDING / FAILURE: checklist persists -> NEXT: F4",
    "F4 SCHOOL ONBOARDING: START -> owner first login (set password, MFA) -> wizard 9 steps -> [Principal ACTIVE + year + class?] -> SUCCESS: ACTIVE + go-live / FAILURE: resume later -> NEXT: F5",
    "F5 SCHOOL SETUP: START -> manage years/branches/classes/fees/staff -> validations per module -> SUCCESS: config saved (audit) -> NEXT: daily ops (F13+)",
    "F6 USER CREATION: START -> authorized creator submits user+role+scope -> validate email/phone unique, role exists -> invite sent -> SUCCESS: PENDING_VERIFICATION / FAILURE: 409/422 -> NEXT: F7",
    "F7 LOGIN: START -> credentials -> [status/tenant/role checks per Sec. 5.2] -> SUCCESS: tokens + role route / FAILURE: lockout or specific error -> NEXT: role home",
  ]));
  out.push(h2("29.2 Admissions To Enrollment"));
  out.push(flow([
    "F8 LEAD CREATION: START -> capture (form/walk-in/campaign) -> phone dedup check -> [duplicate?] merge-offered -> SUCCESS: NEW lead + assignee (round-robin) -> NEXT: follow-ups",
    "F9 ADMISSION (application): START -> convert lead / create app -> checklist + age + capacity validations -> review + approval chain -> SUCCESS: APPROVED + offer / FAILURE: REJECTED(reason)|WAITLISTED -> NEXT: F10",
    "F10 STUDENT ENROLLMENT: START -> offer accepted -> enrollment tx (student + guardians) -> assignment steps -> fee gate -> SUCCESS: student ACTIVE / FAILURE: FEE_PENDING cadence -> NEXT: F12 parent",
    "F11 PARENT ONBOARDING: START -> guardian link at enrollment -> invite -> first login + password -> SUCCESS: parent ACTIVE -> NEXT: portal",
    "F12 CLASS ASSIGNMENT: START -> assign classroom -> capacity + age + year validations -> SUCCESS: assignment + history / FAILURE: 409 CAPACITY_FULL (waitlist) -> NEXT: rosters",
  ]));
  out.push(h2("29.3 Daily Operations & Learning"));
  out.push(flow([
    "F13 ATTENDANCE: START -> teacher opens class-day -> roster loads -> mark + submit -> [duplicates? blocked] -> SUCCESS: rows + absence alerts -> corrections per Sec. 15 -> reports",
    "F14 ACTIVITY RECORDING: START -> teacher logs activity + photos -> consent + size validations -> SUCCESS: timeline entry (<= 5 min) / FAILURE: consent-blocked flagged -> NEXT: F15",
    "F15 OBSERVATION: START -> teacher writes (or AI draft) -> quality check (>= 20 chars) -> publish/share toggle -> SUCCESS: observation + parent notify / FAILURE: quality flag -> coaching",
    "F16 GROWTH PASSPORT: START -> term compile job -> projections gathered -> teacher+principal review -> SUCCESS: passport PDF published / FAILURE: review notes -> revise",
  ]));
  out.push(h2("29.4 Finance"));
  out.push(flow([
    "F17 FEE ASSIGNMENT: START -> plan assigned at enrollment/concession change -> approval tier check -> SUCCESS: schedule generated -> NEXT: F18",
    "F18 INVOICE: START -> cycle job or manual generate -> plan + concessions computed -> DRAFT -> issue -> SUCCESS: ISSUED + D-7 reminder armed / FAILURE: alert Accountant (no plan)",
    "F19 PAYMENT: START -> parent pays online OR office records -> Idempotency-Key + gateway -> [success?] -> SUCCESS: allocations + receipt <= 60s + events / FAILURE: FAILED + retry path",
    "F20 RECEIPT: START -> payment SUCCESS -> number per branch counter -> PDF stored -> SUCCESS: receipt issued + notify (reprint = copy, audited)",
  ]));
  out.push(h2("29.5 Communication, Insight & Reporting"));
  out.push(flow([
    "F21 COMMUNICATION: START -> compose (chat/announcement) -> audience-permission matrix + quiet hours -> [approval needed? tier] -> SUCCESS: queued -> sent -> delivered -> read (audit)",
    "F22 REPORTS: START -> user opens report -> scope + permission check -> query (replica/MV) -> SUCCESS: view/export (audit) / FAILURE: 403 or empty-state guidance",
    "F23 AI RECOMMENDATION: START -> feature trigger (draft/alert) -> gateway quota + consent + PII gate -> SUCCESS: ai_insight DRAFT -> human review -> ACCEPT/EDIT/REJECT (audit) / FAILURE: quota/consent block",
  ]));
  out.push(h2("29.6 Student & Staff Exits, Platform Actions"));
  out.push(flow([
    "F24 STUDENT TRANSFER: START -> transfer request -> [internal?] branch rescope : TC + dues check -> SUCCESS: status/history per Sec. 12 / FAILURE: dues block (countersign path)",
    "F25 STUDENT PROMOTION: START -> year-end job -> criteria eval (attendance >= 75%, milestones, fees) -> [eligible?] auto-assign next class / flag case review -> SUCCESS: history event",
    "F26 STUDENT WITHDRAWAL: START -> request -> dues settlement -> confirm -> SUCCESS: WITHDRAWN + access revoked / FAILURE: outstanding dues blocked",
    "F27 STUDENT ARCHIVE: START -> retention job / admin action -> reason + DPDP minimize -> SUCCESS: ARCHIVED read-only -> later purge [IRREVERSIBLE]",
    "F28 USER DEACTIVATION: START -> admin action -> task reassignment -> sessions revoked -> SUCCESS: INACTIVE (reactivatable) / audited",
    "F29 SCHOOL SUSPENSION: START -> trigger (dunning/violation/manual) -> writes blocked tenant-wide -> SUCCESS: SUSPENDED + notice / resolve -> ACTIVE (audit pair)",
  ]));

  // ================= 30. FINAL CANONICAL PREONE FLOW =================
  out.push(h1("30. FINAL CANONICAL PREONE FLOW"));
  out.push(p("This is the one master flow that survives the audit. It corrects the draft sequence in the brief in two places: school onboarding and setup precede the admission CRM being staffed (a school cannot run admissions without at least a Principal and a fee structure), and AI insights are positioned strictly after validated operational data exists, feeding back into operations through human-approved actions only."));
  out.push(flow([
    "PREONE PLATFORM",
    "  v",
    "PLATFORM ADMIN (console)                          [F1]",
    "  v",
    "SCHOOL TENANT CREATED  (DRAFT -> PENDING_ACTIVATION)   [F2]",
    "  v",
    "SCHOOL ACTIVATION  (KYC + subscription gate)      [F3]",
    "  v",
    "OWNER FIRST LOGIN -> SCHOOL ONBOARDING (wizard)   [F4]",
    "  v",
    "SCHOOL SETUP  (years, branches, classes, fees, staff, roles)   [F5]",
    "  v",
    "USERS + RBAC LIVE  (staff ACTIVE with scoped bundles)   [F6][F7]",
    "  v",
    "SCHOOL LIVE: ADMISSIONS CRM  (leads, follow-ups, visits, funnel)   [F8]",
    "  v",
    "APPLICATION -> DOCUMENT VERIFICATION -> APPROVAL CHAIN   [F9]",
    "  v",
    "ENROLLMENT  (student + guardians + assignments + fee gate)   [F10][F11][F12]",
    "  v",
    "DAILY SCHOOL OPERATIONS",
    "  |- ATTENDANCE  (mark -> correct -> summaries)            [F13]",
    "  |- ACTIVITIES + OBSERVATIONS (consent, quality, sharing) [F14][F15]",
    "  |- GROWTH PASSPORT (projections -> term report)          [F16]",
    "  v",
    "FEES & FINANCE  (plans -> invoices -> payments -> receipts -> refunds)   [F17][F18][F19][F20]",
    "  v",
    "COMMUNICATION  (chat, broadcasts, event notifications)    [F21]",
    "  v",
    "REPORTS  (operational, academic, financial, compliance)   [F22]",
    "  v",
    "AI INSIGHTS  (validated data -> drafts/advisories -> HUMAN review -> action)   [F23]",
    "  v",
    "LIFECYCLE EXITS  (transfer, promotion, withdrawal, archive; user deactivation; school suspension)   [F24..F29]",
    "  v",
    "AUDIT / SYSTEM MONITORING  (every step above; hash-chained; 7-year retention; SIEM mirror)",
  ]));
  out.push(p("Read as a contract: every arrow above is a validated API transition with a permission, an audit record and a defined failure state; every module owns its tables; every event crosses domains only through the outbox; and the human is the final authority wherever child data, money or communication leaves the system."));

  // ================= 31. OPEN DECISIONS =================
  out.push(h1("31. Open Decisions / Items Requiring Product Approval"));
  out.push(p("These are genuine product choices that the sources do not settle. Each is registered with options, this document's recommendation, the affected canonical sections, and the team best placed to own the sign-off. Until decided, the recommendation stands as the working canonical behaviour (clearly marked RECOMMENDED in the body), so development is never blocked."));
  out.push(cap("Table 31-1: Decision register"));
  out.push(tbl(
    ["ID", "Decision", "Options", "Recommendation", "Owner / impact"],
    [
      ["OD-1", "Growth Passport v1.0 composition", "(a) As proposed in Sec. 17 (projection view + term PDF); (b) defer term; (c) standalone entity", "(a) projection composition; no new silo", "Product + UX; sections 16, 17, 23"],
      ["OD-2", "Transport in v1.0 scope", "(a) Feature-flagged out (PRD); (b) ship with DDD context", "(a) out of v1.0, schema retained; TRANSPORT_MANAGER role ships dormant", "Product; sections 03, 04, 19"],
      ["OD-3", "Observation frequency target", "(a) min 1/target 2; (b) hard 3 (PRD)", "(a) min 1 enforced, target 2 on dashboards", "Product + Academic; section 16"],
      ["OD-4", "Refund eligibility window", "(a) 90 days; (b) 30 days (DDD service); (c) none", "(a) 90 days, configurable per tenant", "Product + Finance; section 18"],
      ["OD-5", "Invoice numbering scope", "(a) per school per FY; (b) per branch per FY (BRC)", "(a) per school per FY; receipts per branch", "Finance compliance; section 18, 27"],
      ["OD-6", "AI provider set", "(a) Z.ai GLM + OpenAI reserve; (b) add Anthropic (DDD ACL)", "(a) two-provider ACL now; provider abstraction ready for (b)", "CTO; section 20"],
      ["OD-7", "Parent MFA factors", "(a) SMS OTP allowed; (b) TOTP/email only", "(a) SMS OTP for parents (usability), TOTP for staff", "Product + Security; section 05"],
      ["OD-8", "Finance role naming", "(a) ACCOUNTANT; (b) Finance User (Security)", "(a) ACCOUNTANT (matches data model + market usage)", "Product; section 03"],
      ["OD-9", "BRC rule-ID reissue", "(a) re-map DDD citations to BRC IDs; (b) dual registry", "(a) BRC v1.1 with reconciliation appendix", "Product + Architecture; section 02"],
      ["OD-10", "Custom roles per tenant in v1.0?", "(a) v1.0; (b) v1.1 (system roles only)", "(b) v1.1 using ADR-064 catalog + no-escalation guard", "CTO + Product; section 24"],
      ["OD-11", "GST configuration surface", "(a) fixed BRC defaults; (b) per-tenant editable tax matrix", "(a) defaults now, (b) behind settings flag", "Finance + Product; section 18"],
    ],
    [7, 20, 27, 26, 20],
    { cellSize: 18 }
  ));

  // ================= 32. DEVELOPMENT READINESS CHECKLIST =================
  out.push(h1("32. Development Readiness Checklist"));
  out.push(p("The checklist below converts this document into team-level acceptance gates. An item is done when the referenced canonical section is implemented, tested (Test Strategy mapping) and audited. QA treats Sec. 25 state machines and Sec. 28 edge cases as the coverage baseline; DevOps items reference ADR-111, which remains valid."));
  out.push(cap("Table 32-1: CTO / Tech Lead gates"));
  out.push(tbl(
    ["#", "Item", "Done when"],
    [
      ["T1", "Conflict register adopted", "All rulings C01-C34 accepted; superseded doc sections annotated or docs re-issued"],
      ["T2", "Stack freeze re-confirmed", "NestJS + Prisma + PostgreSQL 16 + Redis + BullMQ + Next.js 16 declared; ADR-020 Java marked superseded"],
      ["T3", "Open decisions OD-1..OD-11 dispositioned", "Each has an owner and a date; recommendations active meanwhile"],
      ["T4", "Isolation test suite", "Cross-tenant probe suite green at API, service, repo and raw-SQL layers (Test Strategy 11.8.2)"],
      ["T5", "Audit completeness", "Linter fails any state-changing route without audit decorator; hash-chain verification job scheduled"],
    ],
    [6, 26, 68]
  ));
  out.push(cap("Table 32-2: Product / UX gates"));
  out.push(tbl(
    ["#", "Item", "Done when"],
    [
      ["P1", "IA approved", "Sec. 23 tree reviewed; nav config generated from permission metadata"],
      ["P2", "Page specs complete", "Sec. 23.2 extended to all module pages with the Student-Profile benchmark template"],
      ["P3", "Onboarding wizard spec", "Sec. 07 steps, gates and skip rules signed off; resumability designed"],
      ["P4", "Growth Passport decision", "OD-1 closed; passport surfaces designed per outcome"],
      ["P5", "Notification catalog", "Sec. 19.3 mapped to templates per channel and language"],
    ],
    [6, 26, 68]
  ));
  out.push(cap("Table 32-3: Backend gates"));
  out.push(tbl(
    ["#", "Item", "Done when"],
    [
      ["B1", "Canonical schema migrated", "Sec. 27 catalog implemented; two-generation merge complete; paise everywhere; uuid7 for new tables"],
      ["B2", "State machines enforced", "Sec. 25 transitions in domain layer; invalid transitions 409 INVALID_STATE_TRANSITION"],
      ["B3", "RBAC engine", "module:action grammar; scoped assignments; effective-permission cache with 60s freshness; matrix tests green"],
      ["B4", "Admission pipeline + enrollment saga", "Sec. 10/11 implemented with five status domains and workflow SLAs"],
      ["B5", "Attendance correction flow", "Same-day edit + CorrectionRequest approval path + monthly recompute (Sec. 15)"],
      ["B6", "Finance rails", "Immutable invoices, allocations, receipts counters, refund tiers, late-fee slabs, GST config (Sec. 18)"],
      ["B7", "Notification engine", "Sec. 19 pipeline with rate limits, quiet hours, DLQ; trigger catalog live"],
      ["B8", "AI gateway + persistence", "ai_insight/ai_usage tables; provenance; never-write guard tests (Sec. 20)"],
      ["B9", "Audit pipeline", "Superset record (Sec. 22); same-tx writes; platform + tenant query APIs"],
      ["B10", "API contract regenerated", "OpenAPI re-issued from the catalog with canonical envelope, paths, pagination (Sec. 26)"],
    ],
    [6, 30, 64]
  ));
  out.push(cap("Table 32-4: Frontend gates"));
  out.push(tbl(
    ["#", "Item", "Done when"],
    [
      ["F1", "Shell + navigation", "Sec. 23 IA implemented; permission-filtered menus; mobile bottom nav; teacher tablet home"],
      ["F2", "Route guards", "Edge middleware + layout guards per Sec. 05; 403 page with reason; no silent redirects"],
      ["F3", "State standards", "Skeleton loading, empty CTAs, error toasts with traceId; optimistic patterns per FA Sec. 20"],
      ["F4", "Core pages", "Sec. 23.2 pages implemented with actions, validations and states as specified"],
      ["F5", "Onboarding + platform console", "Wizard and console per Sec. 06/07; impersonation banner"],
    ],
    [6, 26, 68]
  ));
  out.push(cap("Table 32-5: QA gates"));
  out.push(tbl(
    ["#", "Item", "Done when"],
    [
      ["Q1", "State-machine coverage", "Every Sec. 25 transition has positive + negative tests; irreversible transitions proven immutable"],
      ["Q2", "RBAC matrix tests", "Sec. 24.3 matrix encoded as test data; role x endpoint allow/deny green; escalation attempts 403"],
      ["Q3", "Edge-case suite", "All 29 Sec. 28 rows have automated or scripted checks"],
      ["Q4", "E2E critical flows", "10 critical journeys (Sec. 29 mapping) automated; admission TAT < 7 days simulated"],
      ["Q5", "Finance integrity", "Idempotency replay, double-charge race, allocation math, receipt uniqueness, refund tiers tested"],
    ],
    [6, 26, 68]
  ));
  out.push(cap("Table 32-6: DevOps gates"));
  out.push(tbl(
    ["#", "Item", "Done when"],
    [
      ["D1", "Environments", "Six-env topology per ADR-111; prod access break-glass with MFA + audit"],
      ["D2", "Secrets decision", "OD on Vault vs cloud secret manager closed; rotation schedule per Security Sec. 13"],
      ["D3", "Retention + purge jobs", "Retention job per ADR-053 with legal-hold support; purge certificates produced"],
      ["D4", "Audit SIEM mirror", "Outbox -> SIEM stream live; hash-chain verify + alert scheduled"],
      ["D5", "Backup/DR", "RPO <= 15 min / RTO per ADR-111; quarterly restore drills scheduled"],
    ],
    [6, 26, 68]
  ));
  out.push(p("With these gates green, PreOne has one flow, one vocabulary, one permission model and one audit trail - and every team can answer, without returning to the conflicting sources: what screen comes next, which action is allowed, which API is called, which data changes, which permission is required, which status changes, what happens on failure, and what is logged."));

  return out;
};
