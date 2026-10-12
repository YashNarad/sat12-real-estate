# SAT12 Stage 3 Supabase Property Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure Supabase-backed property-management system while preserving the complete Stage 2 SAT12 public search and interactive map experience.

**Architecture:** PostgreSQL and Storage are protected by RLS and lifecycle functions; Supabase Auth supplies cookie-backed identity. A server-side repository maps published rows into the existing `Property[]` contract, while the current page coordinator moves unchanged into a Client Component. Owner/admin mutations use validated Server Actions with the caller's Supabase session, never a browser-visible service-role key.

**Tech Stack:** Next.js App Router 16.4, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL/Storage, `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI, PostgreSQL/PostGIS, Zod, pgTAP, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-sat12-stage-3-supabase-property-management-design.md`

## Global Constraints

- Do not begin implementation until every decision in the spec's “Decisions requiring approval” section has an explicit answer.
- Preserve SAT12 red `#DC0011`, charcoal, white, light gray, the approximately 30/70 desktop map/results layout, responsive result columns, and mobile Map/List behavior.
- Preserve the invariant: ordinary filters control map markers and listings; map bounds narrow listings only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_PASSWORD` to Client Components, `NEXT_PUBLIC_*` variables, browser responses, logs, or committed files.
- Enable RLS on every exposed application table and Storage access path; do not add permissive temporary policies.
- Keep applied migrations forward-only and review SQL before committing.
- Keep the nine Nagpur mock records as deterministic local/test seed fixtures until live-data parity is verified.
- Do not implement payments, subscriptions, persistent favorites, alerts, KYC, multi-city search, or unrelated UI redesign.

## Review Focus

- Expired/spoofed browser sessions must fail closed: protected pages and actions validate claims, and RLS rejects the mutation.
- Cross-owner property IDs or Storage paths must never allow reading, editing, or deleting another owner's draft or images.
- Repeated/concurrent lifecycle commands must perform one valid transition and reject stale requests without duplicate approval events.
- A database or signed-image failure must show a truthful recoverable state, never silently label mock data as live inventory.
- Large/invalid files, path traversal attempts, unsupported MIME types, missing alt text, and more than twelve images must be rejected before submission.

---

## Planned file structure

```text
supabase/
  config.toml
  migrations/
    <timestamp>_stage3_core_schema.sql
    <timestamp>_stage3_auth_and_rls.sql
    <timestamp>_stage3_storage.sql
  seed.sql
  tests/
    schema.test.sql
    properties_rls.test.sql
    storage_rls.test.sql
    enquiries_rls.test.sql
    listing_workflow.test.sql
scripts/
  seed-property-images.mjs
