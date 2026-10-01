// content-part5.js — Sections 20-24
module.exports = function build(H) {
  const { h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow } = H;
  const out = [];

  // ================= 20. AI CENTER FLOW =================
  out.push(h1("20. AI Center Flow"));
  out.push(p("AI in PreOne is an intelligence layer that reads validated operational data and proposes assistance; it is never the system of record and never writes core records. The sources name six assistant capabilities (observation assistant, daily sheet auto-draft, report-card paragraph generation, fee-default prediction, parent reply composer, growth milestone prediction), the API catalog exposes five endpoints with quotas, and the DDD defines the AI Gateway with tenant quotas, audit and safety filters. What is missing everywhere is persistence and the human-review state machine; this section defines both."));
  out.push(h2("20.1 Canonical AI Pipeline"));
  out.push(flow([
    "OPERATIONAL DATA (attendance, observations, fees, admissions, milestones - tenant-scoped)",
    "  v",
    "VALIDATION LAYER (only consented, non-archived, validated records; PII minimized per purpose)",
    "  v",
    "AI GATEWAY (quota per tenant per feature; cost tracking; safety filters; provider ACL)",
    "  |  providers: Z.ai GLM primary; OpenAI reserve; vision model for photo tasks (school-internal)",
    "  v",
    "AI INSIGHT / DRAFT (artifact persisted in ai_insight with provenance)",
    "  v",
    "HUMAN REVIEW (accept / edit / reject by authorized role; rejection stores feedback)",
    "  v",
    "ACTION APPLIED (becomes normal operational record, author = the human who accepted)",
    "  v",
    "AUDIT (ai_insight id, model, version, prompt hash, reviewer, decision - full trail)",
  ]));
  out.push(h2("20.2 Capability Catalog And Review Requirements"));
  out.push(cap("Table 20-1: AI capabilities (merged PRD + API catalog + BRC)"));
  out.push(tbl(
    ["Capability", "Input", "Output", "Human review", "Quota (per tenant/day)"],
    [
      ["Observation assistant", "Activity context + child + outcome tags", "Draft observation text", "MANDATORY teacher accept/edit/reject (ai_draft until then)", "1,000 (mini model)"],
      ["Daily sheet auto-draft", "Day's operational logs (meals, nap, mood)", "Draft daily report", "MANDATORY teacher confirm", "Included in observation quota"],
      ["Report card narrative", "Milestones + observations + attendance", "Paragraph draft", "MANDATORY teacher review + Principal sign-off chain", "200"],
      ["Parent reply composer", "Incoming parent message + context", "Draft reply", "MANDATORY staff send decision", "500"],
      ["Lesson plan draft", "Program + theme + outcomes", "Plan draft", "MANDATORY teacher edit", "50"],
      ["Fee default prediction", "Payment history + attendance (aggregate)", "Risk score + ranked list", "Advisory only; no automatic action; Accountant/Principal view", "20"],
      ["Attendance risk / milestone delay alerts", "Trend aggregates", "Alert + confidence", "Advisory; routes to Principal dashboard", "20"],
      ["Growth narrative (passport)", "Passport projections", "Narrative draft", "MANDATORY teacher + Principal (report chain)", "100"],
    ],
    [20, 24, 20, 24, 12]
  ));
  out.push(h2("20.3 Classification Of Generated Content"));
  out.push(...bullets([
    "AI-generated: any artifact with ai_draft=true and no reviewer action yet; visually badged AI DRAFT everywhere it renders; excluded from reports and parent surfaces.",
    "Human-approved: AI artifact after accept/edit; provenance retained (model, version, reviewer, timestamp) forever; author of record is the human.",
    "System-generated: deterministic content (summaries, aggregations, computed percentages); labeled system, no review needed, still auditable.",
  ]));
  out.push(h2("20.4 Persistence And Guardrails"));
  out.push(...bullets([
    "New tables (RECOMMENDED, gap C31): ai_insight (id, tenant_id, feature, model, model_version, prompt_hash, input_refs, output_text, status DRAFT|ACCEPTED|EDITED|REJECTED, reviewer_id, reviewed_at, related_entity_type, related_entity_id) and ai_usage (tenant_id, feature, tokens_in, tokens_out, cost_paise, latency_ms, created_at) for the AI Gateway dashboard (tokens, calls, latency, cost).",
    "Never-write list: AI cannot modify student master data, attendance rows, invoices, payments, approvals, roles or permissions; it can only create drafts or advisory insights (audit RULE 10).",
    "Consent: child media AI tasks require media-use consent; non-consenting children are excluded or face-blurred (BRC R-OPS-016); training on tenant data is opt-in and k-anonymized (k >= 10).",
    "Anomaly detection on auth/permission/PII access remains a SECURITY capability (Security Sec. 14) - deterministic rules first, ML later; same audit trail.",
  ]));

  // ================= 21. REPORTING FLOW =================
  out.push(h1("21. Reporting Flow"));
  out.push(p("Reporting consumes validated operational data through a read path that never touches write endpoints. The canonical pipeline and the report catalog merge the PRD's five report categories with the UI module list and the reporting database strategy of ADR-060 (replica for real-time, materialized views for dashboards, OLAP for cross-tenant analytics)."));
  out.push(flow([
    "DATA (operational stores + read replicas)",
    "  v  REPORT QUERY (parameterized, whitelisted sorts/filters)",
    "FILTER (scope: tenant > branch > class > year; role-based data scope R-RPT-001)",
    "  v  AGGREGATION (materialized views hourly; real-time via replica < 5 s)",
    "REPORT (category, period, scope)",
    "  v  EXPORT / VIEW / SHARE (PDF/Excel/CSV via Export Engine; scheduled email; signed links 24 h)",
    "     every export: audit LOGGED (actor, rows, filters) per DPDP data-export rule",
  ]));
  out.push(cap("Table 21-1: Canonical report catalog"));
  out.push(tbl(
    ["Category", "Reports", "Primary audience"],
    [
      ["Operational", "Daily attendance summary; late-arrival log; incident log; visitor log; staff attendance", "Principal, Coordinator"],
      ["Academic", "Milestone progress per child; observation coverage; AI acceptance rate; report card (term)", "Teachers, Parents (own child), Principal"],
      ["Financial", "Daily fee collection; defaulters list; refund summary; discount register; GST filing report; P&L summary", "Accountant, Owner"],
      ["Admissions (management)", "Lead funnel conversion; admission TAT; branch performance comparison; enrollment trend; capacity utilization", "Owner, Principal"],
      ["Compliance", "DPDP consent register; DSAR log; audit trail export; data retention status", "Owner, PLATFORM_ADMIN, Principal (read)"],
      ["Growth Passport", "Term passport PDF; milestone domain trends", "Parents, Teachers"],
    ],
    [18, 58, 24]
  ));
  out.push(...bullets([
    "Permissions: every report declares required scope; cross-tenant reports exist only on the platform console for PLATFORM_ADMIN; sensitive exports (PII, finance) need step-up MFA and are watermarked.",
    "Custom report builder (FR-049): drag-and-drop dimensions/measures over whitelisted datasets; saved reports are role-scoped; scheduled runs use the report queue with sandboxed execution.",
    "Predictive analytics (FR-050): admission conversion and fee default predictions run in the AI pipeline (Sec. 20), surfaced inside these reports with confidence display.",
  ]));

  // ================= 22. AUDIT FLOW =================
  out.push(h1("22. Audit Flow"));
  out.push(p("Audit is the strongest-consensus area of the sources and this section mostly formalizes rather than reconciles: every important mutation is auditable, the record is immutable, written in the same transaction as the business change, hash-chained, retained 7 years and queryable through a read-only console. The unified record below merges the three competing audit shapes (C30) into one superset."));
  out.push(cap("Table 22-1: Canonical audit record"));
  out.push(tbl(
    ["Field", "Type", "Notes"],
    [
      ["id", "uuid v7", "Immutable PK"],
      ["occurred_at", "timestamptz", "Server time; BRIN-indexed"],
      ["actor_id", "uuid (nullable)", "Null = system action; actors registry includes users, services, system"],
      ["actor_role_snapshot", "jsonb", "Roles + scope at action time (Security Sec. 11)"],
      ["tenant_id / branch_id", "uuid", "Scope of the action"],
      ["action", "enum", "CREATE, UPDATE, DELETE(soft), LOGIN, LOGOUT, LOGIN_FAILED, EXPORT, IMPORT, ACCESS, APPROVE, REJECT, PERMISSION_CHANGE, ERROR"],
      ["entity_type / entity_id", "string", "Polymorphic target"],
      ["old_values / new_values", "jsonb", "Diff per UPDATE; before-image for DELETE; after-image for CREATE"],
      ["reason", "text (nullable)", "Mandatory for corrections, archival, overrides, admin deletes (RECOMMENDED formalization)"],
      ["ip_address / user_agent / device_id", "inet / text / text", "From validated proxy chain"],
      ["request_id / trace_id", "string", "Correlates with logs and traces"],
      ["result", "enum", "SUCCESS | FAILURE | DENIED (denials audited with reason per PRD 7.3)"],
      ["hash_prev / hash_self", "char(64)", "SHA-256 chain per tenant; nightly verification + alert on break"],
    ],
    [24, 16, 60]
  ));
  out.push(cap("Table 22-2: Audited event catalogue (minimum set)"));
  out.push(tbl(
    ["Domain", "Events"],
    [
      ["Identity & access", "Login success/failure, logout, lockout, password change/reset, MFA enroll/revoke, session revoke, role assigned/removed, permission bundle change, invitation sent/accepted"],
      ["Tenant lifecycle", "Tenant created/activated/suspended/resumed/archived, plan changed, branch created/closed"],
      ["Admissions", "Lead created/merged/converted/lost, application submitted, document verified/rejected/resubmitted, approval decision each level, offer sent/expired, rejection+appeal"],
      ["Student", "Created, updated, class assigned, promoted, transferred (internal/external), deactivated/reinstate, withdrawn, archived, parent access granted/revoked"],
      ["Attendance", "Marked (bulk or single), same-day edit, correction requested/approved/rejected, escalation override"],
      ["Finance", "Fee plan changed, invoice issued/cancelled/written-off, payment recorded/failed, receipt issued/reprinted, refund requested/approved/processed/rejected, discount/waiver approved"],
      ["Learning", "Observation created/edited/shared, milestone assessed, portfolio published, report card generated/published, passport exported"],
      ["Communication", "Broadcast created/approved/sent, message sent (metadata), opt-out honored, template changed"],
      ["AI", "Insight generated, reviewed (accepted/edited/rejected), quota event"],
      ["System", "Config/feature-flag change, integration credential change, data export (any), DSAR request/fulfilment, retention purge"],
    ],
    [22, 78]
  ));
  out.push(...bullets([
    "Immutability: INSERT-only permissions in the audit schema; no UPDATE/DELETE grants to the application; WORM object-lock cold storage after 90 days; 7-year retention (financial 8 years per IT Act where applicable).",
    "PII discipline: audit rows mask PII fields unless actor holds unmask permission; every PII read (reveal action) is itself audited (Security PII Access Log).",
    "Query surface: /platform audit console for PLATFORM_ADMIN (all tenants, read-only) and school audit page per tenant; export = audited operation; SIEM stream via outbox for platform monitoring.",
  ]));

  // ================= 23. NAVIGATION ARCHITECTURE =================
  out.push(h1("23. Navigation Architecture"));
  out.push(p("The UI Design Philosophy defines the shell (64px sticky header with global search, notifications and profile; 240px sidebar grouped by section; mobile bottom nav of 5 items + More) but never enumerates the final menu tree, and the module lists differ across documents (13 vs 8 vs 12 vs 14). The canonical information architecture below uses the 14-module backend decomposition, grouped for humans, with role-visibility and page-type annotations. Items marked [P] are platform-console only; [S] setup-only; [R] reporting; the rest are operational."));
  out.push(h2("23.1 Final Information Architecture"));
  out.push(flow([
    "PLATFORM CONSOLE (PLATFORM_ADMIN only)",
    "  Tenants [P] > registry, create wizard, activation checklist, suspend/offboard",
    "  Subscriptions & Billing [P] | Feature Flags & Plans [P] | Platform Audit [P] | Integrations [P]",
    "",
    "ADMIN PORTAL (school roles; items filtered by role + scope)",
    "  Dashboard                (KPI tiles per role; setup-progress card until complete)",
    "  Admissions               > Leads (list, capture) | Follow-ups & Visits | Pipeline board",
    "                           > Applications | Documents queue | Waiting list",
    "  Students                 > Student list | Profiles | Attendance (view) | Fees (view)",
    "                           > Growth Passport | Documents",
    "  People                   > Parents & Guardians | Teachers & Staff | Roles (v1.1 custom)",
    "  Academics                > Programs & Classes | Timetables | Lesson plans | Report cards",
    "  Operations               > Attendance (mark/correct) | Daily log | Incidents | Visitors & gate",
    "  Finance                  > Fee structures | Invoices | Payments & receipts | Refunds",
    "                           > Discounts & scholarships | Defaulters | Finance reports [R]",
    "  Communication            > Announcements & broadcasts | Chat | Templates | Delivery logs",
    "  Growth Passport          > Child passports | Term compilation [R]",
    "  AI Center                > Drafts review queue | Insights | Usage & cost [R]",
    "  Reports [R]              > Operational | Academic | Financial | Admissions | Compliance",
    "  Setup [S]                > Academic years | Branches | Classes | Fee setup | Staff & roles",
    "                           > Approval workflow | Integrations",
    "  Settings                 > Branding | Notifications | Security (MFA, sessions) | Consents",
    "                           > Billing (PreOne) | Onboarding progress",
    "",
    "PARENT APP (PARENT only)",
    "  Home (child switcher) | Timeline & Daily report | Growth Passport | Attendance",
    "  Fees & Payments | Announcements & Events | Chat | Consents & Profile",
  ]));
  out.push(p("Role-dependent visibility follows the security rule that navigation adapts to effective permissions: a user without reports:view never sees Reports; action buttons hidden without their permission; critical items (Dashboard, Settings, Logout) can never be hidden by navigation customization. Teacher tablets default to a task-focused home (Mark attendance, Today's activities, Daily report) implemented as a dashboard layout of the same app rather than a separate build."));
  out.push(h2("23.2 Page-Level Specifications (Core Pages)"));
  out.push(p("Using the source Student Profile specification as the quality benchmark, the table below fixes route, roles, key actions, validations, primary APIs and entities for the twelve core pages. Every page follows the shared anatomy: PageHeader (title + actions), filter bar, content cards (max 6 cards + 1 table + 1 chart per screen), pagination, and standard loading (skeleton), empty (illustration + CTA), error (toast + retry + traceId) states."));
  out.push(cap("Table 23-1: Core page specifications"));
  out.push(tbl(
    ["Page (route)", "Roles", "Entry points", "Key actions", "Validations", "Primary APIs / entities"],
    [
      ["Login (/login)", "All", "Direct, guarded redirects", "Password login; OTP login (parent); forgot password", "Rate limit 5/min; lockout at 5 fails; generic errors", "POST /auth/login, /auth/refresh; user, session"],
      ["Platform Tenants (/platform/tenants)", "PLATFORM_ADMIN", "Console nav", "Create tenant (5-step wizard), activate, suspend, offboard, impersonate-with-reason", "Unique school name/email; plan valid; branch code unique", "/platform/tenants; tenant, branch, user"],
      ["Owner Onboarding wizard (/app/onboarding)", "SCHOOL_OWNER", "First login redirect", "9-step checklist (Sec. 07); resume anytime", "Step gates per Table 7-1", "settings + academics + identity APIs; academic year, classroom, staff"],
      ["Dashboard (/app/dashboard)", "All school roles", "Default landing", "KPI tiles (per role), 7-day trends, quick actions, alerts feed", "Scope filters honor branch switcher", "/dashboard aggregate; many (read-only)"],
      ["Leads (/app/admissions/leads)", "COUNSELLOR, PRINCIPAL", "Admissions nav", "Capture lead, call/WhatsApp log, schedule visit, qualify, convert, merge duplicates, lost-with-reason", "Phone unique per school; lost reason mandatory", "/crm/leads(+follow-ups, convert); lead, lead_activity"],
      ["Pipeline (/app/admissions/pipeline)", "COUNSELLOR, PRINCIPAL", "Admissions nav", "Kanban by stage (funnel projection); drag = activity log, not status change", "Stage moves validated against lead status", "/crm/leads?view=funnel; lead, lead_activity"],
      ["Applications (/app/admissions/applications)", "COUNSELLOR, PRINCIPAL, COORDINATOR", "Admissions nav", "Create (stepper), submit, upload docs, verify/reject docs, counsel log, approve/reject/waitlist per level, offer", "Checklist complete before UNDER_REVIEW; approval reason mandatory; capacity + age checks", "/admissions/applications(+documents, approve, reject); application, application_document, approval"],
      ["Student List (/app/students)", "PRINCIPAL, COORDINATOR, TEACHER (class scope), ACCOUNTANT (fee fields)", "Students nav, global search", "Filter/search/sort, bulk export (audited), archive with reason (admin)", "Export needs student:export; archive reason mandatory", "/students; student, classroom_assignment"],
      ["Student Profile (/app/students/[id])", "Same as list + PARENT (own child, app)", "List, search, timeline links", "Tabs: Overview, Attendance, Growth (passport), Fees, Documents; actions per role (edit, assign class, transfer, deactivate, archive)", "Field-level permissions (medical, Aadhaar masked); optimistic version check", "/students/{id}+ sub-resources; student, student_guardian, attendance, observation, invoice"],
      ["Attendance (/app/operations/attendance)", "TEACHER (mark own class), PRINCIPAL/COORDINATOR (view/approve)", "Operations nav, tablet home", "Mark day (bulk+override), submit, same-day edit, correction queue approve/reject", "One row/student/date; future blocked; correction reason mandatory", "/attendance/mark(+bulk, corrections); attendance, attendance_correction"],
      ["Finance - Invoices (/app/finance/invoices)", "ACCOUNTANT, SCHOOL_OWNER", "Finance nav", "Generate cycle invoices, issue, record payment (idempotent), receipt, cancel, credit note", "Draft-only PATCH; cash < 50k rule; allocations sum <= invoice balance", "/finance/invoices, /payments, /receipts; invoice, payment, receipt"],
      ["Communication - Broadcast (/app/communication)", "PRINCIPAL (school), COORDINATOR (class), OWNER", "Communication nav", "Compose (audience, channels, schedule), approval step, send, delivery/read stats", "Audience-permission matrix Table 19-1; quiet hours; WhatsApp rate cap", "/communication/announcements, /broadcasts; announcement, broadcast_log"],
      ["Settings - Security (/app/settings/security)", "All staff (self), OWNER (tenant policy)", "Settings nav", "MFA enroll, sessions list + revoke, trusted devices, password change", "Step-up MFA for sensitive ops; session cap 5", "/auth/mfa, /sessions; session, refresh_token, audit_log"],
    ],
    [20, 14, 14, 22, 14, 16],
    { cellSize: 16 }
  ));

  // ================= 24. RBAC MATRIX =================
  out.push(h1("24. RBAC Matrix"));
  out.push(p("This section defines the five distinct concepts the brief asks to separate, fixes the permission grammar, and provides the role-by-module action matrix that both the UI (menu/action visibility) and the backend (guard enforcement) consume from the same source. RBAC is primary with ABAC fallback for scope conditions (Security Sec. 8); UI filtering is an optimization, backend authorization is the truth (Frontend Sec. 10.3)."));
  out.push(h2("24.1 Concept Separation"));
  out.push(cap("Table 24-1: Concept definitions"));
  out.push(tbl(
    ["Concept", "Definition", "Example"],
    [
      ["ROLE", "Named bundle of permissions assigned to users, optionally scoped; system roles immutable, custom roles tenant-defined (v1.1) with no-escalation guard", "TEACHER, PRINCIPAL"],
      ["PERMISSION", "Atomic capability in grammar module:action; grouped into bundles; dangerous ones flagged", "students:create, attendance:approve"],
      ["USER", "An authenticated identity (staff, owner, parent); may hold multiple roles with different scopes", "Rekha (TEACHER @Branch A, CLASS Nursery-A)"],
      ["SCHOOL TENANT", "The isolation boundary owning all data, configuration and users for one school business", "Sunshine Preschool (tenant)"],
      ["BRANCH", "Physical campus inside a tenant; scoping level for assignments and data partitioning", "Sunshine - Koramangala (branch)"],
    ],
    [16, 56, 28]
  ));
  out.push(h2("24.2 Permission Grammar (resolves C21)"));
  out.push(...bullets([
    "Canonical grammar: module:action, lowercase, colon separator; action set: create, read, update, delete(soft), export, approve, mark, send, manage, execute.",
    "Module set is the 14 canonical modules (Sec. 27.1). Examples: students:create; attendance:mark; attendance:approve; finance:read; finance:execute; admissions:approve; platform:manage.",
    "Scoping suffixes are NOT part of the permission string; scope comes from the assignment (TENANT/BRANCH/CLASS) and the request context. Field-level visibility (medical, Aadhaar, salary) is a separate field-policy layer, not a permission explosion.",
    "Migration: FRONTEND STUDENT_READ = students:read; SECURITY STUDENT.READ and ENG students.read map identically; decorators unified as @RequirePermissions(...).",
  ]));
  out.push(h2("24.3 Role x Module Action Matrix"));
  out.push(p("Legend: C create, R read, U update, D delete(soft/archive), A approve, F execute/financial, X full management. Blank = no access. Scope column notes where access is narrower than tenant."));
  out.push(cap("Table 24-2: Role x module matrix (canonical)"));
  out.push(tbl(
    ["Module", "PLATFORM_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "COORDINATOR", "COUNSELLOR", "TEACHER", "ACCOUNTANT", "RECEPTIONIST", "HR_MANAGER", "TRANSPORT_MGR", "PARENT"],
    [
      ["platform", "X", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"],
      ["identity", "X (console)", "X", "R,U", "-", "-", "-", "-", "-", "C,R,U", "-", "R (self)"],
      ["crm", "R (console)", "R", "R,A(-)", "R", "X", "-", "-", "C,R", "-", "-", "-"],
      ["admissions", "R (console)", "R", "A", "R", "C,R,U", "-", "-", "C,R", "-", "-", "R (own)"],
      ["student", "R (console)", "X", "X", "R,U (scope)", "C,R,U (pre-enroll)", "R (class)", "R (fee fields)", "R (contact)", "-", "-", "R (own)"],
      ["academics", "-", "R", "X", "X", "-", "R,U (own class)", "-", "-", "-", "-", "R (own)"],
      ["attendance", "R (console)", "R", "R,A", "R,A (scope)", "-", "C,R,U (own, same-day)", "-", "-", "-", "R (v1.1)", "R (own)"],
      ["communication", "-", "X", "X", "C,R,U (class)", "R,U (leads)", "C,R,U (class)", "R (fee notices)", "-", "R,U (staff)", "R,U (transport)", "R (own), U prefs"],
      ["finance", "R (console)", "X", "R + refund initiate", "-", "-", "-", "X", "R + receipt reprint", "R (payroll)", "R (transport fees)", "R (own), C (pay)"],
      ["inventory", "-", "R", "R", "-", "-", "R (class materials)", "R", "-", "-", "-", "-"],
      ["hr", "-", "X", "R", "-", "-", "R (self)", "-", "-", "X", "-", "-"],
      ["administration", "R (console)", "X", "C,R,U", "R", "-", "-", "-", "C (visitors)", "R", "R (vehicles)", "-"],
      ["reports", "X (cross-tenant)", "X", "X (school)", "R (academic)", "R (funnel)", "R (own class)", "X (finance)", "R (visitors)", "X (HR)", "R (transport)", "R (own child)"],
      ["settings", "X (platform)", "X", "R,U (academic)", "-", "-", "U (self)", "U (self)", "U (self)", "U (self)", "U (self)", "U (own prefs)"],
    ],
    [12, 9, 8, 9, 9, 8, 9, 9, 8, 9, 5, 5],
    { cellSize: 14 }
  ));
  out.push(h2("24.4 Approval Authority Map"));
  out.push(cap("Table 24-3: Approval workflows and tier owners"));
  out.push(tbl(
    ["Approval", "Tier 1", "Tier 2", "Tier 3+", "Source"],
    [
      ["Admission decision", "PRINCIPAL", "COORDINATOR (academic level)", "OWNER (finance-waiver level)", "ERD approval levels 1-4 mapped to canonical roles"],
      ["Refund", "PRINCIPAL <= 5k", "SCHOOL_OWNER <= 25k", "OWNER + finance committee > 25k", "BRC R-APR-002 remapped (C13)"],
      ["Discount stack", "ACCOUNTANT <= 5%", "PRINCIPAL 5-15%", "SCHOOL_OWNER 15-25%; committee > 25%", "BRC R-APR-001"],
      ["Fee waiver", "PRINCIPAL <= 25%", "SCHOOL_OWNER 25-75%", "committee > 75% or > 50k", "BRC R-APR-007"],
      ["Attendance correction (past date)", "COORDINATOR", "PRINCIPAL (>= 7 days old)", "-", "Canonical (Sec. 15)"],
      ["Announcement to all parents", "PRINCIPAL (self-approve if sender)", "-", "OWNER for policy-sensitive", "BRC R-COM-008 remapped"],
      ["Write-off", "ACCOUNTANT initiate", "SCHOOL_OWNER", "Owner + committee > 10k", "DDD invariant + BRC"],
      ["Leave (staff)", "REPORTING MANAGER <= 2 days", "HR_MANAGER > 2 days", "PRINCIPAL (disputed)", "BRC R-APR-003"],
    ],
    [22, 20, 20, 20, 18]
  ));

  return out;
};
