// content-part2.js — Sections 05-09
module.exports = function build(H) {
  const { h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow } = H;
  const out = [];

  // ================= 05. AUTHENTICATION ARCHITECTURE =================
  out.push(h1("05. Authentication Architecture"));
  out.push(p("The sources describe the same authentication machinery three times with different details: the Backend TD defines an email+password flow, the Security Architecture adds phone+OTP and MFA before token mint, and the Frontend Architecture describes a post-login sequence that never mentions tenant or role resolution. This section merges them into one architecture and answers the audit brief question directly: PreOne uses ONE application with RBAC-driven experiences (Option B), not separate platform and school applications, and not a loose multi-portal federation."));

  out.push(h2("5.1 Architecture Options Evaluated"));
  out.push(cap("Table 5-1: Application architecture options"));
  out.push(tbl(
    ["Option", "Description", "Evidence for", "Evidence against", "Ruling"],
    [
      ["A: Separate apps", "Distinct platform-admin app and school-admin app, shared DB", "Cleaner blast radius for platform ops", "Doubles routes, builds, deployments, RBAC drift; sources never define two admin apps; FA monorepo has single apps/web with a platform module", "REJECTED"],
      ["B: One app + RBAC", "Single Next.js app; /platform/* and /app/* route groups; guards resolve experience from role", "FA route map already contains platform module; middleware permission gate exists; single deployment, single session model; matches the implemented system", "Requires strict route-guard tests (provided in Test Strategy)", "CANONICAL"],
      ["C: Multiple portals", "Separate portals (admin, teacher, parent) with shared backend", "PRD names teacher/parent surfaces; mobile-first", "Three frontends for one permission model multiplies UI work; parent surface is a view subset of the same API, not a different domain", "PARTIAL: same backend, parent app is a phone-first client of the same API (v1.1 native), teacher tablet is the same responsive app"],
    ],
    [14, 26, 24, 26, 10]
  ));
  out.push(note("CANONICAL RULE (D1)", "One Next.js 16 application, one NestJS backend. Role determines route group: PLATFORM_ADMIN lands on the platform console; every school role lands on the admin portal; PARENT lands on the parent surface. No school role can reach /platform/* and PLATFORM_ADMIN has no school dashboard.", "info"));

  out.push(h2("5.2 Canonical Login Flow (Every Branch)"));
  out.push(p("The flow below is normative. Each decision node names the state that produces each outcome; corresponding error codes are in Sec. 26.3."));
  out.push(flow([
    "LOGIN REQUEST (email+password, or phone+OTP for parents)",
    "  v",
    "[1] CREDENTIAL CHECK  -- fail x5 --> account LOCKED (15 min; escalate per Security 5.2) --> END",
    "  v pass",
    "[2] RESOLVE USER STATUS",
    "      PENDING_VERIFICATION --------> show invitation-accept / set-password screen --> END",
    "      INACTIVE / DELETED ----------> ACCOUNT_DISABLED error --> END",
    "      LOCKED ---------------------> LOCKED error + unlock path --> END",
    "      ACTIVE ---------------------+",
    "  v                               |",
    "[3] RESOLVE TENANT                |",
    "      user has tenant membership -> load tenant  --> [4]",
    "      user has NO membership and PLATFORM_ADMIN flag -> tenant=null -> [4]",
    "      tenant SUSPENDED ----------> SCHOOL_SUSPENDED screen (read-only) --> END",
    "      tenant PENDING_ACTIVATION -> TENANT_PENDING screen (owner sees activation checklist) --> END",
    "  v",
    "[4] RESOLVE ROLE + BRANCH",
    "      multi-role user  -> role picker (remembers last) ; default = highest precedence",
    "      multi-branch user -> branch picker; sets bid claim",
    "  v",
    "[5] LOAD PERMISSIONS",
    "      effective permission set resolved (role bundles + scoped assignments), cached 60s,",
    "      permissionsVersion stamped into JWT",
    "  v",
    "[6] MFA (risk-based)",
    "      privileged roles (PLATFORM_ADMIN, SCHOOL_OWNER, PRINCIPAL, ACCOUNTANT, HR_MANAGER) -> TOTP challenge",
    "      parent logins -> optional SMS OTP; step-up on anomaly",
    "  v",
    "[7] SESSION + TOKENS  (access 15 min RS256; refresh 30d rotated single-use, HttpOnly cookie)",
    "  v",
    "[8] ROUTE BY ROLE",
    "      PLATFORM_ADMIN ----------> /platform  (tenant registry, onboarding console, platform audit)",
    "      school roles ------------> /app/dashboard   (or /app/onboarding if tenant.onboarding_completed=false)",
    "      PARENT ------------------> /parent/home",
    "      onboarding_completed=false AND role=SCHOOL_OWNER -> /app/onboarding wizard",
  ]));

  out.push(h2("5.3 First-Login, Invitation And Password Setup"));
  out.push(p("No source document defines how a newly created staff user receives credentials; this is a mandatory gap fill. The canonical mechanism is invitation-based and identical for owners and staff, with role-dependent expiry."));
  out.push(...bullets([
    "Creation: an authorized creator (PLATFORM_ADMIN for owners; SCHOOL_OWNER/PRINCIPAL for staff) enters name, contact and role; the system creates the user in PENDING_VERIFICATION and sends a signed invitation link.",
    "Invitation link: single-use, expires in 72 hours (owner) or 7 days (staff); resend allowed by the creator; link binds to the email/phone it was issued to.",
    "First login: user sets password (policy in 5.6), completes profile, and is walked into the role-appropriate tour; owners additionally enter the school onboarding wizard (Sec. 07).",
    "Activation: the user becomes ACTIVE on first successful password set. Deactivation and re-activation are separate admin actions (Sec. 25.2).",
    "Password reset: request issues a 15-minute single-use signed token; success revokes all sessions (family-wide) and notifies email+SMS for privileged roles.",
  ]));

  out.push(h2("5.4 Session Handling And Logout"));
  out.push(...bullets([
    "Access token 15 minutes, RS256, claims sub, tid, bid, ayid, roles[], permissionsVersion, sid.",
    "Refresh token 30 days, single-use rotation; reuse of a rotated token revokes the entire refresh family (family_id) and forces re-login everywhere.",
    "Concurrent sessions: max 5 per user; a sixth login revokes the oldest (Security wins over FA's 3).",
    "Idle timeout 30 minutes with a soft warning at 25; absolute session cap 8 hours.",
    "Logout blacklists both tokens and deletes the Redis session record; admin force-logout bumps permissionsVersion and revokes sessions server-side.",
  ]));

  out.push(h2("5.5 Unauthorized, Suspended And Inactive Behaviours"));
  out.push(cap("Table 5-2: Access-state behaviours"));
  out.push(tbl(
    ["Condition", "API behaviour", "UI behaviour"],
    [
      ["No/invalid token", "401 TOKEN_MISSING / TOKEN_INVALID", "Redirect /login with return URL"],
      ["Token expired", "401 TOKEN_EXPIRED (refreshable)", "Silent refresh; on failure redirect /login"],
      ["Permission missing", "403 PERMISSION_DENIED", "403 page explaining why + request-access link; nav item hidden"],
      ["Branch scope violation", "403 SCOPE_VIOLATION", "403 page; branch switcher offered if user holds another branch"],
      ["Cross-tenant probe", "404 (existence hidden)", "Not-found page"],
      ["User INACTIVE/DELETED", "401 ACCOUNT_DISABLED", "Blocked at login; sessions already revoked"],
      ["User LOCKED", "423 LOCKED with retry-after", "Lock screen with unlock instructions"],
      ["Tenant SUSPENDED", "Read endpoints 200 (read-only), writes 403 TENANT_SUSPENDED", "Persistent read-only banner; billing contact card for owner"],
      ["Tenant PENDING_ACTIVATION", "Config APIs allowed; operational APIs 403 TENANT_PENDING", "Activation checklist for owner; console view for platform admin"],
    ],
    [24, 34, 42]
  ));

  out.push(h2("5.6 Credential Policies"));
  out.push(...bullets([
    "Password: minimum 12 characters with upper, lower, digit and symbol; last 5 reuse blocked; breach-corpus check; hashed with Argon2id (m=64MB, t=3) with bcrypt cost-12 fallback. This resolves C24 in favour of the stricter source; ADR-075's 8-char NIST variant is rejected for a child-data platform.",
    "MFA: TOTP mandatory for the five privileged staff roles; SMS OTP permitted only for PARENT accounts; step-up MFA (fresh 5-minute verification) required for high-risk operations: bank-detail change, bulk data export, refund execution, role assignment. This resolves C23.",
    "Device binding: first login from a new device records a fingerprint; unrecognized device triggers OTP step-up even with valid credentials.",
  ]));

  // ================= 06. SCHOOL CREATION FLOW =================
  out.push(h1("06. School Creation Flow"));
  out.push(p("School creation is the platform's core SaaS motion: a PLATFORM_ADMIN (or a self-serve signup, feature-flagged) creates a tenant, provisions the primary branch, invites the owner, and the school then onboards itself. The sources supply all the pieces (PRD FR-054 workflow, ADR-058 bootstrap endpoint, UI M11 wizard, Prisma tenant statuses, DDD lifecycle) but never assemble them. This section is the canonical assembly."));

  out.push(h2("6.1 Canonical Lifecycle And Statuses"));
  out.push(cap("Table 6-1: Tenant status model (canonical)"));
  out.push(tbl(
    ["Status", "Meaning", "Entered by", "Allowed exits"],
    [
      ["DRAFT", "Being created in the console form; not yet committed", "Platform admin opening create form", "PENDING_ACTIVATION (commit), discarded (purge)"],
      ["PENDING_ACTIVATION", "Committed; awaiting KYC/subscription activation", "Create committed", "TRIALING (trial path), ONBOARDING (activated)"],
      ["TRIALING (optional)", "14-day trial, limited features, watermarked", "Trial signup path (BRC R-PLT-009 exception)", "ONBOARDING (converted), ARCHIVED (expired)"],
      ["ONBOARDING", "Active subscription; owner completing guided setup", "Activation or conversion", "ACTIVE (checklist complete)"],
      ["ACTIVE", "Live school; daily operations running", "Onboarding checklist complete", "SUSPENDED, ARCHIVED"],
      ["SUSPENDED", "Writes blocked (payment failure or violation)", "Platform admin action or automated dunning", "ACTIVE (resolved), ARCHIVED (after 30-day window)"],
      ["ARCHIVED", "Offboarded; data export delivered; retention clock running", "Offboarding flow (BRC R-PLT-010)", "Hard purge after retention (irreversible)"],
    ],
    [16, 30, 26, 28]
  ));
  out.push(p("Statuses are drawn from the sources with two normalizations. PENDING_ACTIVATION is taken from the Prisma tenant enum because it is the only source that names the pre-activation state; DDD's Offboarded is renamed ARCHIVED to match the student-lifecycle vocabulary; INVITED is deliberately NOT a tenant status (it is the owner-user's PENDING_VERIFICATION state) and SETUP_IN_PROGRESS is not adopted because ONBOARDING already covers it, per the brief's instruction to keep only justified states. Tenant user states and subscription states remain separate machines (Sec. 25)."));

  out.push(h2("6.2 Creation Steps"));
  out.push(flow([
    "PLATFORM ADMIN > Create School",
    "  v",
    "STEP 1  School details (name, contact, city, programs offered)          [validate: unique name/email]",
    "  v",
    "STEP 2  Plan selection (Free/Starter/Pro/Enterprise/White-Label)         [validate: plan active]",
    "  v",
    "STEP 3  Primary branch (name, code, address, timings)                    [validate: branch code unique per tenant]",
    "  v",
    "STEP 4  Owner identity (name, email, phone)                              [validate: email not already a user]",
    "  v",
    "STEP 5  Review > COMMIT",
    "        POST /api/v1/platform/tenants   (Idempotency-Key header mandatory)",
    "  v",
    "TENANT = DRAFT -> PENDING_ACTIVATION",
    "  * tenant row + primary branch row + default role catalog + permission bundles seeded (ADR-058)",
    "  * owner user created PENDING_VERIFICATION; invitation email/SMS sent",
    "  * audit: TENANT_CREATED (actor, payload hash)",
    "  v",
    "ACTIVATION GATE (BRC R-PLT-009)",
    "    business proof = true AND signatory verified = true AND payment method valid = true",
    "      yes -> ONBOARDING (owner first login opens wizard)   [trial path -> TRIALING]",
    "      no  -> stays PENDING_ACTIVATION (checklist shown to platform admin)",
  ]));

  out.push(h2("6.3 Activation, Suspension And Offboarding"));
  out.push(...bullets([
    "Suspension triggers: subscription overdue past 7-day grace (automated), compliance violation, or explicit platform action; all writes across the tenant return 403 TENANT_SUSPENDED; reads remain available for data export.",
    "Resumption: on payment success or violation clearance, tenant returns to ACTIVE; a full audit record links suspension and resumption with reasons.",
    "Offboarding: 30-day window with data export (students, invoices, observations, documents); then tenant = ARCHIVED; automated purge completes per DPDP retention; purge is irreversible and preceded by a mandatory backup (DDD tenant invariants).",
  ]));

  // ================= 07. ONBOARDING FLOW =================
  out.push(h1("07. Onboarding Flow"));
  out.push(p("Onboarding is the owner's first-time guided configuration, entered automatically after the first owner login when the tenant is in ONBOARDING. Its purpose is narrow: get a school from zero to operationally live with the minimum viable configuration, using sensible defaults so nothing is blocking. Onboarding never duplicates day-to-day configuration screens; it is a wizard over the same APIs the Setup pages use (Sec. 08-09 keep the separation crisp)."));
  out.push(cap("Table 7-1: Onboarding wizard steps"));
  out.push(tbl(
    ["#", "Step", "What is configured", "Default behaviour", "Skippable?"],
    [
      ["1", "Welcome & profile", "Owner name display, school contact, logo upload", "Logo optional; placeholder branding applied", "No"],
      ["2", "Academic year", "Current academic year + term dates", "Auto-created from current date (April-March default)", "No"],
      ["3", "Programs & classes", "Enable programs (Playgroup...UKG/Daycare); create classes with capacity", "Standard program set pre-checked with default age bands", "No"],
      ["4", "Fee structure", "First fee plan per program (heads, amount, frequency)", "Blank starter plan offered; can be assigned later", "Yes (flag set)"],
      ["5", "Staff invites", "Invite Principal first; others optional", "Minimum one Principal before first admission approval", "Partial (Principal required to go live)"],
      ["6", "Roles confirmation", "Confirm bundle mapping for invited staff", "Canonical defaults (Sec. 24)", "No"],
      ["7", "Communication setup", "Sender IDs, templates, quiet hours", "System defaults; DLT templates linked where applicable", "Yes"],
      ["8", "Consent & compliance", "DPDP consent text, media consent, pickup authorization policy", "Platform-default consent text versioned", "No"],
      ["9", "Review & go live", "Summary; GO LIVE action", "Sets tenant.onboarding_completed=true; status ACTIVE", "No"],
    ],
    [5, 17, 32, 32, 14]
  ));
  out.push(p("Exit criteria for ONBOARDING: academic year exists, at least one class exists, at least one Principal is ACTIVE, and consent text accepted. Fee structure and communication setup may remain incomplete; the dashboard shows a persistent setup-progress card until they are done. Re-entering the wizard later is possible from Settings > Onboarding progress, which makes the wizard a resumable checklist rather than a one-shot gate."));

  // ================= 08. SETUP FLOW =================
  out.push(h1("08. Setup Flow"));
  out.push(p("Setup is the standing administrative configuration of the school: the pages a Principal or Owner returns to whenever the structure of the school changes. Setup is operational, not cosmetic: every item here affects runtime behaviour of other modules. The list below is derived from the PRD Settings domain description, the UI M13 categories and the ERD settings tables, deduplicated against onboarding (which calls the same APIs but is wizard-shaped)."));
  out.push(cap("Table 8-1: Setup responsibilities"));
  out.push(tbl(
    ["Setup area", "Managed by", "Affects", "Notes"],
    [
      ["Academic years & terms", "PRINCIPAL / SCHOOL_OWNER", "Attendance partitioning, fee cycles, promotion, report cards", "Exactly one ACTIVE year; future year can be prepared"],
      ["Branches", "SCHOOL_OWNER", "Scope switcher, class trees, branch receipts counter", "Multi-branch only on plans that include it"],
      ["Programs, classes, sections", "PRINCIPAL / COORDINATOR", "Admission eligibility, classroom assignment, attendance sheets", "Age bands validated against BRC eligibility rules"],
      ["Fee heads, plans, installments", "ACCOUNTANT / SCHOOL_OWNER", "Invoicing, reminders, discounts", "Changes versioned; existing invoices unaffected"],
      ["Discount & scholarship rules", "SCHOOL_OWNER (approval tiers per Sec. 18.4)", "Fee calculations", "BRC rule set configurable per tenant"],
      ["Staff & role assignments", "SCHOOL_OWNER / HR_MANAGER", "RBAC, attendance marking rights, approvals", "Scoped assignments (tenant/branch/class)"],
      ["Approval workflow config", "SCHOOL_OWNER", "Refund, discount, waiver, announcement approval tiers", "Levels map to canonical roles (Sec. 10.4)"],
      ["Integrations", "SCHOOL_OWNER (PLATFORM_ADMIN for platform keys)", "SMS/WhatsApp/email providers, payment gateway", "Per-tenant provider routing (ADR-009)"],
      ["Custom attributes / groups", "PRINCIPAL", "Student/staff extensible fields", "JSONB-backed, form-builder UI (ADR-052)"],
    ],
    [22, 20, 34, 24]
  ));

  // ================= 09. SETTINGS FLOW =================
  out.push(h1("09. Settings Flow"));
  out.push(p("Settings is the ongoing preferences layer: things that change how the product looks and notifies, not what the school's structure is. Keeping Settings, Setup and Onboarding separate prevents the duplicate-page problem the audit brief warns about; the responsibility matrix below is the normative boundary, and any new configuration feature must be placed in exactly one of the three."));
  out.push(cap("Table 9-1: Onboarding vs Setup vs Settings responsibility matrix"));
  out.push(tbl(
    ["Concern", "Onboarding (first-time wizard)", "Setup (administrative config)", "Settings (preferences)"],
    [
      ["School profile & branding", "Logo + name (step 1)", "-", "Branding, theme, favicon, login background"],
      ["Academic year", "Create current year", "Manage years/terms/holidays", "-"],
      ["Branches", "Primary branch already exists (created at tenant creation)", "Add/edit branches", "-"],
      ["Classes", "Create initial classes", "Manage classes/sections all year", "-"],
      ["Fee structure", "First plan optional", "Full fee management", "-"],
      ["Staff", "Invite Principal (minimum)", "Staff CRUD, role bundles, scopes", "-"],
      ["Roles & permissions", "Confirm defaults", "Adjust assignments", "Custom role editor (v1.1)"],
      ["Notifications", "Templates & sender setup", "-", "Quiet hours, per-user preferences, channel toggles"],
      ["Consents & compliance", "Consent text acceptance", "Compliance documents & reminders", "Consent text versioning"],
      ["Integrations", "-", "Provider credentials & routing", "Personal API tokens (admin)"],
      ["Billing (PreOne subscription)", "-", "-", "Plan, invoices, payment method (Owner + Platform)"],
      ["Security", "-", "-", "MFA enrollment, sessions, trusted devices, password"],
      ["Onboarding progress", "IS the wizard", "-", "Progress card + re-entry point"],
    ],
    [20, 27, 26, 27]
  ));
  out.push(note("CANONICAL RULE (RULE 15)", "A configuration screen belongs to exactly one of the three surfaces. Onboarding embeds Setup APIs but never re-implements forms; Settings never changes structural data (that is Setup); Setup never duplicates preference toggles (those are Settings).", "info"));

  return out;
};
