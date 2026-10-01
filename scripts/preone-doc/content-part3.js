// content-part3.js — Sections 10-14
module.exports = function build(H) {
  const { h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow } = H;
  const out = [];

  // ================= 10. ADMISSIONS FLOW =================
  out.push(h1("10. Admissions Flow"));
  out.push(p("Admissions is the most conflicted area of the documentation set: the PRD defines two pipelines (Marketing & CRM and Admissions), the DDD defines two more (a workflow state machine and an aggregate status list), the UI adds two steppers, the BRC adds sub-status flags, and ADR-037 contributes a workflow-engine pipeline with human-task timers. The canonical ruling keeps ONE pipeline but formally separates the five status domains the brief demands, so that CRM funnel reporting and admission processing never share a vocabulary again."));

  out.push(h2("10.1 The Five Status Domains"));
  out.push(cap("Table 10-1: Lead Status (CRM domain; owned by counsellor)"));
  out.push(tbl(
    ["Status", "Meaning", "Next states"],
    [
      ["NEW", "Captured (form, walk-in, campaign, referral); not yet contacted", "CONTACTED, DUPLICATE (auto-merge candidate), LOST"],
      ["CONTACTED", "First outreach done; activity logged", "QUALIFIED, NURTURE, LOST"],
      ["QUALIFIED", "Interest + basic fit confirmed; visit scheduled as an ACTIVITY", "CONVERTED (application created), NURTURE, LOST"],
      ["NURTURE", "Long-cycle prospect in drip follow-up", "QUALIFIED, LOST"],
      ["CONVERTED", "Application created from lead (terminal; lead retained for reporting)", "-"],
      ["LOST", "Closed with mandatory lost_reason", "-"],
      ["DUPLICATE", "Merged into another lead (phone+name match per BRC R-ELG-003)", "-"],
    ],
    [16, 48, 36]
  ));
  out.push(cap("Table 10-2: Application Status (admission processing domain)"));
  out.push(tbl(
    ["Status", "Meaning", "Next states"],
    [
      ["DRAFT", "Created (by counsellor from lead, or public form), not submitted", "SUBMITTED, CANCELLED"],
      ["SUBMITTED", "Form locked (BRC R-ADM-006 analogue); fees/receipt as configured", "DOCUMENT_PENDING"],
      ["DOCUMENT_PENDING", "Checklist incomplete (birth cert, photos, medical, parent ID)", "DOCUMENT_VERIFIED, REJECTED (docs never provided in window)"],
      ["DOCUMENT_VERIFIED", "All checklist items verified (PENDING>VERIFIED per document)", "UNDER_REVIEW"],
      ["UNDER_REVIEW", "In counselling + approval workflow", "APPROVED, REJECTED, WAITLISTED"],
      ["APPROVED", "Approval chain complete; offer generated", "CONVERTED (enrollment), CANCELLED (offer expired)"],
      ["REJECTED", "Rejected with reason; appeal flag set", "terminal (re-application = new application)"],
      ["WAITLISTED", "Capacity-bound placement per priority factors", "APPROVED (seat opens), REJECTED (cycle ends)"],
      ["CONVERTED", "Enrollment created; student exists (terminal)", "-"],
      ["WITHDRAWN", "Parent withdrew during process", "-"],
      ["CANCELLED", "Withdrawn/cancelled by school or expiry", "-"],
    ],
    [20, 44, 36]
  ));
  out.push(cap("Table 10-3: Document Status (per checklist item) and Approval Record"));
  out.push(tbl(
    ["Domain", "States / values", "Rules"],
    [
      ["Document Status", "PENDING > VERIFIED | REJECTED > RESUBMIT", "verified_by + verified_at mandatory on VERIFIED; OCR extract stored; resubmit loop unlimited within admission window"],
      ["Approval Record (per level)", "decision: APPROVED | REJECTED | WAITLISTED | DEFERRED; levels: 1 Branch (Principal), 2 Academic (Coordinator), 3 Finance (Owner), 4 Board-tier (chain policy)", "Levels configured per tenant; fee-waiver amount routes level (BRC R-APR-001); every decision stores reason + decided_at; parent-visible only as final decision"],
      ["Enrollment Status", "OFFERED > ACCEPTED > FEE_PENDING > ENROLLED", "Offer expiry 7-15 days (PRD R-ADM-005; expiry -> CANCELLED); FEE_PAYMENT gates ENROLLED (ADR-037 FEE_PAYMENT -> ENROLLED)"],
    ],
    [22, 36, 42]
  ));
  out.push(note("CANONICAL RULE (RULE 7)", "Lead Status is a CRM state; Application Status is a processing state; Document Status is a checklist state; the Approval Record is a decision log; Enrollment Status is a contract state. A lead can be QUALIFIED while its application is DOCUMENT_PENDING; a funnel report computes stages from activities, never from statuses alone.", "info"));

  out.push(h2("10.2 Canonical Pipeline"));
  out.push(flow([
    "LEAD (NEW) -> CONTACTED -> QUALIFIED",
    "   | activities: call, WhatsApp, visit scheduled, visit completed, counselling session",
    "   v",
    "CONVERT: create APPLICATION (from lead or walk-in; lead_id NULL for walk-in)",
    "   v",
    "DRAFT -> SUBMITTED -> DOCUMENT_PENDING",
    "   |     per-item: PENDING -> VERIFIED / REJECTED -> RESUBMIT ->",
    "   v",
    "DOCUMENT_VERIFIED -> UNDER_REVIEW",
    "   |  counselling session (SCHEDULED/COMPLETED/NO_SHOW) logged; recommendation recorded",
    "   |  approval chain per level: APPROVED / REJECTED / WAITLISTED / DEFERRED (reason mandatory)",
    "   v",
    "APPROVED  --> offer (fee quote valid 7-15 days)",
    "REJECTED   -> rejection reason + parent feedback + appeal_eligible flag",
    "WAITLISTED -> priority queue (sibling, staff-child, alumni, distance...)  [BRC R-ELG-011]",
    "   v",
    "ENROLLMENT: OFFERED -> ACCEPTED -> FEE_PENDING -> ENROLLED",
    "   |  on ENROLLED: student created, admission number issued, guardian linked,",
    "   |  class assigned, fee plan assigned  (see Sec. 11)",
    "   v",
    "student ACTIVE (admissions complete; lifecycle continues in Sec. 12)",
  ]));
  out.push(p("Workflow SLAs are adopted from ADR-037 where they add operational value without changing the status model: parent confirmation reminder at 7 days with escalation at 14; internal approval task reminder at 3 days with escalation to Principal; stalled-application metric flagged when UNDER_REVIEW exceeds 7 days. Age eligibility is validated at submission and re-checked at approval (AgeEligibilitySpecification; BRC age bands per program); capacity is checked at approval with waitlist offered when the class is full (AC-010)."));

  out.push(h2("10.3 Duplicate And Edge Handling"));
  out.push(...bullets([
    "Duplicate lead: phone (+school) unique index; on create, matching leads are surfaced and merge is offered; merged lead becomes DUPLICATE with pointer to survivor.",
    "Duplicate application: one open application per child per program per academic year; second submission returns 409 ADMISSION_DUPLICATE with link to existing.",
    "Public-form spam: rate-limited per IP + captcha; unverified applications auto-cancel after the admission window.",
    "Mid-year admission: admission_type MID_SESSION; prorated fee quote generated from fee rules.",
  ]));

  // ================= 11. ENROLLMENT FLOW =================
  out.push(h1("11. Enrollment Flow"));
  out.push(p("Enrollment converts an approved admission into an operating student record. It is the single most cross-cutting transaction in the product (admissions, student, finance, communication domains all participate), which is why the sources describe it both as a single transaction and as a saga. The canonical ruling: the enrollment record itself is created synchronously in one transaction; the fee-plan assignment, first invoice generation and welcome communications run as follow-up steps through the outbox, with the workflow engine tracking completion."));
  out.push(flow([
    "TRIGGER: application APPROVED + offer ACCEPTED  (parent confirms; or office confirms on behalf)",
    "  v",
    "[1] CREATE ENROLLMENT (one tx)",
    "      validates: application APPROVED, no existing enrollment for (student-context, academic year),",
    "                 class capacity, age eligibility re-check",
    "  v",
    "[2] STUDENT CREATED (same tx)",
    "      status PROVISIONAL; admission number STU-YYYY-NNNNN issued (unique per tenant, immutable)",
    "      student_history: ADMITTED event with full snapshot",
    "  v",
    "[3] GUARDIANS LINKED (same tx)",
    "      >= 1 guardian mandatory (from application parent info); is_primary, is_fee_payer,",
    "      can_pickup, custody fields set; guardian dedup by phone+tenant",
    "  v",
    "[4] ASSIGNMENTS (follow-up steps, workflow-tracked)",
    "      class/section assigned  -> classroom_assignment (unique student+academic year)",
    "      fee plan assigned       -> fee plan per program; installment schedule generated",
    "      transport assigned      -> optional (v1.1); route + stop mapped",
    "      first invoice generated -> invoice DRAFT -> ISSUED; fee reminder schedule armed",
    "  v",
    "[5] ACTIVATION GATE",
    "      FEE_PENDING  -> first installment paid (or approved waiver/installment plan)",
    "                   -> student ACTIVE; parent portal credentials issued (Sec. 13)",
    "      non-payment in window -> enrollment stays FEE_PENDING; reminder cadence runs;",
    "                               Principal may extend or cancel (-> CANCELLED, application -> WITHDRAWN)",
    "  v",
    "events: EnrollmentCreated, StudentCreated, PaymentReceived, welcome message to guardians",
    "audit:  every step recorded (actor=system for automated steps)",
  ]));
  out.push(p("If any follow-up step fails (invoice generation, communication), enrollment is NOT rolled back; the workflow engine retries with backoff and raises an operational alert after the DLQ threshold, preserving the eventually-consistent UX copy rules of ADR-035 (the UI shows Enrollment confirmed - invoice pending rather than an error)."));

  // ================= 12. STUDENT LIFECYCLE =================
  out.push(h1("12. Student Lifecycle"));
  out.push(p("The student is the longest-lived entity in PreOne and the one most tightly regulated (child data, DPDP retention). The canonical lifecycle below merges the four source variants, resolves the graduation-versus-promotion conflict, and defines the five exit operations (archive, deactivate, withdraw, transfer, delete) as semantically distinct actions as the brief demands."));
  out.push(cap("Table 12-1: Canonical student states"));
  out.push(tbl(
    ["State", "Meaning", "Entry", "Exits"],
    [
      ["PROVISIONAL", "Enrollment created; first installment pending; not yet attendable", "Enrollment step 2", "ACTIVE (payment/waiver), WITHDRAWN"],
      ["ACTIVE", "Attending; present in class rosters, attendance, finance", "Payment confirmed", "INACTIVE, GRADUATED, TRANSFERRED, WITHDRAWN, ARCHIVED"],
      ["INACTIVE", "Temporarily not attending (long illness, suspension of services, fee hold); roster-excluded", "Admin action with reason", "ACTIVE (reinstate), WITHDRAWN, ARCHIVED"],
      ["GRADUATED", "Completed the top program; alumni record; retention clock variant applies", "Graduation event at year end", "ARCHIVED"],
      ["TRANSFERRED", "Moved out: INTERNAL (other branch of tenant) or EXTERNAL (TC issued)", "Transfer flow", "ARCHIVED (after retention), or back to ACTIVE (internal reversal within window)"],
      ["WITHDRAWN", "Left mid-cycle by parent choice; dues settled per finance rules", "Withdrawal request + clearance", "ARCHIVED"],
      ["ARCHIVED", "Read-only, minimized dataset per DPDP; visible only in archive register", "Retention/archival job or admin action with reason", "Hard purge after retention (irreversible, job-only)"],
    ],
    [14, 34, 24, 28]
  ));
  out.push(h2("12.1 Promotion, Transfer, Withdrawal, Archive, Deactivate, Delete"));
  out.push(cap("Table 12-2: The five exit operations vs delete"));
  out.push(tbl(
    ["Operation", "What it does", "Reversible?", "Who", "Data effect"],
    [
      ["Promote", "Event (not state): creates next-year classroom assignment + history entry at year boundary", "Yes (assignment edit within window)", "Principal", "Student stays ACTIVE; history append-only"],
      ["Transfer", "INTERNAL: branch change within tenant (roster, transport, fees re-scope). EXTERNAL: TC generated, status TRANSFERRED", "Internal: yes. External: no (re-admission is new)", "Principal (internal); Owner (external)", "History TRANSFERRED event; balances carried/squared per finance"],
      ["Deactivate", "Temporary INACTIVE with reason; excluded from rosters and reminders", "Yes (reinstate keeps history)", "Principal", "No data removed; attendance stops"],
      ["Withdraw", "Permanent exit mid-cycle; dues cleared; parent access revoked", "No", "Principal + Owner countersign if dues outstanding", "Financial records retained; profile retained"],
      ["Archive", "DPDP archival: minimize, read-only, retention_until set", "No (purge only later)", "System (retention job) / Admin with reason", "PII minimized per archive_policy; archive register entry"],
      ["Delete (hard)", "FORBIDDEN in application code (ADR-047); reserved to retention job on ephemeral data only", "-", "System only", "-"],
    ],
    [12, 40, 14, 14, 20]
  ));
  out.push(p("Every one of these operations is audited with before/after values and a mandatory reason, and every one emits the matching domain event (StudentTransferred, StudentArchived, ParentAccessRevoked, and so on) so that downstream modules (attendance rosters, fee reminders, transport lists, parent portal) update through the event pipeline instead of direct coupling. API surface: DELETE /students maps to archive-with-reason for admins (soft delete with 7-year DPDP retention), never to a SQL DELETE; the Show-deleted toggle and Restore affordance follow ADR-047."));

  // ================= 13. PARENT LIFECYCLE =================
  out.push(h1("13. Parent Lifecycle"));
  out.push(p("No source document defines the parent lifecycle, although the data model is rich (guardian master + student_guardian link with is_primary, is_fee_payer, can_pickup, custody_percentage). This section defines the lifecycle normatively, using only mechanisms the sources already contain: the guardian model of the ERD, the parent-as-user identity model, and the communication consent framework."));
  out.push(h2("13.1 Canonical Parent Flow"));
  out.push(flow([
    "CAPTURED    guardian info entered during application (parent/guardian step)",
    "   |         dedup by phone+tenant -> existing guardian linked instead of new row",
    " v",
    "LINKED      at enrollment: student_guardian created; exactly one is_primary per student;",
    "   |         is_fee_payer drives invoice recipient; can_pickup drives pickup authorization",
    " v",
    "INVITED     on student ACTIVE: parent user created (role PARENT) linked to guardian;",
    "   |         invitation via phone+OTP (primary) or email; first login sets password",
    " v",
    "ACTIVE      parent portal: timeline, attendance, fees (own children), chat, announcements, consents",
    " v",
    "PAUSED      optional: communication opt-out honored within 24h (BRC R-COM-005); portal read-only",
    " v",
    "CLOSED      all children exit (withdraw/graduate/transfer) -> access revoked;",
    "             guardian profile retained per retention policy; DPDP erasure on verified request (Sec. 22)",
  ]));
  out.push(h2("13.2 Guardian Rules"));
  out.push(...bullets([
    "Multiple guardians per student supported (up to reasonable limit); exactly one primary; one or more fee payers; up to 4 authorized pickup persons per student including non-guardians (BRC R-OPS-001), each with photo + ID proof.",
    "One guardian may be linked to multiple students, including across branches of the same tenant; the parent app shows a child switcher.",
    "Emergency contact is a guardian contact field flagged as emergency_primary; separate from pickup authorization.",
    "Communication preferences (language, channels, quiet hours) are per parent user; school messages respect them except emergency channel overrides (BRC R-COM-012).",
    "Custody disputes: custody_arrangement + court-order document flag restricts pickup and information visibility per flagged guardian; change requires Principal approval and is audited.",
  ]));

  // ================= 14. TEACHER / STAFF LIFECYCLE =================
  out.push(h1("14. Teacher / Staff Lifecycle"));
  out.push(p("Staff lifecycle in the sources is fragmented: the HR context owns staff records, the identity model owns users, and the only onboarding event is StaffOnboarded. The canonical lifecycle unifies them: every staff member is one user with one HR profile and one or more scoped role assignments."));
  out.push(flow([
    "CREATED      HR/Owner creates staff profile (personal, qualification, bank, documents)",
    "   v",
    "ROLE ASSIGNED   canonical role bundle assigned with scope (TENANT / BRANCH / CLASS)",
    "   |            e.g. TEACHER bundle = attendance:write, observations:write, communication:class",
    " v",
    "BRANCH/CLASS ASSIGNMENT   branch membership; teacher-class mapping for academic year",
    "   v",
    "INVITED -> ACTIVE   invitation accepted, password set, MFA enrolled (privileged roles)",
    "   v",
    "DAILY OPERATIONS    teacher: attendance, activities, observations, daily reports, class chat",
    "   |                coordinator: reviews; accountant: finance; hr: payroll; principal: approvals",
    " v",
    "CHANGES   role change (bundle swap), branch transfer, class reassignment  -> all audited +",
    "   |      permissionsVersion bump forces token refresh",
    " v",
    "EXIT      OFFBOARDING: classes reassigned, sessions revoked, access removed;",
    "          staff status RESIGNED/TERMINATED (HR states); profile retained per policy",
  ]));
  out.push(h2("14.1 What Teachers Can And Cannot Approve"));
  out.push(...bullets([
    "CAN: submit attendance; create/edit own activities and observations within the 24h window; draft daily reports; initiate parent chat; request attendance correction (not self-approve).",
    "CANNOT: approve admissions or any approval-level decision; approve attendance corrections (attendance:approve belongs to Principal/Coordinator tier); approve refunds, discounts or fee waivers; publish report cards (Principal signs off); broadcast beyond their own class; delete anything.",
    "AI boundary: teachers may accept, edit or reject AI-drafted observations and daily sheets; their acceptance action is recorded with provenance (Sec. 20).",
  ]));

  return out;
};
