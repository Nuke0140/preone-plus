# PreOne Phase 1 — Students Pilot Readiness & Architecture Remediation

**Repository:** `Nuke0140/preone-plus`  
**Branch:** `phase-1/students-pilot`  
**Baseline:** Frontend Engineering Blueprint v2.0 / FE-ADR-001, FE-ADR-002, FE-ADR-003, FE-ADR-004, FE-ADR-008  
**Status:** Read-only repository audit completed; implementation is gated on the authoritative NestJS API boundary.

## 1. Executive decision

The repository currently does **not** satisfy the Phase 0 completion claims in the supplied sign-off report. The Students UI is a client page backed by Next.js Route Handlers and server-side services in the same Next.js application. The inspected dashboard and app layout still import the Prisma client directly. No NestJS API gateway/client was found at the expected frontend paths.

The two architecture issues are therefore not safe to mark resolved by changing imports alone:

1. **Database ownership:** Prisma access must move behind the NestJS backend. Next.js Server Components, Route Handlers, feature modules, and browser components must not query Prisma.
2. **BFF responsibility:** Next.js Route Handlers must become transport/session proxy handlers only. Student business rules, authorization decisions beyond session forwarding, persistence, transactions, and domain events must be owned by NestJS.

A repository named `Nuke0140/preone` exists, but its README describes a frontend foundation monorepo containing shared config, env, core, design-token, and Storybook packages. It is not evidence of an implemented NestJS backend. No installed repository matching a PreOne NestJS backend was found during this audit.

**Decision:** Do not label the Students pilot production-ready and do not route the new feature module through the existing Prisma-backed Next.js handlers as a permanent solution. First establish the NestJS Students API contract and deployment endpoint; then migrate the feature against that contract.

## 2. Evidence observed in `Nuke0140/preone-plus`

| Area | Observed repository state | Consequence |
|---|---|---|
| Runtime | Root package declares Next.js 16.1.1, React 19, Prisma 6.11.1, TanStack Query 5, Zod 4 | This is the active Next.js application, not the shared foundation repo |
| Dashboard | `src/app/app/dashboard/page.tsx` imports `db` from `@/lib/db` and performs student, attendance, invoice, admission, classroom, and audit queries | FE-ADR-001 is not satisfied |
| App layout | `src/app/app/layout.tsx` imports `db` and queries tenant and branch records | FE-ADR-001 is not satisfied |
| Prisma client | `src/lib/db.ts` constructs and exports `PrismaClient` | Prisma remains part of the Next.js runtime |
| Students UI | `src/app/app/students/page.tsx` is a large client component and calls `/api/v1/students` and related local routes | The route is not yet a feature-colocated module |
| Students API | `src/app/api/v1/students/route.ts` calls `StudentService` directly; the route imports Prisma enum types | The current API is a Next.js-owned domain boundary |
| Student detail API | `src/app/api/v1/students/[id]/route.ts` calls `StudentService` for profile reads and updates | Business operations are still in the Next.js application |
| Role model | `src/lib/auth.ts` contains a role-to-permission map; `src/lib/roles.ts` contains canonical and legacy role definitions | FE-ADR-003 requires permissions to be supplied authoritatively by backend/session claims, not newly duplicated in feature UI |
| Lint | `eslint.config.mjs` does not contain the claimed feature-boundary or Prisma import restrictions | P0-04 completion claim is not evidenced by current default branch |
| Build gate | `next.config.ts` sets `typescript.ignoreBuildErrors: true` | Type errors can be hidden during production build; remove after baseline typecheck is green |

The files above were fetched from the repository default branch during this audit. No source code was modified on `main`.

## 3. Architecture decisions to enforce

### FE-ADR-001 — No Prisma in the Next.js application

- Prisma client and database connection code belong only in the backend service that owns the database.
- Remove `@prisma/client` runtime imports and `@/lib/db` imports from Next.js pages, layouts, route handlers, components, hooks, and feature modules.
- Next.js server components may call the typed backend API client; they must not query the database directly.
- Remove `src/lib/db.ts` only after all consumers have moved and tests prove no imports remain. Do not delete it while consumers exist.

### FE-ADR-002 — Next.js Route Handlers are BFF/proxy only

Allowed responsibilities:
- Read/forward the browser session using secure, HttpOnly cookie handling.
- Forward request method, validated path/query, body, trace/correlation ID, and selected headers to NestJS.
- Normalize transport errors without rewriting domain semantics.
- Stream uploads/downloads where required.

Prohibited responsibilities:
- Prisma access or database transactions.
- Student creation, status transitions, classroom allocation, duplicate detection, or fee/business rules.
- Domain authorization decisions based on hardcoded role names.
- Domain event creation or outbox writes.

### FE-ADR-003 — Permission contract

- Backend returns effective permission keys for the authenticated user and active tenant/scope.
- UI uses permission keys such as `students:read` and `students:write` to control affordances.
- NestJS remains the enforcement point for every operation.
- The feature must not add new role-name comparisons or duplicate the role-permission matrix.

### FE-ADR-004 — Scope-safe cache

All Students queries use the five-part key:

```ts
[
  'students',
  activeSchoolId,
  activeBranchId,
  activeAcademicSessionId,
  filterState,
] as const
```

- `filterState` must be deterministically normalized/serialized.
- On school, branch, or academic-session switch: cancel old-scope requests, remove/invalidate old-scope cache entries, then fetch under the new scope.
- The backend must independently validate tenant, branch, and academic-session access. Cache partitioning is not an authorization control.

### FE-ADR-008 — Contract-first API types

- NestJS publishes OpenAPI from the authoritative controllers/DTOs.
- Generate frontend API types from that OpenAPI document.
- Zod may validate UI forms and response boundaries, but it must not become a separately maintained substitute for the backend contract.

## 4. Required backend contract before Students UI migration

The NestJS Students API must expose equivalent capabilities before the UI switches over:

| Capability | Required operation |
|---|---|
| Directory | Paginated list with search, status, branch, academic session, program, and classroom filters |
| Create | Student creation with guardian details, enrollment context, duplicate-check flow, and validation |
| Profile | Student 360/profile read |
| Update | Student profile patch |
| Classroom | Capacity-safe classroom reallocation |
| Lifecycle | Status transition and withdrawal workflow |
| Context data | Branches, academic sessions, programs, classrooms, and relevant filter options |
| Permissions | Effective permission keys for the active scope |
| Observability | Trace ID propagation and stable error envelope |

The existing local route paths can be retained as a compatibility facade during rollout, but their handlers must proxy to NestJS; they must not call `StudentService` or Prisma.

## 5. Students feature target structure

```text
src/features/students/
  index.ts
  api/
    students-api.ts
    students-query-keys.ts
    students-contracts.ts
  components/
    StudentsPage.tsx
    StudentsTable.tsx
    StudentFilters.tsx
    StudentCreateDialog.tsx
    StudentBulkActions.tsx
  hooks/
    use-students.ts
    use-student-context.ts
    use-student-mutations.ts
  schemas/
    student-form.schema.ts
  types/
    student.types.ts
```

Rules:
- `src/app/app/students/page.tsx` becomes a thin route composition importing only from `@/features/students`.
- Other features import only from `@/features/students` public exports.
- No feature imports another feature's internal paths.
- API contracts are generated from NestJS OpenAPI; do not copy Prisma model types into the browser.
- Keep FMDS components and existing user-facing workflows; migrate incrementally rather than redesigning the page during architecture decoupling.

## 6. Execution sequence and acceptance gates

### Gate A — Backend ownership established
- [ ] Identify or create the NestJS backend repository/service.
- [ ] Confirm the Students module owner, database owner, authentication integration, and deployed base URL.
- [ ] Publish Students OpenAPI contract and generated frontend types.
- [ ] Verify backend tenant/branch/session authorization and permission enforcement.

### Gate B — Remove Next.js database ownership
- [ ] Migrate dashboard and layout read models to NestJS endpoints.
- [ ] Convert Next.js BFF handlers to proxy-only.
- [ ] Move all StudentService business logic and Prisma usage into NestJS.
- [ ] Add CI checks prohibiting Prisma imports in the Next.js application.
- [ ] Remove `typescript.ignoreBuildErrors: true` after fixing and gating type errors.

### Gate C — Students feature migration
- [ ] Create `src/features/students` with a public `index.ts`.
- [ ] Extract API client, query keys, contracts, schemas, hooks, and UI components.
- [ ] Migrate the directory route to the feature entry point.
- [ ] Migrate profile, create/update, bulk classroom allocation, and status workflows.
- [ ] Add permission-key UI gating while retaining backend enforcement.
- [ ] Add scope-switch cache isolation and stale-response cancellation.

### Gate D — Verification
- [ ] Unit tests for query-key normalization, filter state, schemas, and feature hooks.
- [ ] Contract tests against generated OpenAPI types.
- [ ] Integration tests for list, create, profile, update, classroom move, and status transition.
- [ ] Tenant/branch/session isolation tests, including cross-scope IDOR attempts.
- [ ] Regression tests for autosave/draft preservation, debounce, abort, timeout, loading, empty, and error states.
- [ ] Keyboard/accessibility and responsive checks for desktop/tablet/mobile.
- [ ] CI: lint, typecheck, tests, build, and architecture boundary checks all green.

## 7. Definition of Done

Students pilot is complete only when:
1. The browser and Next.js application do not access Prisma.
2. All Students business operations are served by NestJS.
3. Next.js BFF handlers contain transport/session forwarding only.
4. Students feature is consumed through its public export.
5. Every query is keyed by school + branch + academic session + normalized filters.
6. Backend authorization is tested for cross-tenant and cross-scope access.
7. Generated API types are in sync with NestJS OpenAPI.
8. All required CI gates pass with TypeScript build errors enabled.

## 8. Current status

**Audit:** Complete  
**Branch:** Created as `phase-1/students-pilot`  
**Architecture blockers:** Confirmed in the inspected application repository  
**Students feature migration:** Not started; correctly gated pending the NestJS API contract and backend ownership  
**Production sign-off:** Not granted

This document is a readiness and remediation record, not a claim that the backend migration or Students pilot has already been implemented.
