// content-part4.js — Sections 15-19
module.exports = function build(H) {
  const { h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow } = H;
  const out = [];

  // ================= 15. ATTENDANCE FLOW =================
  out.push(h1("15. Attendance Flow"));
  out.push(p("Attendance is the highest-frequency write in the product and the one parents watch in real time. The sources agree on purpose but conflict on statuses (3 vs 5), the edit model (edit-with-reason vs immutable-plus-correction) and escalation. The canonical flow adopts the five-status model, the append-only correction design, and the BRC escalation timers."));
  out.push(h2("15.1 Canonical Marking Workflow"));
  out.push(flow([
    "TEACHER opens Attendance (tablet) > select class > select date (today default; future dates BLOCKED)",
    "  v",
    "SYSTEM loads roster (ACTIVE students of class for that day, incl. INACTIVE exclusions)",
    "  v",
    "MARK: one-tap per student  PRESENT | ABSENT | LATE | HALF_DAY | LEAVE",
    "      + optional check-in time, arrival mode, reason_if_absent, note",
    "      bulk default PRESENT with per-student override (attendance_bulk snapshot per class-day)",
    "  v",
    "SUBMIT  (attendance:write)",
    "      validation: one row per student per date (unique index); student ACTIVE in class;",
    "      late if arrival > start + 30 min auto-suggested (BRC R-OPS-004)",
    "  v",
    "PARENT NOTIFY: absence alert within 15 min (Push+SMS); no-ack in 30 min -> call primary parent",
    "               (BRC R-NOT-002; overrides PRD instant-only wording)",
    "  v",
    "LOCK-FREE CONTINUITY: same-day edit allowed with reason (original kept in audit trail);",
    "      next-day onward: CorrectionRequest (from_status, to_status, reason) ->",
    "      approved by attendance:approve (Principal/Coordinator tier) -> applied + audited",
    "  v",
    "REPORTS: monthly attendance_summary computed (present/absent/late/half/leave days,",
    "      attendance_percentage); promotion eligibility reads < 75% flag (BRC R-OPS-005)",
  ]));
  out.push(h2("15.2 Statuses And Rules"));
  out.push(cap("Table 15-1: Attendance statuses (canonical, resolves C08)"));
  out.push(tbl(
    ["Status", "Counts as present?", "Parent notify", "Notes"],
    [
      ["PRESENT", "Yes", "No", "Default bulk value"],
      ["ABSENT", "No", "Yes (15 min)", "reason_if_absent encouraged; leave may pre-explain"],
      ["LATE", "Yes (flagged)", "Yes (info)", "arrival_time stored; > 30 min past start auto-suggested"],
      ["HALF_DAY", "Partial", "Yes (info)", "check-out time distinguishes early-departure cases"],
      ["LEAVE", "No (excused)", "No", "StudentLeaveRequest types: casual, sick, medical, family, vacation, bereavement"],
    ],
    [14, 16, 16, 54]
  ));
  out.push(...bullets([
    "Escalation: teacher has not marked by start + 30 min -> system reminder; + 60 min -> Coordinator; + 120 min -> Branch Admin may mark on teacher's behalf (BRC R-OPS-006), attribution preserved.",
    "Historical integrity: past-date marking by a teacher requires the same CorrectionRequest path; system imports (biometric/RFID) are source-tagged (MANUAL, BIOMETRIC, RFID, APP).",
    "Fee-hold interaction: when a >60-day defaulter service-hold is active, attendance marking for that student stays available (attendance is a welfare record) but ID-card and optional services are blocked (BRC R-FIN-002 note).",
    "Audit: every create, same-day edit and correction writes an audit row; the monthly summary records computed_at and the correction count it absorbed.",
  ]));

  // ================= 16. ACTIVITIES FLOW =================
  out.push(h1("16. Activities Flow"));
  out.push(p("The learning-development chain is Activity > Observation > Milestone assessment, with Portfolio as the curated artifact layer. The sources define each concept differently or not at all; the canonical definitions below are extracted from the ERD tables (activity, observation, milestone, portfolio), the DDD invariants (edit windows, AI provenance) and the BRC quality rules, with the frequency conflict resolved conservatively."));
  out.push(cap("Table 16-1: Concept definitions (never interchangeable)"));
  out.push(tbl(
    ["Concept", "Definition", "Created by", "Edited by", "Parent sees"],
    [
      ["Activity", "A curriculum unit or experience conducted with a class or child (ERD activity; lesson_plan link)", "Teacher / Coordinator (library)", "Owner of record within 24h", "Timeline entry (auto within 5 min per BRC R-OPS-017)"],
      ["Observation", "A teacher's structured note about one child tied to activity context and learning outcomes; may be AI-drafted (ai_assisted flag)", "Teacher", "Within 24h (DDD); corrections = new linked observation after window", "Only when shared (is_shared_with_parent, default true)"],
      ["Milestone assessment", "Per-student rating of a catalog milestone: NOT_STARTED, EMERGING, ACHIEVING, MASTERED, CONCERN", "Teacher", "Superseded by new assessment (history kept)", "Milestone progress view + concern alerts (R-ACD-007)"],
      ["Portfolio item", "Curated artifact (photo/artwork/video) with category and optional AI caption", "Teacher", "Reorder/recaption anytime", "Published portfolio only"],
      ["Achievement", "Discrete award (academic, sports, arts) with certificate", "Teacher / Principal", "-", "Immediately on publish"],
      ["Daily report", "End-of-day summary (meals, nap, mood, toileting) merged from operational logs", "System-assisted (teacher confirms)", "Until daily-send", "Daily report within 30 min of pickup (R-NOT-003)"],
    ],
    [14, 34, 16, 18, 18]
  ));
  out.push(h2("16.1 Permissions And Quality"));
  out.push(...bullets([
    "Creation: teachers create activities, observations and assessments for their assigned classes only; coordinators create for any class in their scope; nobody edits another teacher's observation (comments instead).",
    "Quality loop: system flags low-quality text (<20 chars or generic words) per BRC R-ACD-005; Coordinator reviews weekly and recurring low quality triggers coaching; flag thresholds configurable.",
    "Frequency ruling (C14): system minimum 1 observation per child per week (alert to teacher, then Coordinator); dashboard target 2/week; PRD's 3/week is aspirational and not enforced.",
    "Attachments ruling (C15): 5 attachments max, 5 MB each (DDD wins); photos auto-tagged with consent check (media-use consent per child; non-consenting children excluded or AI face-blurred per R-OPS-016).",
    "AI drafts: allowed for observations, daily sheets, report-card narrative; always ai_draft=true until a teacher accepts/edits/rejects; rejection records feedback for model tuning (no PII in training).",
  ]));

  // ================= 17. GROWTH PASSPORT FLOW =================
  out.push(h1("17. Growth Passport Flow"));
  out.push(note("AUDIT FINDING (UNDEFINED IN SOURCES)", "The term Growth Passport appears in downstream and implementation materials but is defined in ZERO of the 19 source documents: no entity, no flow, no permission, no report. The nearest source concepts are Portfolio (ERD), the parent Timeline (PRD communication domain), Milestone assessments and Report Cards. Per the audit rules this is declared UNDEFINED and the composition below is marked RECOMMENDED pending product sign-off (Sec. 31, OD-1).", "warn"));
  out.push(h2("17.1 Proposed Canonical Composition (RECOMMENDED)"));
  out.push(p("Growth Passport is defined as the longitudinal, parent-facing record of a child's development, composed mechanically from existing records rather than being a new data silo: milestone assessments over time, published observations, portfolio items, achievements, activity participation and term report cards, plus AI-generated growth narratives and delay alerts where configured."));
  out.push(flow([
    "STUDENT (ACTIVE)",
    "  |  daily:    activities + daily logs          -> Timeline entries",
    "  |  weekly:   observations (shared)            -> Learning stories",
    "  |  periodic: milestone assessments            -> Skill progression (EMERGING>MASTERED)",
    "  |  curated:  portfolio items                  -> Artifacts",
    "  |  events:   achievements, incidents summary  -> Highlights",
    "  v",
    "GROWTH PASSPORT VIEW (parent app + web)",
    "  |  filters: academic year, domain (cognitive/motor/social/language/emotional), class",
    "  v",
    "GROWTH PASSPORT REPORT (term PDF)",
    "  |  compiled at term end: narrative (AI draft -> teacher review), milestone map,",
    "  |  attendance %, portfolio highlights, teacher + principal sign-off",
    "  v",
    "published to parent (report card approval chain applies, Sec. 16)",
  ]));
  out.push(h2("17.2 Permissions And Data Rules (RECOMMENDED)"));
  out.push(...bullets([
    "Read: parents see only their child's passport; teachers read/write for their classes; coordinators and principals read school-wide; export generates the term PDF.",
    "Write: no module writes directly into a passport; everything is projected from source records, so the passport can be rebuilt at any time (single source of truth preserved).",
    "AI: narrative drafts carry ai_draft provenance and require teacher acceptance before publish; AI never modifies milestone ratings or observations (Sec. 20).",
    "Retention: passport follows student record retention; on archive, parent access revoked and minimized export issued once.",
  ]));

  // ================= 18. FEES & FINANCE FLOW =================
  out.push(h1("18. Fees & Finance Flow"));
  out.push(p("Finance has the richest rule set in the BRC and the most conflicts between PRD, DDD and the data docs. The canonical lifecycle is straightforward; the rulings below fix precision, GST, late fee, refunds and numbering. Financial transactions are always auditable (audit brief RULE 11), never hard-deleted, and every mutation flows through the idempotency-protected payment API."));
  out.push(h2("18.1 Concepts And Lifecycle"));
  out.push(cap("Table 18-1: Finance concept definitions"));
  out.push(tbl(
    ["Concept", "Definition", "Key fields / states"],
    [
      ["Fee Head", "Catalog line type: tuition, admission, transport, meal, activity, exam, library, late-fee, other", "type FIXED/VARIABLE/RECURRING/ONE_TIME; frequency; taxable flag"],
      ["Fee Structure / Plan", "Template of heads + amounts + frequency for a program (branch-optional scope), with security deposit and installment count", "total_annual_cents; installments 1/2/4/12"],
      ["Student Assignment", "Plan applied to a student at enrollment; concession stack (sibling, staff-ward, scholarship, hardship) attached", "fee_concession rows; approval trail"],
      ["Invoice", "Billing document generated per student per cycle (or on-demand)", "DRAFT > ISSUED > PARTIALLY_PAID > PAID | OVERDUE | CANCELLED | WRITTEN_OFF; immutable after ISSUE"],
      ["Payment", "Money received against invoice(s) or as advance", "PENDING > SUCCESS | FAILED; REFUNDED; gateway ref + Idempotency-Key"],
      ["Receipt", "Proof document issued on successful payment; sequential per branch per FY", "RCP-YYYY-NNNNN; PDF stored; reprint = copy flag"],
      ["Refund / CreditNote", "Money returned (against payment) or invoice correction without money movement", "REQUESTED > APPROVED > PROCESSED | REJECTED | CANCELLED"],
      ["Ledger", "Double-entry journal projection (Prisma JournalEntry) for reporting and GST returns", "Derived; never hand-edited"],
    ],
    [16, 44, 40]
  ));
  out.push(flow([
    "FEE PLAN (structure) -> assigned to STUDENT (concessions applied, approved per tier)",
    "  v",
    "INVOICE GENERATED (schedule: monthly/term/annual per plan)  DRAFT",
    "  v ISSUED (immutable; number INV-YYYY-NNNNN unique per school per FY; parent notified D-7)",
    "  v",
    "PAYMENT (online gateway OR offline record; Idempotency-Key; cash < INR 50k rule, PAN capture)",
    "  |  allocations across invoices (payment_allocation); part-pay allowed -> PARTIALLY_PAID",
    "  v",
    "RECEIPT issued within 60 seconds of success (RCP-YYYY-NNNNN per branch per FY)",
    "  v",
    "STATES: PAID | PARTIALLY_PAID | OVERDUE (due date passed) | CANCELLED | WRITTEN_OFF (2-tier approval)",
    "  v",
    "LATE FEE: BRC slabs on overdue (grace 7d): 8-30d INR 100; 31-60d INR 500; >60d INR 1,000",
    "          + service hold (ID card, optional services) with Principal approval",
    "  v",
    "ESCALATION REMINDERS: D-7 Push; D-3 Push+SMS; overdue Push+SMS+Email+WhatsApp; auto-stop on ack",
    "  v",
    "REFUND: REQUESTED (Accountant) -> APPROVED per tier -> PROCESSED -> Receipt/Invoice adjusted;",
    "        REJECTED with reason; eligibility window 90 days (RECOMMENDED); audit every step",
  ]));
  out.push(h2("18.2 Rulings Applied To Conflicts"));
  out.push(...bullets([
    "Money precision (C10): all amounts are integer paise in storage and transit; UI formats INR with 2 decimals; exports carry paise with a documented display rule. The ERD 3.1 numeric(12,2) sentence is void.",
    "GST (C11): tuition/activity/exam for preschool = 0% (exempt) per BRC R-FIN-007; transport/meal/materials taxed per HSN as tenant-configured; invoice_tax stores CGST/SGST/IGST breakup when applicable. PRD's flat 18% is void for tuition.",
    "Late fee (C12): BRC slabs, configured in late_fee_rule per tenant (grace default 7). DDD's per-day model dropped.",
    "Refunds (C13): initiation by ACCOUNTANT; approval tiers mapped to canonical roles - Principal <= INR 5,000; School Owner <= INR 25,000; Owner + finance committee above; TAT 14 working days; eligibility window 90 days from payment (RECOMMENDED merge); refunds > INR 5,000 require step-up MFA.",
    "Discount caps: stack total <= 25% default cap; above requires the approval tiers of BRC R-APR-007; sibling/staff/early-bird percentages per BRC R-FIN-005/006/R-ELG-012.",
    "Invoice mutability (C25): PATCH only in DRAFT; after ISSUE all corrections via CreditNote or Refund; middleware blocks UPDATE on issued invoices.",
    "Cash rule (BRC R-FIN-010): cash rejected > INR 50,000 with PAN capture below; digital mandatory above.",
  ]));

  // ================= 19. COMMUNICATION FLOW =================
  out.push(h1("19. Communication Flow"));
  out.push(p("Communication spans three mechanics: 1:1 chat (parent-teacher), announcements/broadcasts (school-to-many), and event-triggered notifications (system-to-person). The canonical model merges the ERD announcement/chat family with Prisma's Message/Conversation into one pipeline: Event > Notification Engine > Channel > Delivery > Read > Audit."));
  out.push(h2("19.1 Who Can Message Whom"));
  out.push(cap("Table 19-1: Messaging permission matrix"));
  out.push(tbl(
    ["From > To", "Parents (own child)", "Teachers", "Staff", "All parents (broadcast)"],
    [
      ["Parent", "n/a", "Chat: own child's teachers only", "No", "No"],
      ["Teacher", "Chat: own class parents; reply within SLA", "Staff groups", "Staff groups", "No (class broadcast only, own class)"],
      ["Coordinator", "Via teacher; class-level broadcast own classes", "Yes", "Yes", "Class-level only (BRC R-COM-004)"],
      ["Principal", "Chat + announcement (school)", "Yes", "Yes", "Yes (self-approved per PRD; approval step skipped for sender)"],
      ["School Owner", "Announcements", "Yes", "Yes", "Yes"],
      ["Accountant", "System fee notices only (templated)", "No", "Yes", "Fee-category broadcast only"],
      ["System (events)", "Transactional notifications", "As configured", "As configured", "As configured"],
    ],
    [16, 22, 20, 16, 26]
  ));
  out.push(h2("19.2 Channels And Delivery Pipeline"));
  out.push(...bullets([
    "Channels: In-App (always), Push, SMS, WhatsApp, Email; IVR call added for emergency escalation only (BRC R-COM-012). Provider routing per tenant with fallback chains (SMS fail -> email -> push per ADR-009).",
    "Pipeline: domain event -> outbox -> Redis Stream -> notification_rule evaluation -> template render (per language preference) -> channel queue (BullMQ) -> provider -> delivery webhook -> read tracking -> audit.",
    "Rate limits and quiet hours: WhatsApp <= 5 messages/parent/day; push 10/h; SMS 5/h; email 20/h; quiet hours 22:00-07:00 except CRITICAL priority.",
    "Chat rules: 1:1 staff-parent conversations; messages append-only with 5-minute edit window; conversations archive after 1 year; opt-out parents are not addressable except emergencies.",
  ]));
  out.push(h2("19.3 Event-Triggered Notification Catalog"));
  out.push(cap("Table 19-2: Canonical trigger catalog (merged from BRC R-NOT-001..012 + domain events)"));
  out.push(tbl(
    ["Event", "Audience", "Channels", "Timing / SLA"],
    [
      ["Fee due approaching", "Fee payer", "Push (D-7), Push+SMS (D-3), on-due reminder (RECOMMENDED)", "Scheduled per plan"],
      ["Invoice overdue", "Fee payer", "Push+SMS+Email+WhatsApp", "On overdue + cadence; auto-stop on acknowledgement"],
      ["Child marked absent", "Primary guardian", "Push+SMS", "Within 15 min; no-ack 30 min -> IVR call"],
      ["Daily report ready", "Guardians", "Push / In-App", "Within 30 min of pickup"],
      ["Observation shared", "Guardians", "Push / In-App", "On publish"],
      ["Milestone concern flagged", "Guardians", "Push + email", "Same day as assessment"],
      ["Incident MEDIUM", "Primary guardian", "Push+SMS", "Within 30 min"],
      ["Incident HIGH/CRITICAL", "Primary guardian + Principal", "Immediate call + Push+SMS", "Immediate"],
      ["Admission approved / enrolled", "Guardians", "Email + Push", "On event"],
      ["Student transferred / exited", "Guardians", "Email", "On event"],
      ["Broadcast / announcement published", "Audience per type", "Configured channels", "Approval first (R-COM-008)"],
      ["Event reminder (school event)", "RSVP audience", "Push", "14-day, 7-day, 1-day reminders"],
      ["Holiday declared", "All", "Push+SMS", "48 h prior"],
      ["Transport delay > 10 min (v1.1)", "Route parents", "Push+SMS", "Immediate"],
      ["Salary credit (staff)", "Employee", "Email+Push", "On payroll disbursement"],
      ["Security (new device, password change, MFA change)", "The user", "Email + Push", "Immediate"],
    ],
    [26, 20, 26, 28]
  ));

  return out;
};