src/
  app/
    page.tsx
    loading.tsx
    error.tsx
    auth/{login,signup,recover,callback}/...
    dashboard/{layout,properties,properties/new,properties/[id]}/...
    admin/{layout,listings,listings/[id]}/...
    actions/{auth,properties,moderation,enquiries}.ts
  components/
    properties/PropertyExplorer.tsx
    auth/*.tsx
    dashboard/*.tsx
    admin/*.tsx
    enquiries/EnquiryForm.tsx
  features/properties/
    repository.ts
    supabase-repository.ts
    mapper.ts
    schemas.ts
  lib/supabase/{browser,server,proxy}.ts
  proxy.ts
  types/database.generated.ts
  types/managed-property.ts
tests/e2e/property-workflow.spec.ts
```

---

### Task 1: Establish reproducible Supabase schema and generated types

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.env.example`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/<timestamp>_stage3_core_schema.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/schema.test.sql`
- Create: `src/types/database.generated.ts`

**Interfaces:**
- Produces: `profiles`, `properties`, `property_images`, `enquiries`, and `listing_approvals`; database enums; `Database` generated type.
- Consumes: the approved role, lifecycle, published-edit, and seed decisions from the spec.

- [ ] **Step 1: Add failing schema tests**

Create pgTAP assertions for each table, enum, foreign key, unique/positive/range constraint, required lifecycle timestamp column, index, and RLS-enabled flag. Include checks that latitude accepts `21.1458` but rejects `91`, price rejects `0`, and image positions reject `12`.

- [ ] **Step 2: Run the schema test to verify RED**

Run: `npx supabase start && npx supabase test db supabase/tests/schema.test.sql`

Expected: FAIL because application relations do not exist.

- [ ] **Step 3: Write the core migration**

Create the approved enums and tables exactly as specified. Add `revision_of uuid null references public.properties(id)`, timestamps, update triggers, B-tree indexes, and `extensions.geography(Point,4326)` plus GiST index. Enable RLS immediately after each table is created; do not add policies in this task.

- [ ] **Step 4: Add local configuration and safe environment template**

Install CLI, Supabase JS/SSR, and Zod dependencies. Add `.env.example` with blank values, explicitly unignore it with `!.env.example`, and ignore `/supabase/.temp/` and `/supabase/.branches/`.

- [ ] **Step 5: Reset and generate types**

Run:

```powershell
npx supabase db reset --local
npx supabase gen types typescript --local | Set-Content src/types/database.generated.ts
npx supabase test db supabase/tests/schema.test.sql
```

Expected: reset succeeds and schema tests pass.

- [ ] **Step 6: Add deterministic local seed rows**

Seed role-specific test users and the nine Nagpur property records using stable UUIDs. Keep them non-production fixtures and map image metadata to Storage paths, not public URLs.

- [ ] **Step 7: Verify generated-type drift**

Regenerate to a temporary path and compare it byte-for-byte with `src/types/database.generated.ts`. Expected: no diff.

- [ ] **Step 8: Commit**

```powershell
git add .gitignore .env.example package.json package-lock.json supabase src/types/database.generated.ts
git commit -m "feat: define SAT12 property database schema"
```

---

### Task 2: Implement roles, RLS, and lifecycle functions

**Files:**
- Create: `supabase/migrations/<timestamp>_stage3_auth_and_rls.sql`
- Create: `supabase/tests/properties_rls.test.sql`
- Create: `supabase/tests/enquiries_rls.test.sql`
- Create: `supabase/tests/listing_workflow.test.sql`

**Interfaces:**
- Produces: `private.is_admin()`, `private.is_owner_agent()`, `submit_listing(uuid)`, `approve_listing(uuid,text)`, `reject_listing(uuid,text)`, `publish_listing(uuid)`, `archive_listing(uuid)`, and admin-only `set_user_role(uuid,app_role)`.
- Consumes: schema from Task 1 and the authenticated UID/JWT supplied by Supabase Auth.

- [ ] **Step 1: Write failing role and ownership tests**

Use Supabase test helpers to authenticate as anonymous, user A, owner A, owner B, and admin. Assert public published visibility, owner-only draft visibility, denial of user listing creation, denial of cross-owner access, and denial of direct role/status/badge updates.

- [ ] **Step 2: Write failing workflow tests**

Assert `draft -> submitted -> approved -> published`, rejection back to editable state, required rejection notes, immutable approval rows, single event per successful decision, and rejection of stale/repeated/concurrent transitions.

- [ ] **Step 3: Write failing enquiry policy tests**

Assert only the approved guest/authenticated model can insert; sender reads own rows; property owner reads and changes status only; unrelated users cannot read; admin can review all; identity/message/property fields are immutable after insert.

- [ ] **Step 4: Run database tests to verify RED**

Run: `npx supabase test db supabase/tests/properties_rls.test.sql supabase/tests/enquiries_rls.test.sql supabase/tests/listing_workflow.test.sql`

Expected: FAIL because policies/functions do not exist.

- [ ] **Step 5: Implement profile bootstrap and private helpers**

Create an Auth-user trigger that always defaults role to `user`. Put security-definer helpers in non-exposed `private`, use `set search_path = ''`, schema-qualify references, revoke default execute privileges, and grant only intended roles/functions.

- [ ] **Step 6: Implement narrow RLS policies and column grants**

Name the target role in every policy. Use `(select auth.uid())`, owner/status predicates, and indexed columns. Do not use user-editable `raw_user_meta_data` for authorization.

- [ ] **Step 7: Implement atomic lifecycle functions**

Lock the target property row, validate source status/caller role/completeness, insert approval snapshot, update timestamps/status, and return the updated row. Raise stable SQLSTATE/error codes for stale state and validation failures.

- [ ] **Step 8: Run all database tests**

Run: `npx supabase db reset --local && npx supabase test db`

Expected: all schema, RLS, enquiry, and workflow tests pass.

- [ ] **Step 9: Commit**

```powershell
git add supabase/migrations supabase/tests
git commit -m "feat: secure SAT12 listings with RLS workflows"
```

---

### Task 3: Secure private property-image storage

**Files:**
- Create: `supabase/migrations/<timestamp>_stage3_storage.sql`
- Create: `supabase/tests/storage_rls.test.sql`
- Create: `scripts/seed-property-images.mjs`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces: private `property-images` bucket and policy-controlled paths `{ownerId}/{propertyId}/{imageId}.{ext}`.
- Consumes: property ownership/editable-state helpers from Task 2.

- [ ] **Step 1: Write failing Storage policy tests**

Cover owner upload to the correct prefix, cross-owner prefix denial, unsupported bucket/path denial, update/upsert denial, editable-state delete, submitted/published delete denial, and authorized signed-download prerequisites.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npx supabase test db supabase/tests/storage_rls.test.sql`

Expected: FAIL because the bucket/policies do not exist.

- [ ] **Step 3: Create bucket and object policies**

Create the private bucket with 5 MB limit and `image/jpeg,image/png,image/webp`. Add `storage.objects` policies tied to path owner, property owner, and editable state. Never grant blanket public read or service-role behavior to browser roles.

- [ ] **Step 4: Add repeatable fixture upload script**

Read local WebPs from `public/images/properties`, upload with the local service credential only, fail if required env values are absent, and avoid printing secrets. Use unique immutable paths and no `upsert`.

- [ ] **Step 5: Run database and seed verification**

Run:

```powershell
npx supabase db reset --local
node scripts/seed-property-images.mjs
npx supabase test db
```

Expected: all tests pass and nine fixture objects exist at expected paths.

- [ ] **Step 6: Commit**

```powershell
git add supabase scripts
git commit -m "feat: secure SAT12 property image storage"
```

---

### Task 4: Add SSR clients, session refresh, and role-aware auth

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/proxy.ts`
- Create: `src/features/auth/authorization.ts`
- Create: `src/features/auth/authorization.test.ts`
- Create: `src/app/auth/login/page.tsx`
- Create: `src/app/auth/signup/page.tsx`
- Create: `src/app/auth/recover/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/actions/auth.ts`
- Create: `src/components/auth/AuthForm.tsx`

**Interfaces:**
- Produces: `createBrowserClient()`, `createServerClient()`, `updateSession(request)`, `requireUser()`, `requireRole(roles)`, and validated auth actions.
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, cookie APIs, and verified `getClaims()` output.

- [ ] **Step 1: Write failing authorization tests**

Mock `getClaims()` and profile reads. Cover valid user/owner/admin, expired token, missing claims, spoofed session-only data, disabled user, and unsafe external return paths.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/features/auth/authorization.test.ts`

Expected: FAIL because authorization helpers do not exist.

- [ ] **Step 3: Implement environment validation and clients**

Validate public variables at client creation. Add `server-only` to server modules. Follow installed Next.js 16 cookie APIs and Supabase SSR guidance; never instantiate a service-role client in request UI code.

- [ ] **Step 4: Implement narrow Proxy refresh**

Refresh sessions only on routes needing Supabase/auth context. Preserve response cookies exactly and exclude static assets, image optimization, and public property image responses.

- [ ] **Step 5: Implement verified authorization helpers**

Use `getClaims()` for identity, load authoritative role under RLS, and return typed principals. Redirect pages but return typed authorization errors from Server Actions.

- [ ] **Step 6: Add accessible auth flows**

Use Server Actions with Zod, `useActionState`, pending buttons, field/form errors, safe relative redirects, email verification, password login, logout, and recovery according to approved providers.

- [ ] **Step 7: Run focused and full frontend checks**

Run: `npm test -- src/features/auth/authorization.test.ts && npm test && npm run lint && npm run typecheck`

Expected: all pass.

- [ ] **Step 8: Commit**

```powershell
git add src package.json package-lock.json
git commit -m "feat: add secure Supabase authentication"
```

---

### Task 5: Introduce the property repository and preserve Stage 2 behavior

**Files:**
- Create: `src/features/properties/repository.ts`
- Create: `src/features/properties/mapper.ts`
- Create: `src/features/properties/mapper.test.ts`
- Create: `src/features/properties/supabase-repository.ts`
- Create: `src/features/properties/supabase-repository.test.ts`
- Create: `src/components/properties/PropertyExplorer.tsx`
- Modify: `src/types/property.ts`
- Modify: `src/app/page.tsx`
- Create: `src/app/loading.tsx`
- Create: `src/app/error.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `PropertyRepository`, `mapPublishedProperty(row, primaryImageUrl): Property`, and `PropertyExplorer({ initialProperties })`.
- Consumes: generated `Database` types, server Supabase client, private-image signed URLs, and all Stage 2 hooks/components.

- [ ] **Step 1: Write failing mapper tests**

Cover all database enums, Buy/Rent price semantics, plot zero bedrooms/bathrooms, badge mapping, stable UUID, coordinate order, absent primary image placeholder, malformed row rejection, `listing` labelling for owner uploads, and `illustrative` labelling for seed records.

- [ ] **Step 2: Write failing repository tests**

Cover published-only selection, primary image ordering, stable newest-first ordering, signed URL generation, empty inventory, database error propagation, and partial signed-image failure without leaking paths.

- [ ] **Step 3: Run focused tests to verify RED**

Run: `npm test -- src/features/properties/mapper.test.ts src/features/properties/supabase-repository.test.ts`

Expected: FAIL because repository modules do not exist.

- [ ] **Step 4: Implement repository and mapper**

Select an explicit column list rather than `*`. Return `readonly Property[]`. Replace the mock-specific image license union with `kind: "listing" | "illustrative"`; keep the same card rendering and truthful alt text. Keep SQL/database names inside the feature boundary and current display types outside it.

- [ ] **Step 5: Extract the client coordinator without behavior changes**

Move the current `page.tsx` client state/render tree verbatim into `PropertyExplorer`. Replace `NAGPUR_PROPERTIES` with `initialProperties`; keep ordinary-filter and map-bounds derivation unchanged.

- [ ] **Step 6: Make the page server-first and stream data**

Load published rows in a nested async component behind `Suspense`. Add route loading, recoverable database error, and zero-inventory presentation that are visually consistent with SAT12.

- [ ] **Step 7: Configure signed image hosts safely**

Allow only the selected Supabase project host through `remotePatterns`; do not use an unrestricted hostname or wildcard protocol.

- [ ] **Step 8: Prove Stage 2 parity**

Update page tests to inject repository results and assert ordinary filters feed both views, map bounds narrow cards only, selection still synchronizes, and mobile toggling remains unchanged. Run all existing tests.

- [ ] **Step 9: Commit**

```powershell
git add src next.config.ts
git commit -m "feat: load SAT12 properties from Supabase"
```

---

### Task 6: Build owner draft editing and image management

**Files:**
- Create: `src/types/managed-property.ts`
- Create: `src/features/properties/schemas.ts`
- Create: `src/features/properties/schemas.test.ts`
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/properties/page.tsx`
- Create: `src/app/dashboard/properties/new/page.tsx`
- Create: `src/app/dashboard/properties/[id]/page.tsx`
- Create: `src/app/actions/properties.ts`
- Create: `src/components/dashboard/PropertyEditor.tsx`
- Create: `src/components/dashboard/PropertyImageManager.tsx`
- Create: `src/components/dashboard/SubmissionStatus.tsx`
- Create: corresponding component/action tests

**Interfaces:**
- Produces: `createDraft`, `updateDraft`, `deleteDraft`, `recordPropertyImage`, `deletePropertyImage`, and `submitListing` actions with typed `ActionState`.
- Consumes: owner authorization, repository, lifecycle RPCs, Storage policies, and approved workflow decisions.

- [ ] **Step 1: Write failing validation tests**

Test trimmed title/description/locality, positive INR/area, Nagpur coordinate ranges, plot bedroom rules, RERA fields, image count 1–12, alt text, MIME whitelist, 5 MB maximum, and malicious filenames/path segments.

- [ ] **Step 2: Write failing action tests**

Cover unauthenticated, wrong role, cross-owner ID, immutable state, stale update, Zod failure, RLS failure, successful draft mutation, upload metadata mismatch, retryable image failure, and submission completeness.

- [ ] **Step 3: Run focused tests to verify RED**

Run: `npm test -- src/features/properties/schemas.test.ts src/app/actions/properties.test.ts`

Expected: FAIL because schemas/actions do not exist.

- [ ] **Step 4: Implement schemas and actions**

Validate all input server-side, derive owner from verified identity, allowlist database fields, call lifecycle RPCs instead of status updates, map stable database errors to user-safe messages, and revalidate affected routes after success.

- [ ] **Step 5: Implement owner dashboard pages**

Protect layout with `requireRole(['owner_agent','admin'])`. Provide listing status, rejection notes, create/edit controls only in editable states, and accessible pending/success/error states without changing public SAT12 styling.

- [ ] **Step 6: Implement image manager**

Use unique paths, validate before upload, record metadata after upload, clean up a newly uploaded orphan if metadata insertion fails, and never use upsert. Keep draft intact on failure.

- [ ] **Step 7: Run focused, full, and database tests**

Run: `npm test && npx supabase test db && npm run lint && npm run typecheck`

Expected: all pass.

- [ ] **Step 8: Commit**

```powershell
git add src
git commit -m "feat: add owner property management"
```

---

### Task 7: Build auditable admin moderation

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/listings/page.tsx`
- Create: `src/app/admin/listings/[id]/page.tsx`
- Create: `src/app/actions/moderation.ts`
- Create: `src/components/admin/ModerationQueue.tsx`
- Create: `src/components/admin/ListingReview.tsx`
- Create: `src/components/admin/ApprovalHistory.tsx`
- Create: corresponding tests

**Interfaces:**
- Produces: approve, reject, publish, archive, badge, and role-management UI/actions.
- Consumes: admin authorization and Task 2 lifecycle functions.

- [ ] **Step 1: Write failing moderation action tests**

Cover missing/expired session, non-admin, stale state, mandatory rejection notes, double submission, conflicting concurrent decision, immutable snapshot, badge allowlist, successful approve/reject/publish/archive, and route revalidation.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/app/actions/moderation.test.ts`

Expected: FAIL because moderation actions do not exist.

- [ ] **Step 3: Implement actions as thin RPC callers**

Verify claims/role, validate inputs, call database transition functions with the user's client, translate known errors, and avoid service-role bypasses.

- [ ] **Step 4: Implement protected review UI**

Show submitted queue, complete listing/image preview, approval history, clear decision dialogs, required rejection notes, disabled pending controls, and success/error announcements.

- [ ] **Step 5: Test published visibility transition**

Assert an approved-but-unpublished listing is absent from the public repository and appears after publish; archive removes it without deleting history/enquiries.

- [ ] **Step 6: Run all checks and commit**

Run: `npm test && npx supabase test db && npm run lint && npm run typecheck`

Then:

```powershell
git add src
git commit -m "feat: add SAT12 listing moderation"
```

---

### Task 8: Add secure enquiries

**Files:**
- Create: `src/app/actions/enquiries.ts`
- Create: `src/components/enquiries/EnquiryForm.tsx`
- Create: `src/app/dashboard/enquiries/page.tsx`
- Create: corresponding tests
- Modify the selected property detail/preview entry point only as approved

**Interfaces:**
- Produces: `createEnquiry` and `updateEnquiryStatus` actions.
- Consumes: published property ID, approved auth/guest model, and enquiry RLS.

- [ ] **Step 1: Write failing validation and authorization tests**

Cover invalid property, unpublished property, unauthenticated behavior, mismatched sender ID, field length/email/phone validation, repeated submission, cross-owner inbox access, allowed status changes, and immutable message fields.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/app/actions/enquiries.test.ts src/components/enquiries/EnquiryForm.test.tsx`

Expected: FAIL because enquiry behavior does not exist.

- [ ] **Step 3: Implement actions and accessible form**

Derive sender identity server-side, validate and insert under RLS, return a generic success response, avoid exposing owner contact data, and provide pending/success/error status.

- [ ] **Step 4: Implement owner/admin inbox**

Show only policy-visible enquiries, status filters, property context, and safe status transitions.

- [ ] **Step 5: Run full checks and commit**

Run: `npm test && npx supabase test db && npm run lint && npm run typecheck`

Then:

```powershell
git add src
git commit -m "feat: add secure property enquiries"
```

---

### Task 9: Add end-to-end workflow and security regression coverage

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/property-workflow.spec.ts`
- Create: `tests/e2e/auth-access.spec.ts`
- Create: `scripts/check-client-secrets.mjs`
- Create: CI workflow file matching repository conventions

**Interfaces:**
- Produces: repeatable browser workflow and bundle/source secret checks.
- Consumes: complete Stage 3 local stack and role fixtures.

- [ ] **Step 1: Write the owner-to-public E2E test**

Log in as owner, create/edit a draft, upload a valid image, submit, verify edit lock, log in as admin, approve/publish, log out, and assert the public card and marker appear with filters/map synchronization intact.

- [ ] **Step 2: Write access-denial E2E tests**

Verify user cannot access owner/admin pages, owner A cannot open owner B draft/image, return URLs cannot redirect off-site, and expired auth redirects safely.

- [ ] **Step 3: Add secret boundary check**

Scan `src` client modules and `.next/static` after build for `SUPABASE_SERVICE_ROLE_KEY`, database password names/values, and imports from privileged server modules. Exit nonzero on any match.

- [ ] **Step 4: Run E2E RED/GREEN cycle**

Run: `npx playwright test`

Expected after implementation: all supported desktop/mobile projects pass with no console errors.

- [ ] **Step 5: Add CI pipeline**

Start Supabase, reset migrations, run pgTAP, regenerate/compare database types, then run npm tests, lint, typecheck, build, secret check, and Playwright. Pin action majors and keep remote deployment credentials out of pull-request jobs.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json playwright.config.ts tests scripts .github
git commit -m "test: verify SAT12 backend workflows"
```

---

### Task 10: Stage, document, and verify deployment readiness

**Files:**
- Modify: `README.md`
- Create: `docs/stage3-local-development.md`
- Create: `docs/stage3-deployment-runbook.md`
- Create: `docs/screenshots/sat12-stage3-owner-dashboard.png`
- Create: `docs/screenshots/sat12-stage3-admin-review.png`
- Create: `docs/screenshots/sat12-stage3-public-desktop.png`
- Create: `docs/screenshots/sat12-stage3-public-mobile.png`
- Modify only defects proven by tests/verification

**Interfaces:**
- Produces: teammate setup instructions, staging checklist, rollback procedure, and final evidence.
- Consumes: approved environment topology and completed Tasks 1–9.

- [ ] **Step 1: Document local setup without secrets**

Include Docker/CLI prerequisites, `.env.example` copy, `npx supabase start`, `db reset --local`, fixture upload, type generation, tests, and `npm run dev`. Explain which keys are public and which must remain server/CI-only.

- [ ] **Step 2: Document forward-only deployment**

Include backup, `migration list`, staging `db push`, generated-type verification, application deploy order, smoke tests for each role, monitoring, and forward corrective migration rollback. Explicitly prohibit `db reset --linked` on production.

- [ ] **Step 3: Run the complete clean verification sequence**

Run:

```powershell
npm ci
npx supabase start
npx supabase db reset --local
npx supabase test db
npm test
npm run lint
npm run typecheck
npm run build
node scripts/check-client-secrets.mjs
npx playwright test
```

Expected: every command exits 0; no client secret match; existing Stage 2 tests remain green.

- [ ] **Step 4: Perform real browser verification**

At 1536×1024 and 390×844 verify public 30/70 layout, three result columns where space permits, markers/clusters, filter/map behavior, loading/error/empty states, login/recovery, owner draft/upload/submit, admin approval/publish, enquiry flow, keyboard navigation, focus, reduced motion, and no horizontal overflow.

- [ ] **Step 5: Save screenshots and inspect console/network**

Save the four named screenshots. Confirm no service-role key, database password, private object path without authorization, hydration error, or uncaught request error appears.

- [ ] **Step 6: Verify Git scope and commit**

Confirm no `.env*` secrets, `.next`, `node_modules`, Supabase temp state, or unrelated UI changes are staged. Then:

```powershell
git add README.md docs src supabase tests scripts package.json package-lock.json playwright.config.ts .github .gitignore .env.example
git commit -m "docs: verify SAT12 stage three readiness"
```

## Plan self-review

- **Spec coverage:** schema, Auth/RBAC, RLS, workflows, Storage, live-data migration, all database states, environment setup, migrations, testing, deployment, and incremental preservation each map to explicit tasks.
- **Boundary consistency:** all public UI consumes `Property[]`; managed fields use `ManagedProperty`; only repository/mappers know generated database row shapes.
- **Security consistency:** normal requests use caller-scoped clients; RLS remains authoritative; lifecycle changes use RPCs; service credentials are limited to trusted local/CI operations.
- **State consistency:** `properties.status` is current state, `listing_approvals` is immutable history, and only published rows reach anonymous inventory.
- **No unresolved implementation placeholders:** product choices intentionally remain in the spec's approval list and must be resolved before Task 1.
