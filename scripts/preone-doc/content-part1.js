// content-part1.js — Sections 01-04
module.exports = function build(H) {
  const { h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow } = H;
  const out = [];

  // ================= 01. EXECUTIVE FLOW VERDICT =================
  out.push(h1("01. Executive Flow Verdict"));
  out.push(p("This document is the single canonical source of truth for how PreOne works, produced by auditing the complete PreOne documentation set end to end: the Master PRD v1.0, Business Rules Catalog v1.0 (BRC), Domain-Driven Design v1.0, UI Design Philosophy v1.0, ERD v3.0, Prisma Schema v3.0, API Contract Catalog v1.0, OpenAPI Specification v1.0, the four ADR Series volumes (ADR-001 to ADR-090), Backend Technical Design v1.0, Frontend Architecture v1.0, Enterprise Security Architecture v1.0, Engineering Standards v1.0, Test Strategy v1.0 and ADR-111 DevOps Infrastructure. Every claim in this document is either traced to one or more source documents or explicitly marked as a RECOMMENDED addition where the sources are silent. Nothing is silently invented and nothing is silently dropped."));
  out.push(p("The verdict is direct: the PreOne product vision is coherent and strong, but the documentation set as it stands is NOT development-ready, because it contains two incompatible data-model generations, three conflicting technology-stack declarations, six different role taxonomies, four structurally different admission pipelines, and more than forty lower-grade contradictions in finance, attendance, communication and platform policies. Any team that starts building by reading these documents in sequence would build three different products. The purpose of this document is to resolve every conflict once, with reasoning, and to define the one flow that all teams implement."));

  out.push(h2("1.1 Verdict by Layer"));
  out.push(cap("Table 1-1: Development-readiness verdict per architecture layer"));
  out.push(tbl(
    ["Layer", "State of the sources", "Verdict", "Blocking?"],
    [
      ["Product vision & terminology", "Consistent across PRD/DDD/UI: AI-ready, multi-tenant Enterprise Preschool OS, 13-14 business domains", "USABLE", "No"],
      ["Role model", "Six incompatible taxonomies (PRD, BRC, UI, Security, ERD, Prisma)", "MUST FIX", "Yes"],
      ["Tenant hierarchy", "school=tenant vs tenant>school>branch vs tenant>branch", "MUST FIX", "Yes"],
      ["Admission pipeline", "4+ incompatible stage lists (PRD x2, DDD x2, UI steppers, ADR-037 workflow)", "MUST FIX", "Yes"],
      ["Student / parent lifecycle", "Status lists differ across PRD, DDD, ERD, Prisma; no parent lifecycle anywhere", "MUST FIX", "Yes"],
      ["Attendance flow", "Status count conflicts (3 vs 5), edit model conflict (edit vs immutable+correction)", "MUST FIX", "Yes"],
      ["Fees & finance", "GST, late fee, refund approval, money precision all conflict; strongest rules exist in BRC", "MUST FIX", "Yes"],
      ["Onboarding / setup / settings", "Fragments exist (PRD FR-054, ADR-058 bootstrap, UI wizard) but no unified lifecycle", "MUST FIX", "Yes"],
      ["AuthN / AuthZ", "Login flows differ per doc; permission grammar has 4 competing formats", "MUST FIX", "Yes"],
      ["Data model", "Two generations: ERD+API (school_id, integer cents) vs Prisma+OpenAPI (tenantId, Decimal)", "MUST FIX", "Yes"],
      ["API surface", "~530 endpoints catalogued; envelope, paths and pagination differ between catalog and OpenAPI", "MUST FIX", "Yes"],
      ["AI Center", "Capabilities listed in PRD + 5 endpoints in API catalog; no persistence, no review workflow, ADR-148 missing", "PARTIAL", "Conditional"],
      ["Growth Passport", "Named in downstream materials but defined in ZERO source documents", "UNDEFINED", "Yes"],
      ["Audit & security", "Strongest area: Security Architecture + ADR-086 + BRC data rules agree on model and retention", "USABLE", "No"],
      ["DevOps / infra", "ADR-111 complete and internally actionable; minor conflicts with Security doc (CSP, secrets store)", "USABLE", "No"],
    ],
    [22, 42, 14, 22]
  ));

  out.push(h2("1.2 The Ten Canonical Decisions That Fix the Product"));
  out.push(p("Each decision below is fully derived and justified in the referenced section of this document. They are listed here so that a CTO can absorb the entire audit in one page."));
  out.push(cap("Table 1-2: Canonical decisions at a glance"));
  out.push(tbl(
    ["#", "Decision", "Where"],
    [
      ["D1", "One application, one backend, RBAC-driven: platform console and school portal are route groups of the same system, gated by role. Parent portal is a mobile-first surface of the same backend.", "Sec. 05"],
      ["D2", "Canonical hierarchy: Platform > Tenant (= School account) > Branch > Academic Year > Class/Section > Student. The extra school level in the API JWT spec is collapsed into Tenant; chains are modeled as multi-branch tenants.", "Sec. 04"],
      ["D3", "Canonical 11 roles in 3 levels (Platform Admin; School Owner, Principal, Coordinator, Admission Counsellor, Teacher, Accountant, Receptionist, HR Manager, Transport Manager; Parent). All other role names in the sources map onto these.", "Sec. 03"],
      ["D4", "One admission pipeline with five separated status domains: Lead Status, Application Status, Document Status, Approval Record, Enrollment Status. CRM funnel views are reporting projections, not statuses.", "Sec. 10"],
      ["D5", "Canonical tenant lifecycle: DRAFT > PENDING_ACTIVATION > ONBOARDING > ACTIVE > SUSPENDED > ARCHIVED, with optional TRIALING. Owner invitation is a user-level INVITED state, not a tenant state.", "Sec. 06"],
      ["D6", "Attendance: 5 statuses (PRESENT, ABSENT, LATE, HALF_DAY, LEAVE); same-day edit with reason; after-day change only via approved CorrectionRequest; every row append-only + audited.", "Sec. 15"],
      ["D7", "Money stored as integer paise everywhere; GST 0% on pure preschool tuition (BRC wins); late fee = BRC slab; refund approval = BRC matrix (Branch Admin <= INR 5,000; Branch Head <= INR 25,000; Director above), TAT 14 working days.", "Sec. 18"],
      ["D8", "Permission grammar: module:action (lowercase, colon-separated), e.g. students:create, attendance:approve. All four competing grammars in the sources map to this one.", "Sec. 24"],
      ["D9", "Growth Passport is canonically defined as the composition of Activities + Observations + Milestone Assessments + Achievements + Portfolio + Daily Timeline, rendered as a longitudinal parent-facing view and term PDF. Marked RECOMMENDED because no source defines it.", "Sec. 17"],
      ["D10", "AI is a read-only intelligence layer over validated operational data: AI never writes core student, attendance or finance records; every AI output carries provenance (ai_draft) and requires human acceptance before it becomes operational data.", "Sec. 20"],
    ],
    [8, 78, 14]
  ));

  out.push(h2("1.3 What Each Team Should Read First"));
  out.push(cap("Table 1-3: Reading map per team"));
  out.push(tbl(
    ["Team", "Read first", "Then"],
    [
      ["CTO / Tech Lead", "Sec. 01, 02, 24, 31", "Sec. 04, 05, 26, 27"],
      ["Product Manager", "Sec. 01, 02, 06-13, 31", "Sec. 15-21"],
      ["UI / UX", "Sec. 23 (navigation + page specs)", "Sec. 05, 10-21 for page-level behaviour"],
      ["Backend", "Sec. 24, 25, 26, 27", "Sec. 10-22 for module logic"],
      ["Frontend", "Sec. 23, 05, 26", "Sec. 10-21 for page behaviour"],
      ["QA", "Sec. 25, 28, 29", "Sec. 24 (RBAC matrix)"],
      ["DevOps", "Sec. 32 (DevOps items)", "ADR-111 (still valid), Sec. 22 audit pipeline"],
    ],
    [20, 40, 40]
  ));

  // ================= 02. CURRENT DOCUMENTATION PROBLEMS =================
  out.push(h1("02. Current Documentation Problems"));
  out.push(p("This section is the complete audit output. It classifies everything found in the source set into six buckets: what is already correct, what is inconsistent, what is duplicated, what is missing, what is ambiguous, and what needs a product decision. Every conflict is shown as Version A versus Version B (with sources) and the canonical ruling that the rest of this document implements. The same method applies throughout: the ruling always preserves the PreOne product vision and prefers the most specific, most recent, and most internally consistent source."));

  out.push(h2("2.1 What Is Already Correct (Preserve As-Is)"));
  out.push(...bullets([
    "Product definition and positioning: AI-ready Enterprise Preschool Operating System, multi-tenant SaaS, 13-14 business domains, paperless and mobile-first objectives (PRD Sec. 2, DDD Sec. 4).",
    "Multi-tenant isolation principles: tenant_id discriminator on every table, PostgreSQL RLS as defense in depth, cross-tenant reads forbidden at the ORM layer, super-admin exemption audited (BRC R-PLT-001/008, ADR-043, Backend TD Sec. 21).",
    "Audit architecture: append-only audit log written in the same transaction as the business operation, hash chain, WORM cold storage, 7-year retention (Security Sec. 11, ADR-086, DDD AuditLog invariants).",
    "Token model: 15-minute RS256 access token, rotated single-use refresh token with family revocation on reuse, Redis revocation list (Security Sec. 6, API catalog, ADR-070/071).",
    "Soft delete: deleted_at column, no application-code hard deletes, retention job is the only deleter (ADR-047, Engineering Standards, Prisma middleware).",
    "Design system: Fluent-Metro synthesis, whitespace discipline, tile-based dashboards, card max 2 nesting levels, 150-250ms motion, WCAG 2.1 AA (UI Design Philosophy v1.0).",
    "Notification engine shape: domain events to outbox, Redis Streams fan-out, per-channel queues, at-least-once with idempotent consumers, DLQ after retries (Backend TD Sec. 14-15, ADR-027/034).",
    "Test strategy targets: every BRC business rule has at least one test, 10 critical E2E flows defined, RBAC allow/deny matrix encoded in test data (Test Strategy Sec. 11).",
  ]));

  out.push(h2("2.2 What Is Inconsistent (Conflict Register)"));
  out.push(p("The register below lists every material conflict discovered between source documents, with the canonical ruling applied in this document. Conflicts marked CRITICAL would cause two teams to build incompatible systems."));
  out.push(cap("Table 2-1: Master conflict register (Version A vs Version B vs Canonical)"));
  out.push(tbl(
    ["#", "Topic", "Version A (source)", "Version B (source)", "CANONICAL RULING"],
    [
      ["C01", "Backend stack", "NestJS modular monolith, Prisma, BullMQ (Backend TD; DDD)", "Java 21 / Spring Boot frozen 12 months (ADR-020, ADR Vol 1-2)", "NestJS + Prisma + PostgreSQL 16 + Redis + BullMQ (Backend TD + Engineering Standards). ADR Vol 1-2 Java stack is a foreign template artifact; treat ADR-020 as superseded by the Backend TD stack freeze.", ],
      ["C02", "Frontend stack", "Next.js 16 App Router monorepo, apps/web (Frontend Architecture)", "Next.js 16 frontend + API routes full-stack (PRD Sec. 2.5)", "Next.js 16 frontend only; API always on the NestJS backend. PRD API-routes framing dropped.", ],
      ["C03", "Tenant hierarchy", "One school = one tenant; tenant owns branches (DDD, ERD)", "tenant_id AND school_id as separate JWT claims (API catalog JWT)", "Tenant = school account. JWT claims: tid, bid, ayid, uid. No separate school level. Chains = multi-branch tenants (Sec. 04).", ],
      ["C04", "Role count / names", "8 roles: Platform Admin, School Owner, Principal, Coordinator, Teacher, Accounts, Reception, Parent (PRD 7.1)", "BRC enforces Admission Counsellor, Branch Head, Branch Admin, Director, Board, Finance Head, HR...; UI lists Super Admin, School Admin, Branch Admin, managers; Security lists Super Admin, Finance User, HR User; Prisma seeds PLATFORM_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, RECEPTIONIST, LIBRARIAN", "Canonical 11 roles (Sec. 03): PLATFORM_ADMIN; SCHOOL_OWNER, PRINCIPAL, COORDINATOR, COUNSELLOR, TEACHER, ACCOUNTANT, RECEPTIONIST, HR_MANAGER, TRANSPORT_MANAGER; PARENT. Mapping table provided. DIRECTOR/BOARD approval tiers become configurable approval levels, not roles, in v1.0.", ],
      ["C05", "Admission pipeline", "Lead > Enquiry > Counselling > Application > Documents > Approval > Fee > Student (DDD 20.2); Draft > Submitted > Verified > Approved/Rejected > Enrolled (DDD aggregate)", "INQUIRY > APPLICATION > DOCUMENT_UPLOAD > PARENT_APPROVAL > BRANCH_APPROVAL > SCHOLARSHIP_APPROVAL > FEE_PAYMENT > ENROLLED (ADR-037); PRD CRM 6-stage and PRD Admissions 8-step; UI steppers", "One pipeline, five separated status domains (Sec. 10). ADR-037 human-task timers (parent confirm 7d, internal approval 3d, escalation) are adopted as workflow SLAs. PRD Offer/Acceptance becomes Enrollment statuses OFFERED/ACCEPTED. Waitlist kept (DDD Approval entity + UI).", ],
      ["C06", "Lead statuses", "NEW > CONTACTED > QUALIFIED > CONVERTED / LOST (ERD)", "Prisma adds NURTURE, APPLICATION_STARTED, DUPLICATE; OpenAPI shows New > Contacted > Interested > Visit Scheduled > ...", "NEW, CONTACTED, QUALIFIED, NURTURE, CONVERTED, LOST, DUPLICATE (ERD base + Prisma additions). OpenAPI's Interested / Visit Scheduled are funnel activities tracked as lead activities, not statuses (Sec. 10.1).", ],
      ["C07", "Student statuses", "active / transferred / graduated / archived (PRD)", "Provisional > Active > Promoted > Transferred > Archived (DDD); ACTIVE, INACTIVE, GRADUATED, TRANSFERRED, ARCHIVED (ERD); + SUSPENDED (Prisma)", "PROVISIONAL > ACTIVE > INACTIVE > GRADUATED | TRANSFERRED | WITHDRAWN > ARCHIVED. Promotion is an EVENT (history entry), not a state. SUSPENDED folds into INACTIVE with reason (Sec. 12).", ],
      ["C08", "Attendance statuses", "present / absent / late / half-day / leave (PRD)", "3 toggles present/absent/late (UI); + HOLIDAY, SUSPENDED (Prisma enum)", "5 canonical statuses: PRESENT, ABSENT, LATE, HALF_DAY, LEAVE. HOLIDAY is a calendar concept, not a per-student status; Prisma extras dropped (Sec. 15).", ],
      ["C09", "Attendance edit model", "Edit allowed with reason; original preserved in audit (PRD AC-018)", "Records immutable after submission; corrections via AdjustmentRecord (DDD)", "Same-day: teacher edits in place with mandatory reason; next-day onward: CorrectionRequest with approval (attendance:approve); all corrections append-only + audited (Sec. 15.3).", ],
      ["C10", "Money precision", "Integer cents columns *_cents (ERD 4.2, all tables)", "numeric(12,2) never integer paise (ERD 3.1 text); Prisma Decimal fields", "Integer paise (bigint) everywhere. ERD 3.1 sentence is a doc bug contradicted by every ERD table; Prisma Decimal mapped to paise at migration. Display divides by 100 (Sec. 18.6).", ],
      ["C11", "GST on fees", "Item-wise CGST+SGST @ 18% (PRD R-FIN-002)", "Pure preschool tuition GST-exempt 0%; transport/meal 5-18% per HSN (BRC R-FIN-007)", "BRC wins: 0% on tuition/activity/exam for preschool; auxiliary services taxed per HSN as configured. PRD 18% flat dropped (Sec. 18.5).", ],
      ["C12", "Late fee", "Flat INR 100/day capped INR 1,000 or 5% (DDD)", "Slabs: 1-7d 0; 8-30d INR 100; 31-60d INR 500; >60d INR 1,000 + service hold (BRC R-FIN-002)", "BRC slab model, configurable per tenant via late_fee_rule (grace 7d default). DDD flat model dropped. >60d service hold requires Principal approval (Sec. 18.4).", ],
      ["C13", "Refund approval", "Principal <= INR 5k; Owner > INR 5k; TAT <= 7 days (PRD)", "Branch Admin <= 5k; Branch Head <= 25k; Director > 25k; 14 working days (BRC R-APR-002); 2-tier > INR 5k + 90-day window (DDD)", "BRC matrix mapped to canonical roles: Accountant initiates; PRINCIPAL approves <= INR 5,000; SCHOOL_OWNER approves <= INR 25,000; OWNER+finance committee above; TAT 14 working days; eligibility window 90 days (RECOMMENDED merge of DDD). (Sec. 18.4)", ],
      ["C14", "Observation frequency", ">= 3 per child per week (PRD BR-009)", ">= 2 per student per week (DDD KPI); >= 1 per child per week with system alert (BRC R-ACD-004)", "Hard minimum 1/week (BRC, system-enforced alert); operational target 2/week (DDD KPI on dashboards); 3/week aspirational only (Sec. 16.3).", ],
      ["C15", "Observation photos", "max 10 photos, 5 MB each (PRD)", "max 5 attachments, 5 MB each (DDD)", "5 attachments, 5 MB each (stricter, mobile-first). (Sec. 16.2)", ],
      ["C16", "Report card approval", "Teacher review > Principal approval, always (PRD, DDD)", "Coordinator alone for Playgroup/Nursery; Coordinator+Principal for Jr/Sr KG (BRC R-ACD-010)", "Coordinator quality review then Principal sign-off for ALL classes (PRD/DDD win; single invariant, no class-conditional logic). (Sec. 16.4)", ],
      ["C17", "Fee reminder cadence", "D-3, due date, D+7 (PRD)", "D-7 Push, D-3 Push+SMS, overdue Push+SMS+Email+WhatsApp (BRC R-NOT-001)", "BRC cadence (D-7, D-3, overdue+); add on-due-date reminder as RECOMMENDED. (Sec. 19.3)", ],
      ["C18", "Message response SLA", "<= 4 hours (PRD BR-002)", "2 hours in school hours; next working day 10 AM otherwise (BRC R-COM-001)", "BRC time-aware SLA wins. (Sec. 19.3)", ],
      ["C19", "Response envelope", "{ success, data, meta{page,pageSize,total,hasMore} } (API catalog)", "Unwrapped resources + { data, meta{size,hasNext} } (OpenAPI); flat {success, errorCode, ...} (Backend TD)", "Wrapped envelope everywhere: { success, data, error{code,message,field,details[]}, meta{page,pageSize,total,totalPages,hasMore}, traceId }. OpenAPI to be regenerated from this. (Sec. 26.2)", ],
      ["C20", "Validation HTTP code", "422 (Backend TD, Engineering Standards)", "400 (Test Strategy API examples)", "422 for DTO/semantic validation; 400 for malformed JSON; 409 conflicts; 403 permission. (Sec. 26.3)", ],
      ["C21", "Permission grammar", "students:create colon (Backend TD, ADR-005)", "STUDENT_READ (Frontend); STUDENT.READ (Security); students.read (Eng Standards)", "module:action lowercase colon (Sec. 24.2). Frontend consumes uppercase transform generated from the same source.", ],
      ["C22", "Concurrent sessions", "Max 3 (Frontend)", "Max 5 (Security)", "5 per user, oldest revoked (Security wins). (Sec. 05.5)", ],
      ["C23", "MFA factors", "SMS OTP rejected as insecure (ADR-072 decision)", "SMS OTP 6-digit listed/enrolled (ADR-072 UI + Security Sec. 7)", "TOTP mandatory for staff privileged roles; SMS OTP allowed only for Parent accounts; step-up MFA for high-risk operations. (Sec. 05.6)", ],
      ["C24", "Password policy", "Min 8, no composition rules, NIST (ADR-075 decision)", "Min 12 + composition + history checks (ADR-075 UI; Security Sec. 5.2)", "Min 12 with upper/lower/digit/symbol, last-5 reuse block, breach check; Argon2id. (Sec. 05.6)", ],
      ["C25", "Invoice mutability", "Issued invoices NEVER updated; corrections via CreditNote (Prisma)", "PATCH /finance/invoices/{id} (draft only) (OpenAPI)", "Immutable after ISSUE; PATCH allowed only while DRAFT; corrections via CreditNote/Refund. (Sec. 18.3)", ],
      ["C26", "Bounded context count", "13 (PRD) vs 8 (DDD) vs 12 (ADR-005) vs 14 (UI)", "14 modules with API counts (Backend TD; Frontend)", "Canonical 14 modules (Sec. 23.1, Sec. 27.1): identity, crm, admissions, student, academics, attendance, communication, finance, inventory, hr, administration, reports, settings, platform.", ],
      ["C27", "Rule ID universe", "DDD cites R-ADM-xxx, R-STD-xxx, R-DG-xxx, R-PLT-012, R-FIN-022 which do not exist in BRC; ~15 IDs reused with different meanings", "BRC defines 176 rules across 12 categories", "BRC v1.0 rule IDs are the only authoritative IDs. DDD citations to non-existent IDs are marked void; re-mapping table to be issued with BRC v1.1 (Sec. 31, OD-9).", ],
      ["C28", "Seeded platform roles", "PLATFORM_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, PARENT, ACCOUNTANT, RECEPTIONIST, LIBRARIAN (Prisma seeds)", "Security/TS seed: Super Admin, School Owner, Finance User, HR User, Student...", "Prisma seed set is the implementation baseline; extended per D3: add COORDINATOR, COUNSELLOR, HR_MANAGER, TRANSPORT_MANAGER; SCHOOL_ADMIN folds into SCHOOL_OWNER delegation; LIBRARIAN deferred to v1.1 (inventory module).", ],
      ["C29", "PK generation", "uuid_generate_v7 (ERD)", "gen_random_uuid / uuid() v4 (Prisma, OpenAPI)", "UUID v7 for new tables (time-sortable, index-friendly); existing v4 values kept. (Sec. 27.2)", ],
      ["C30", "Audit log shape", "user_id, action, module, entity, entity_id, old/new_values, ip, user_agent, request_id (ERD)", "id, tenantId, entityType, entityId, action, oldValue, newValue, performedBy (Prisma); + role_snapshot, hash_chain (Security)", "Superset record defined in Sec. 22.2 including role_snapshot, ip, user_agent, request_id, reason, hash_chain; Prisma model extended.", ],
      ["C31", "AI persistence", "5 AI endpoints (API catalog); feature flag ai.observations.enabled (ERD)", "Zero AI tables in ERD/Prisma; ADR-148 AI Assistant referenced but absent from the doc set", "New ai_insight + ai_usage tables with review states added to the canonical schema; ADR-148 to be authored (Sec. 20.4, Sec. 31).", ],
      ["C32", "Domain framing", "Preschool OS: Playgroup/Nursery/LKG/UKG, age 1.5-6 (PRD/BRC)", "K-12 framing: grade-10, gradebook, transcripts, Class Grade 1-12 (ADR Vol 3-4, Prisma Class)", "Preschool framing wins: programs Playgroup, Nursery, LKG, UKG, Daycare. Prisma Class model remapped to program/classroom semantics; K-12 vocabulary in ADR Vol 3-4 marked as template artifact. (Sec. 27.3)", ],
      ["C33", "Number formats", "Invoice INV-YYYY-NNNNN unique per school per FY (ERD); invoice INV-{BRANCH}-{FY}-{SEQ} (BRC)", "student_code STU-YYYY-NNNNN (ERD) vs admissionNo ABC-0001 (Prisma)", "Invoice: unique per school per FY (ERD wins). Receipt: unique per branch per FY (fee_receipt_counter). Student admission number: STU-YYYY-NNNNN unique per tenant. Application: APP-YYYY-NNNNN. (Sec. 18.3, Sec. 11)", ],
      ["C34", "Webhook events", "admission.approved, fee.paid, attendance.marked, invoice.generated, student.promoted (API catalog)", "student.admitted, fee.paid, attendance.marked, invoice.generated, report-card published (OpenAPI)", "Merged set of 7: admission.approved, student.admitted, fee.paid, invoice.generated, attendance.marked, student.promoted, reportcard.published. (Sec. 26.5)", ],
    ],
    [6, 14, 27, 27, 26],
    { cellSize: 18 }
  ));

  out.push(h2("2.3 What Is Duplicated"));
  out.push(...bullets([
    "Admission pipelines: defined 4+ times (PRD Marketing & CRM, PRD Admissions, DDD state machine, DDD aggregate invariant, ADR-037 workflow YAML, UI steppers). Canonical single pipeline in Sec. 10.",
    "Onboarding concepts appear as three unrelated things: PRD FR-054 tenant onboarding, UI M01 first-login wizard, UI M11 tenant creation stepper. Reunified in Sec. 06-09.",
    "Two communication data models: ERD announcement/chat_room family vs Prisma Message/Conversation family. One model ruled in Sec. 27.3.",
    "Two finance models: ERD fee_plan/fee_installment/invoice_items vs Prisma FeeStructure/Invoice/InvoiceLineItem. One model ruled in Sec. 27.3.",
    "Refund, late-fee and GST policies each defined 2-3 times across PRD, BRC and DDD with different numbers. Single rulings C11-C13.",
  ]));

  out.push(h2("2.4 What Is Missing"));
  out.push(...bullets([
    "Growth Passport: the term is used downstream but defined nowhere (no entity, no flow, no permission). Ruled in Sec. 17.",
    "Parent lifecycle: no source defines when a parent account is created, invited, activated or deactivated. Defined in Sec. 13.",
    "School/tenant status lifecycle: Prisma has PENDING_ACTIVATION, DDD has Trial>Active>Suspended>Offboarded>Archived; no document unifies them. Ruled in Sec. 06.",
    "Invitation and first-login password setup for staff and owners: absent everywhere (closest: StaffOnboarded event). Defined in Sec. 06.5 and Sec. 14.",
    "AI persistence and AI review workflow: endpoints exist, no tables, no states. Defined in Sec. 20.4.",
    "Account activation / suspension state machine for users: fragments only (ERD UserStatus, Security lockout). Ruled in Sec. 25.2.",
    "Transport: PRD defers to v1.1+, but DDD/UI/BRC ship full transport context and rules. v1.0 scope ruled in Sec. 31 (OD-4).",
  ]));

  out.push(h2("2.5 What Is Ambiguous"));
  out.push(...bullets([
    "Who can approve what: BRC uses Branch Head / Director / Board; PRD uses Principal / Owner. Mapped to canonical roles in Sec. 24.4.",
    "Whether Coordinator is a distinct role or a Principal duty (PRD has Coordinator; Security/TS seed does not). Ruled as distinct optional role, Sec. 03.3.",
    "Whether DELETE on students hard-deletes: API catalog offers DELETE /students (soft-delete 7y DPDP); UI shows Archive; DDD forbids app hard deletes. Ruled in Sec. 12.4.",
    "Whether invoice numbering is per school or per branch (C33). Ruled per school; receipts per branch.",
    "Whether the parent app is a separate mobile app or responsive web: FA scopes React Native as future; PRD calls parent app phone-first. Ruled in Sec. 05.2 (D1).",
  ]));

  out.push(h2("2.6 What Needs A Product Decision"));
  out.push(p("Eleven decisions cannot be resolved from the sources alone because they are genuine product choices, not inconsistencies. They are registered with options and recommendations in Sec. 31 (Open Decisions) and summarized here: transport in/out of v1.0; observation frequency target; refund eligibility window; invoice numbering scope; Growth Passport v1.0 composition sign-off; AI vendor set (Z.ai GLM primary + OpenAI reserve vs adding Anthropic); MFA factor set for parents; role naming for the finance function (ACCOUNTANT vs Finance User); GST configuration surface per tenant; custom roles per tenant in v1.0 or v1.1; and the BRC rule-ID reissue."));

  // ================= 03. CORRECTED ROLE ARCHITECTURE =================
  out.push(h1("03. Corrected Role Architecture"));
  out.push(p("The sources disagree on how many roles PreOne has and what they are called. The PRD declares eight primary roles; the BRC operationally enforces at least fifteen more; the UI document grants modules to Super Admin, School Admin, Branch Admin and various managers; the Security Architecture lists eight different ones; the ERD user_type has six; the Prisma schema seeds eight different codes. This section ends that drift. The canonical model has exactly eleven roles in three levels, and every role name found anywhere in the sources maps onto one of them. Role, Permission, User, Tenant and Branch are distinct concepts; their separation is defined in Sec. 24.1."));

  out.push(h2("3.1 Canonical Role Hierarchy"));
  out.push(cap("Table 3-1: Canonical roles (11)"));
  out.push(tbl(
    ["Level", "Role code", "Role name", "Purpose", "Primary surface"],
    [
      ["PLATFORM", "PLATFORM_ADMIN", "Platform Admin", "Operates PreOne SaaS: creates tenants, activates schools, manages subscriptions, platform flags, cross-tenant audit", "Platform console"],
      ["SCHOOL", "SCHOOL_OWNER", "School Owner", "Business owner of the school tenant; owns settings, approvals above Principal tier, finance oversight", "Admin portal (desktop)"],
      ["SCHOOL", "PRINCIPAL", "Principal", "Academic + operational head: admissions approval, attendance oversight, staff coordination, communication approvals", "Admin portal + tablet"],
      ["SCHOOL", "COORDINATOR", "Academic Coordinator", "Multi-class academic supervision: lesson plan review, observation quality review, class-level broadcasts", "Admin portal + tablet"],
      ["SCHOOL", "COUNSELLOR", "Admission Counsellor", "Owns CRM leads and admission applications up to verification; cannot grant final admission approval", "Admin portal"],
      ["SCHOOL", "TEACHER", "Teacher", "Classroom caregiver: attendance marking, activities, observations, daily reports, class communication", "Tablet-first"],
      ["SCHOOL", "ACCOUNTANT", "Accountant", "Fee plans, invoices, payments, receipts, refunds initiation, finance reports", "Admin portal (desktop)"],
      ["SCHOOL", "RECEPTIONIST", "Receptionist", "Front desk: walk-in lead capture, visitor log, gate pass, enquiry intake", "Admin portal"],
      ["SCHOOL", "HR_MANAGER", "HR Manager", "Staff records, payroll runs, leave approval, staff documents", "Admin portal"],
      ["SCHOOL", "TRANSPORT_MANAGER", "Transport Manager", "Routes, vehicles, drivers, transport attendance (v1.1 feature-flagged)", "Admin portal"],
      ["PARENT", "PARENT", "Parent", "Child timeline, fees view + payment, chat with school, announcements, consent management", "Parent app (phone-first)"],
    ],
    [12, 20, 18, 38, 12]
  ));

  out.push(h2("3.2 Mapping Of Every Source Role Name"));
  out.push(p("Every role name found in any source document maps to exactly one canonical role. Names that appear in operational rules but not in role tables (Branch Head, Branch Admin, Director, Board, Finance Head, Center Head) are mapped below; where the mapping is a product simplification it is flagged."));
  out.push(cap("Table 3-2: Source role name to canonical role mapping"));
  out.push(tbl(
    ["Source name (doc)", "Canonical role", "Note"],
    [
      ["Super Admin (UI 3.1, Security 8.2)", "PLATFORM_ADMIN", "Name unified; two names for one concept in sources"],
      ["Platform Admin (PRD 7.1)", "PLATFORM_ADMIN", "—"],
      ["School Owner (PRD)", "SCHOOL_OWNER", "—"],
      ["Owner (BRC review list)", "SCHOOL_OWNER", "—"],
      ["Branch Head (BRC)", "PRINCIPAL", "Single-campus equivalent; multi-branch chain keeps Principal per branch"],
      ["School Admin (UI, Prisma SCHOOL_ADMIN)", "SCHOOL_OWNER", "Delegated admin privileges via role bundle, not a separate role"],
      ["Coordinator (PRD), Academic Coordinator (UI)", "COORDINATOR", "Optional role; small schools may leave unassigned (duties fall to Principal)"],
      ["Admission Counsellor (BRC), Sales (UI M02)", "COUNSELLOR", "—"],
      ["Accounts / Accounts Team (PRD, BRC), Accountant (DDD, Prisma)", "ACCOUNTANT", "Finance Head (BRC) maps to SCHOOL_OWNER finance approvals in v1.0"],
      ["Reception (PRD, BRC)", "RECEPTIONIST", "—"],
      ["HR (BRC), HR Manager (UI), HR User (Security/TS)", "HR_MANAGER", "—"],
      ["Transport Manager (UI), Transport In-charge (BRC)", "TRANSPORT_MANAGER", "Feature-flagged v1.1"],
      ["Parent (all docs)", "PARENT", "—"],
      ["Student (Security 8.2 list)", "not a login role in v1.0", "Students are data subjects; student portal deferred (RECOMMENDED)"],
      ["Director / Board (BRC approvals)", "approval tiers, not roles", "Modeled as approval level 3/4 in approval workflows (Sec. 10.4)"],
      ["Center Head (DDD role examples)", "PRINCIPAL", "One-off naming drift in DDD"],
      ["Kitchen In-charge / Nap Supervisor / Health Attendant / Security / IT / Care Staff (BRC)", "operational duty tags, not v1.0 roles", "Handled as staff designations with task checklists, not RBAC roles"],
      ["TEACHER/ADMIN/SUPPORT legacy hard-coded (ADR-064)", "replaced by canonical set", "ADR-064 itself mandates the system+custom catalog that makes this possible"],
    ],
    [34, 22, 44]
  ));

  out.push(h2("3.3 Per-Role Authority Profile"));
  out.push(p("The table below defines, for every canonical role, the attributes requested by the audit brief: who creates the account, who deactivates it, where it logs in, and its authority across the ten permission families. The full action-level matrix is in Sec. 24.3; this table is the role-level contract."));
  out.push(cap("Table 3-3: Role authority profile (C=create, R=read, U=update, D=delete-soft, A=approve, F=financial ops, S=student ops, M=messaging, RP=reports, AI=AI use)"));
  out.push(tbl(
    ["Role", "Created by", "Deactivated by", "Login area", "Permissions summary"],
    [
      ["PLATFORM_ADMIN", "Seeded by platform bootstrap", "Another PLATFORM_ADMIN", "Platform console", "All modules cross-tenant (audited); no routine student data access; tenant lifecycle full; platform flags full; audit visibility full incl. security events"],
      ["SCHOOL_OWNER", "PLATFORM_ADMIN invites", "PLATFORM_ADMIN / self", "Admin portal", "C/R/U on school settings, staff, fee structures; A on refunds > Principal tier and discounts > 15%; F full oversight; S full; M broadcast to all; RP full; AI full; audit full (school scope)"],
      ["PRINCIPAL", "SCHOOL_OWNER invites", "SCHOOL_OWNER", "Admin portal + tablet", "C/R/U on students, classes, timetables; A on admissions, corrections, incidents; F read + refund initiate; S full; M broadcasts + announcements approval; RP school scope; AI full; audit read"],
      ["COORDINATOR", "SCHOOL_OWNER / PRINCIPAL", "SCHOOL_OWNER / PRINCIPAL", "Admin portal + tablet", "R/U academics (lesson plans, timetables); A on observation quality flags; S R/U in assigned classes; M class-level broadcast; RP academic scope; AI use (draft + review)"],
      ["COUNSELLOR", "SCHOOL_OWNER / PRINCIPAL", "SCHOOL_OWNER / PRINCIPAL", "Admin portal", "C/R/U on leads, enquiries, applications, documents; U application until SUBMITTED lock; A none (verify only); F none; S create-on-convert only; M lead follow-ups; RP funnel scope; AI lead-score assist"],
      ["TEACHER", "SCHOOL_OWNER / PRINCIPAL", "SCHOOL_OWNER / PRINCIPAL / HR_MANAGER", "Tablet-first", "C/R/U attendance (own class, same-day), activities, observations, daily reports; A none; F none; S read own class; M class parents chat; RP own class; AI draft tools only"],
      ["ACCOUNTANT", "SCHOOL_OWNER", "SCHOOL_OWNER", "Admin portal", "C/R/U fee plans, invoices, payments, receipts; A refunds <= tier 1 initiation; F create invoices/payments/refund requests; S read fee-relevant student fields; M fee reminders (system-templated); RP finance scope; AI none on PII"],
      ["RECEPTIONIST", "SCHOOL_OWNER / PRINCIPAL", "SCHOOL_OWNER / PRINCIPAL", "Admin portal", "C leads (walk-in), visitors, gate passes; R student directory (contact fields); A none; F receipt reprint only; S read contact; M none beyond templates; RP visitor scope; AI none"],
      ["HR_MANAGER", "SCHOOL_OWNER", "SCHOOL_OWNER", "Admin portal", "C/R/U staff, payroll runs, leaves; A leave requests <= tier; F payroll execute (Owner countersign); S none; M staff announcements; RP HR scope; AI none"],
      ["TRANSPORT_MANAGER", "SCHOOL_OWNER", "SCHOOL_OWNER", "Admin portal", "C/R/U routes, vehicles, drivers, route-student mapping; R transport attendance; M transport delay alerts (triggered); RP transport scope; AI none (v1.0)"],
      ["PARENT", "System, at admission approval", "PRINCIPAL / PLATFORM_ADMIN", "Parent app", "R own children only (timeline, fees, attendance, announcements); U own profile + communication preferences; C leave requests, fee payments (own), consents; M chat with own child's teachers; AI none"],
    ],
    [16, 15, 15, 12, 42],
    { cellSize: 18 }
  ));
  out.push(note("CANONICAL RULE", "No school-level role can create, deactivate or delete a PLATFORM_ADMIN, and no PLATFORM_ADMIN performs routine operational data entry inside a tenant (their writes are limited to tenant lifecycle and configuration, all audited). Custom roles per tenant are RECOMMENDED for v1.1 using the system+custom catalog of ADR-064, with the no-escalation guard: a custom role can never grant a permission absent from the system catalog.", "info"));

  // ================= 04. CORRECTED TENANT ARCHITECTURE =================
  out.push(h1("04. Corrected Tenant Architecture"));
  out.push(p("PreOne is a multi-tenant SaaS. The sources agree that tenant isolation is non-negotiable (ADR-001 principle 1) but disagree on the levels between platform and student. The API document assumes three levels (tenant, school, branch); the ERD anchors everything on school; the DDD says one school equals one tenant. This section fixes the canonical hierarchy and assigns every data category to exactly one ownership level, so that scoping, RLS policies and UI scope-switchers can be generated mechanically."));

  out.push(h2("4.1 Canonical Hierarchy"));
  out.push(flow([
    "PREONE PLATFORM",
    "  |  platform-level: subscription plan catalog, global config, feature flags, tenant registry",
    "  v",
    "SCHOOL TENANT  (Tenant = the school's account; 1 tenant = 1 school business)",
    "  |  tenant-level: branding, settings, staff/users, roles, fee structures, subscription, theme",
    "  v",
    "BRANCH  (physical campus; chains have many, single-campus schools have exactly one)",
    "  |  branch-level: timings, classrooms, local inventory, visitors, branch announcements",
    "  v",
    "ACADEMIC YEAR  (tenant-level entity; partitions attendance, invoices, promotions)",
    "  |  year-level: sessions/terms, calendars, fee cycles, report cards",
    "  v",
    "CLASS / SECTION  (branch + academic-year scoped)",
    "  |  class-level: timetables, attendance sheets, observation groups",
    "  v",
    "STUDENT  (branch + class + academic-year scoped; globally unique identity)",
    "     student-level: profile, guardians, documents, observations, growth passport, invoices",
  ]));
  out.push(p("Two consequences follow. First, the separate school level that appears in the API catalog JWT (tenant_id plus school_id) is collapsed: the tenant IS the school account. Second, a chain is not a special object; it is one tenant with many branches, which is exactly what the ERD and Prisma already model, and Prisma's optional parentTenantId self-reference is retained only to support future franchise groupings for reporting, never for data inheritance."));

  out.push(h2("4.2 Where Everything Belongs"));
  out.push(cap("Table 4-1: Data ownership by level"));
  out.push(tbl(
    ["Data category", "Owning level", "Rationale"],
    [
      ["Subscription, plan, billing to PreOne", "Platform > Tenant record", "Platform bills the tenant, never the branch"],
      ["Branding, theme, notification prefs", "Tenant (branch may override subset)", "UI theme cascade: platform > subscription > school > branch > user"],
      ["Users (staff) and role assignments", "Tenant; assignment scope = TENANT, BRANCH or CLASS", "One person can serve two branches of the same tenant with two scoped assignments"],
      ["Parents / guardians", "Tenant", "A guardian can be linked to multiple students across branches of the same tenant"],
      ["Fee structures / fee plans", "Tenant (branch may scope applicability)", "ERD fee_plan.branch_id NULL = school-wide"],
      ["Academic years / sessions / calendars", "Tenant", "Promotion, fee cycles and attendance partitioning all key on it"],
      ["Programs, classes, sections", "Branch + academic year", "A class exists at a campus, in a year"],
      ["Students", "Branch (current), tenant (identity)", "current_branch_id on student; history preserves every branch"],
      ["Attendance, observations, daily logs", "Branch + class + academic year", "High-volume, partitioned by academic year (ADR-046)"],
      ["Invoices, payments, receipts", "Tenant identity, branch counter for receipts", "Invoice number per school per FY; receipt counter per branch per FY"],
      ["Transport", "Branch (v1.1 feature-flagged)", "Routes start at a campus"],
      ["Documents (student/staff)", "Tenant (storage prefix tenantId/studentId)", "S3 keys partitioned by tenant per Security Sec. 10"],
      ["Communication (chats, broadcasts)", "Tenant; audience scoped to branch or class", "Broadcast audience enum already models ALL_PARENTS / BRANCH_PARENTS / CLASS_PARENTS"],
      ["AI insights", "Tenant, derived", "AI reads tenant-scoped data only; outputs are tenant rows"],
      ["Audit logs", "Tenant, mirrored to platform SIEM", "Immutable, hash-chained, 7-year retention"],
    ],
    [26, 26, 48]
  ));

  out.push(h2("4.3 Multi-Tenant Isolation Contract"));
  out.push(p("Isolation is enforced in depth, and every layer is independently testable. The contract below merges BRC R-PLT-001/006/008, ADR-043/044/045 and the Backend TD Sec. 21 into one normative list; where sources differed on layer names, the union is taken because they are complementary, not contradictory."));
  out.push(...bullets([
    "Layer 1 - JWT: every token carries tid (tenant), bid (active branch), ayid (active academic year), uid, roles[], permissionsVersion. No query may run outside the token scope.",
    "Layer 2 - Request guard: PermissionsGuard resolves effective permissions from cache (60-second freshness budget) and rejects 403 before any data access; TENANT_MISMATCH on header/claim conflict returns 403, and cross-tenant probes return 404 to avoid existence leaks.",
    "Layer 3 - ORM middleware: Prisma middleware auto-injects tenantId on every query and blocks unscoped queries; soft-delete filter (deletedAt null) auto-applied.",
    "Layer 4 - PostgreSQL RLS: row-level security policies compare tenant_id against current_setting(app.tenant_id); bypass role exists only for the reporting service account and is logged via event trigger.",
    "Layer 5 - Storage and cache: S3 keys prefixed tenants/{tenantId}/...; Redis keys prefixed tenant_id; search indices per tenant; theme and settings caches keyed per tenant.",
    "Exception path: PLATFORM_ADMIN cross-tenant access requires explicit impersonation with reason, renders a persistent Viewing-as-Tenant banner, and writes an audit record (BRC R-PLT-001 exception clause).",
  ]));
  out.push(note("CANONICAL RULE", "A user authenticated under tenant A can never read or write tenant B data through any API, report, export, webhook payload or AI insight. Platform-level analytics run only on anonymized aggregates (k >= 10) per BRC R-DAT-012.", "info"));

  return out;
};
