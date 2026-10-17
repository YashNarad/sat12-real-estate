# SAT12 Stage 3 Supabase Property Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure Supabase-backed property-management system while preserving the complete Stage 2 SAT12 public search and interactive map experience.

**Architecture:** PostgreSQL and Storage are protected by RLS and lifecycle functions; Supabase Auth supplies cookie-backed identity. A server-side repository maps published rows into the existing `Property[]` contract, while the current page coordinator moves unchanged into a Client Component. Owner/admin mutations use validated Server Actions with the caller's Supabase session, never a browser-visible service-role key.

**Tech Stack:** Next.js App Router 16.4, React 19, TypeScript, Tailwind CSS 4, the existing `sat12-real-estate` Supabase Cloud Development project in `ap-south-1` with Auth/PostgreSQL/Storage, `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI (no Docker), PostgreSQL/PostGIS, Zod, pgTAP, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-sat12-stage-3-supabase-property-management-design.md`

## Global Constraints

- Apply the approved product decisions exactly as recorded in the spec. Local preparation may proceed; every remote operation is blocked until the user supplies the existing Development project reference, confirms it contains no production customer data, and approves the exact operation.
- Preserve SAT12 red `#DC0011`, charcoal, white, light gray, the approximately 30/70 desktop map/results layout, responsive result columns, and mobile Map/List behavior.
- Preserve the invariant: ordinary filters control map markers and listings; map bounds narrow listings only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_PASSWORD` to Client Components, `NEXT_PUBLIC_*` variables, browser responses, logs, or committed files.
- Enable RLS on every exposed application table and Storage access path; do not add permissive temporary policies.
- Keep applied migrations forward-only and review SQL before committing.
- Keep the nine Nagpur mock records as deterministic Development/Staging fixtures only; seed tooling must refuse unknown and Production project references and require separate approval before any upload.
- Require verified TOTP/AAL2 for every administrator read or mutation; an admin role at AAL1 has no administrative authority.
- Preserve stable property IDs/slugs and enquiry links across copy-on-revision publication.
- Do not install, start, or depend on Docker or local Supabase containers.
- Never run `supabase db reset` against a cloud project. Before every `db push`, verify the allowlisted project reference, run `migration list --linked`, and review `db push --linked --dry-run`.
- Use the single Development project for transactionally rolled-back database tests. Do not require or create a Test project, and never run destructive reset/replay tests against Development, Staging, or Production.
- Keep production retention scheduling disabled until the provisional policy completes legal review.
- Do not implement payments, subscriptions, persistent favorites, alerts, KYC, multi-city search, or unrelated UI redesign.

## Review Focus

- Expired/spoofed/AAL1-admin sessions must fail closed: protected pages and actions validate claims/AAL, and RLS rejects the mutation.
- Cross-owner property IDs or Storage paths must never allow reading, editing, or deleting another owner's draft or images.
- Repeated/concurrent lifecycle commands must perform one valid transition and reject stale requests without duplicate approval events or an inconsistent published pointer.
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
  tests/
    schema.test.sql
    properties_rls.test.sql
    storage_rls.test.sql
    enquiries_rls.test.sql
    listing_workflow.test.sql
    retention.test.sql
scripts/
  seed-property-images.mjs
  bootstrap-admin.mjs
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
  features/retention/{repository,types}.ts
  proxy.ts
  types/database.generated.ts
  types/managed-property.ts
tests/e2e/property-workflow.spec.ts
```

---

### Task 1: Establish the Docker-free Cloud Development foundation

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.env.example`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/<timestamp>_stage3_core_schema.sql`
- Create: `supabase/tests/schema.test.sql`
- Create: `scripts/assert-supabase-target.mjs`
- Create: `scripts/run-cloud-db-tests.mjs`
- Create: `scripts/seed-cloud-fixtures.mjs`
- Create: `src/types/database.generated.ts`

**Interfaces:**
- Produces: `profiles`, stable `properties`, `property_revisions`, `property_images`, `enquiries`, `listing_approvals`, `role_audit_log`, `legal_holds`, and `retention_audit_log`; database enums; `Database` generated type.
- Consumes: the approved role, lifecycle, published-edit, and seed decisions from the spec.

- [ ] **Step 1: Confirm the approved cloud targets without exposing secrets**

Use the existing `sat12-real-estate` project in `ap-south-1`; do not create another project. Before any remote command, require the operator to supply its Project Reference ID locally, confirm it is Development and contains no production customer data, and explicitly approve the operation. Browser-safe values go in ignored `.env.local`; CLI/database secrets stay in the OS credential store, transient environment, or a separate ignored operational file.

- [ ] **Step 2: Add target guards and failing schema tests**

Create a script that compares `SUPABASE_PROJECT_REF`, the Project URL host, and a locally configured `SAT12_APPROVED_PROJECT_REF`; it refuses mismatches, missing development-data confirmation, and unapproved mutation modes. Add a Node `pg` runner that accepts test paths, connects only through ignored `SUPABASE_DB_URL`, executes every pgTAP file transactionally, parses TAP output, always rolls back, and exits nonzero on SQL errors or `not ok`. Create pgTAP assertions for each table, enum, foreign key, unique/positive/range constraint, required lifecycle timestamp column, index, and RLS-enabled flag.

- [ ] **Step 3: Pause at the remote RED gate**

Run only after explicit remote-operation approval:

```powershell
npm run supabase:migrations:preview
npm run test:db:cloud -- supabase/tests/schema.test.sql
```

Expected after explicit authorization: FAIL because application relations do not exist. Do not run this step during local-only preparation.

- [ ] **Step 4: Write the core migration**

Create the approved enums and tables exactly as specified. Add stable `properties.published_revision_id`, versioned `property_revisions.replaces_revision_id`, revision-scoped images, enquiry snapshot revision, timestamps, update triggers, B-tree/partial indexes, and `extensions.geography(Point,4326)` plus GiST index. Resolve the circular stable-pointer FK with an ordered `alter table`. Enable RLS immediately after each table is created; do not add policies in this task.

- [ ] **Step 5: Add CLI configuration and safe environment template**

Install CLI, Supabase JS/SSR, Zod, and the Node PostgreSQL driver dependencies. Add `.env.example` with blank names only, explicitly unignore it with `!.env.example`, and ignore `/supabase/.temp/`, `/.supabase/`, and operational env files. No Docker scripts are added.

- [ ] **Step 6: Preview and apply the migration to Development**

Run:

```powershell
npm run supabase:migrations:apply
npm run test:db:cloud -- supabase/tests/schema.test.sql
```

Expected: the preview lists only reviewed migrations; the push and schema tests pass. Never reset the project.

- [ ] **Step 7: Generate types from approved Development**

After the same approved migration succeeds, run:

```powershell
npx supabase gen types typescript --project-id $env:SUPABASE_PROJECT_REF --schema public | Set-Content src/types/database.generated.ts
```

- [ ] **Step 8: Add deterministic cloud fixture tooling**

Create run-scoped role fixtures and nine stable Nagpur property/revision records using deterministic fixture identifiers. The idempotent script accepts only the exact locally approved Development reference (or separately approved Staging), always refuses unknown/Production targets, maps images to private Storage paths, never prints credentials, and can remove only resources owned by its run ID. Keep fixtures out of schema migrations.

- [ ] **Step 9: Verify generated-type drift**

Regenerate from the approved Development project to a temporary path and compare it byte-for-byte with `src/types/database.generated.ts`. Expected: no diff.

- [ ] **Step 10: Commit**

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
- Produces: `private.is_aal2_admin()`, `private.is_owner_agent()`, `create_draft_listing(...)`, `create_listing_revision(uuid)`, `submit_listing(uuid)`, `approve_listing(uuid,text)`, `reject_listing(uuid,text)`, `publish_listing(uuid)`, `archive_listing(uuid)`, service-role-only `bootstrap_first_admin(uuid,text)`, and AAL2-admin-only `set_user_role(uuid,app_role,text)`.
- Consumes: schema from Task 1 and the authenticated UID/JWT supplied by Supabase Auth.

- [ ] **Step 1: Write failing role and ownership tests**

Use Supabase test helpers to authenticate as anonymous, user A, owner A, owner B, AAL1 admin, and AAL2 admin. Assert public current-revision visibility, owner-only revision visibility, denial of user listing creation, denial of cross-owner access, denial of every AAL1 admin operation, and denial of direct role/status/published-pointer/badge updates.

- [ ] **Step 2: Write failing workflow tests**

Assert revision `draft -> submitted -> approved -> published`, rejection back to editable state, required rejection notes, immutable approval rows, single event per successful decision, and rejection of stale/repeated/concurrent transitions. Publish revision 2 and assert the same stable slug/ID and enquiries remain, revision 1 becomes `superseded`, the pointer changes atomically, and no draft/approved revision is ever public.

- [ ] **Step 3: Write failing enquiry policy tests**

Assert only the approved guest/authenticated model can insert; sender reads own rows; property owner reads and changes status only; unrelated users cannot read; admin can review all; identity/message/property fields are immutable after insert.

- [ ] **Step 4: Run database tests to verify RED**

Run: `node scripts/assert-supabase-target.mjs test && npm run test:db:cloud -- supabase/tests/properties_rls.test.sql supabase/tests/enquiries_rls.test.sql supabase/tests/listing_workflow.test.sql`

Expected: FAIL because policies/functions do not exist.

- [ ] **Step 5: Implement profile bootstrap and private helpers**

Create an Auth-user trigger that always defaults role to `user`. Put security-definer helpers in non-exposed `private`, use `set search_path = ''`, schema-qualify references, revoke default execute privileges, and grant only intended roles/functions. `is_aal2_admin()` must require both database role and JWT `aal2`.

- [ ] **Step 6: Implement narrow RLS policies and column grants**

Name the target role in every policy. Use `(select auth.uid())`, owner/status predicates, and indexed columns. Do not use user-editable `raw_user_meta_data` for authorization.

- [ ] **Step 7: Implement atomic lifecycle functions**

Lock the stable property and target revision, validate source status/caller role/AAL/completeness, insert approval snapshot, update timestamps/status, and return the updated row. Publication must supersede the old revision and switch `published_revision_id` in the same transaction. Raise stable SQLSTATE/error codes for stale state and validation failures.

- [ ] **Step 8: Implement and test first-admin bootstrap**

Add a service-role-only function that accepts one confirmed Auth user, refuses if any admin exists, appends the immutable bootstrap audit record, and never accepts an email/role from browser input. Add `scripts/bootstrap-admin.mjs` that resolves an exact email using a process-only service key, requires an explicit project-ref confirmation, redacts secrets, and calls the function once. Test unconfirmed target, second-run refusal, and ordinary caller denial.

- [ ] **Step 9: Run all database tests**

Run: `npm run supabase:migrations:apply && npm run test:db:cloud`

Expected: all schema, RLS, enquiry, and workflow tests pass.

- [ ] **Step 10: Commit**

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

**Interfaces:**
- Produces: private `property-images` bucket and policy-controlled paths `{ownerId}/{propertyId}/{revisionId}/{imageId}.{ext}`.
- Consumes: property ownership/editable-state helpers from Task 2.

- [ ] **Step 1: Write failing Storage policy tests**

Split coverage by supported execution surface. Transactional pgTAP covers database helpers, metadata RLS, path/ownership decisions, revision visibility, legal holds, and AAL rules. A separately guarded, run-scoped Storage API suite uses authenticated user clients for update/delete behavior, ownership isolation, metadata-first deletion, submitted/published protection, and legal holds. Operator credentials are limited to fixture setup, observation, scoped cleanup, and zero-residue verification. See `docs/superpowers/testing/2026-10-18-stage3-storage-security-testing.md`.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node scripts/assert-supabase-target.mjs test && npm run test:db:cloud -- supabase/tests/storage_rls.test.sql`

Expected: FAIL because the bucket/policies do not exist.

- [ ] **Step 3: Create bucket and object policies**

Create the private bucket with 5 MB limit and `image/jpeg,image/png,image/webp`. Add `storage.objects` policies tied to path owner, property owner, and editable state. Never grant blanket public read or service-role behavior to browser roles.

- [ ] **Step 4: Add repeatable fixture upload script**

Read WebPs from `public/images/properties`, upload only to the exact approved Development project (or separately approved Staging) using a process-only service credential, fail if required env values are absent, and avoid printing secrets. Always refuse unknown/Production targets. Use a unique run prefix, immutable paths, no `upsert`, and scoped cleanup.

- [ ] **Step 5: Run database and seed verification**

Run:

```powershell
npm run supabase:migrations:apply
node scripts/seed-property-images.mjs
npm run test:db:cloud -- supabase/tests/storage_rls.test.sql
npm run test:storage:cloud
```

Expected: transactional database assertions and authenticated Storage API scenarios pass; API fixtures are removed and post-cleanup verification reports zero residual users, properties, revisions, metadata rows, or objects. The nine illustrative fixture objects exist only when their separately approved fixture command is intentionally run.

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
- Create: `src/app/auth/mfa/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/actions/auth.ts`
- Create: `src/components/auth/AuthForm.tsx`

**Interfaces:**
- Produces: `createBrowserClient()`, `createServerClient()`, `updateSession(request)`, `requireUser()`, `requireRole(roles)`, `requireAal2Admin()`, and validated auth/MFA actions.
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, cookie APIs, and verified `getClaims()` output.

- [ ] **Step 1: Write failing authorization tests**

Mock `getClaims()` and profile reads. Cover valid user/owner, AAL1 admin denial, AAL2 admin success, expired token, missing claims, spoofed session-only data, disabled user, and unsafe external return paths.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/features/auth/authorization.test.ts`

Expected: FAIL because authorization helpers do not exist.

- [ ] **Step 3: Implement environment validation and clients**

Validate public variables at client creation. Add `server-only` to server modules. Follow installed Next.js 16 cookie APIs and Supabase SSR guidance; never instantiate a service-role client in request UI code.

- [ ] **Step 4: Implement narrow Proxy refresh**

Refresh sessions only on routes needing Supabase/auth context. Preserve response cookies exactly and exclude static assets, image optimization, and public property image responses.

- [ ] **Step 5: Implement verified authorization helpers**

Use `getClaims()` for identity/AAL, load authoritative role under RLS, and return typed principals. `requireAal2Admin()` requires both role `admin` and claim `aal2`. Redirect pages but return typed authorization errors from Server Actions.

- [ ] **Step 6: Add accessible auth flows**

Use Server Actions with Zod, `useActionState`, pending buttons, field/form errors, safe relative redirects, verified email/password login, logout, and recovery. Add TOTP enrollment, QR/secret confirmation, challenge, factor replacement/recovery UX, and explicit re-authentication before admin routes. Do not add OAuth.

- [ ] **Step 7: Prove MFA enforcement locally**

Test that an admin role with AAL1 is redirected to the MFA challenge and that direct Server Action/RPC attempts fail. Test a valid TOTP challenge produces AAL2 and permits the action in Development using disposable identities and transactional cleanup. If browser and database enforcement cannot both be proved, record production deployment as blocked rather than weakening the rule.

- [ ] **Step 8: Run focused and full frontend checks**

Run: `npm test -- src/features/auth/authorization.test.ts && npm test && npm run lint && npm run typecheck`

Expected: all pass.

- [ ] **Step 9: Commit**

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

Cover stable-property/current-published-revision joins, exclusion of archived listings, primary image ordering, stable newest-first ordering, caller-scoped ten-minute signed URL generation with server caching capped at five minutes, empty inventory, database error propagation, and partial signed-image failure without leaking paths.

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
- Produces: `createDraft`, `createRevision`, `updateDraft`, `deleteDraft`, `recordPropertyImage`, `deletePropertyImage`, and `submitListing` actions with typed `ActionState`.
- Consumes: owner authorization, repository, lifecycle RPCs, Storage policies, and approved workflow decisions.

- [ ] **Step 1: Write failing validation tests**

Test trimmed title/description/locality, positive INR/area, Nagpur coordinate ranges, plot bedroom rules, RERA fields, image count 1–12, alt text, MIME whitelist, 5 MB maximum, and malicious filenames/path segments.

- [ ] **Step 2: Write failing action tests**

Cover unauthenticated, unapproved owner role, cross-owner property/revision IDs, immutable published state, stale update, Zod failure, RLS failure, successful draft mutation, revision cloning, upload metadata mismatch, retryable image failure, and submission completeness. Assert editing a published listing creates a private revision and leaves the public pointer/content unchanged.

- [ ] **Step 3: Run focused tests to verify RED**

Run: `npm test -- src/features/properties/schemas.test.ts src/app/actions/properties.test.ts`

Expected: FAIL because schemas/actions do not exist.

- [ ] **Step 4: Implement schemas and actions**

Validate all input server-side, derive owner from verified identity, allowlist revision fields, call lifecycle RPCs instead of status/pointer updates, map stable database errors to user-safe messages, and revalidate affected routes after success.

- [ ] **Step 5: Implement owner dashboard pages**

Protect layout with `requireRole(['owner_agent','admin'])`. Provide listing status, rejection notes, create/edit controls only in editable states, and accessible pending/success/error states without changing public SAT12 styling.

- [ ] **Step 6: Implement image manager**

Use unique revision-scoped paths, validate before upload, record metadata after upload, clean up a newly uploaded orphan if metadata insertion fails, and never use upsert. Keep draft intact on failure and never mutate images belonging to the current published revision.

- [ ] **Step 7: Run focused, full, and database tests**

Run: `npm test && node scripts/assert-supabase-target.mjs test && npm run test:db:cloud && npm run lint && npm run typecheck`

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
- Produces: AAL2-protected approve, reject, publish, archive, badge, owner-approval, and role-management UI/actions.
- Consumes: admin authorization and Task 2 lifecycle functions.

- [ ] **Step 1: Write failing moderation action tests**

Cover missing/expired session, non-admin, AAL1 admin, stale state, mandatory rejection notes, double submission, conflicting concurrent decision, immutable snapshot, badge allowlist, audited owner approval/role change, successful approve/reject/publish/archive, and route revalidation.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/app/actions/moderation.test.ts`

Expected: FAIL because moderation actions do not exist.

- [ ] **Step 3: Implement actions as thin RPC callers**

Verify claims/role/AAL2, validate inputs, call database transition functions with the user's client, translate known errors, and avoid service-role bypasses.

- [ ] **Step 4: Implement protected review UI**

Show submitted queue, complete listing/image preview, approval history, clear decision dialogs, required rejection notes, disabled pending controls, and success/error announcements.

- [ ] **Step 5: Test published visibility transition**

Assert an approved-but-unpublished revision is absent from the public repository and appears only after publish; publishing a revision swaps content at the same slug/property ID and supersedes the previous revision; archive removes it without deleting history/enquiries.

- [ ] **Step 6: Run all checks and commit**

Run: `npm test && node scripts/assert-supabase-target.mjs test && npm run test:db:cloud && npm run lint && npm run typecheck`

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

Cover invalid property, archived/unpublished property, unauthenticated rejection, mismatched sender ID, field length/email/phone validation, repeated submission, cross-owner inbox access, allowed status changes, and immutable message fields. Record the current published revision ID while linking the enquiry to the stable property ID.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/app/actions/enquiries.test.ts src/components/enquiries/EnquiryForm.test.tsx`

Expected: FAIL because enquiry behavior does not exist.

- [ ] **Step 3: Implement actions and accessible form**

Derive sender identity server-side, validate and insert under RLS, return a generic success response, avoid exposing owner contact data, and provide pending/success/error status.

- [ ] **Step 4: Implement owner/admin inbox**

Show only policy-visible enquiries, status filters, property context, and safe status transitions.

- [ ] **Step 5: Run full checks and commit**

Run: `npm test && node scripts/assert-supabase-target.mjs test && npm run test:db:cloud && npm run lint && npm run typecheck`

Then:

```powershell
git add src
git commit -m "feat: add secure property enquiries"
```

---

### Task 9: Add provisional retention and safe anonymization workflows

**Files:**
- Create: `supabase/migrations/<timestamp>_stage3_retention.sql`
- Create: `supabase/tests/retention.test.sql`
- Create: `src/features/retention/types.ts`
- Create: `src/features/retention/repository.ts`
- Create: `src/app/admin/retention/page.tsx`
- Create: `src/app/actions/retention.ts`
- Create: corresponding application tests

**Interfaces:**
- Produces: `retention_candidates(as_of)`, `apply_retention(candidate_ids, dry_run)`, legal-hold fields, immutable `retention_audit_log`, and an AAL2-admin dry-run/review UI.
- Consumes: stable property/revision relationships, image paths, enquiry states, approval history, and provisional periods approved in the spec.

- [ ] **Step 1: Write failing retention database tests**

Assert eligibility at exact boundaries: rejected revisions after 90 inactive days and only after revision notice/not-before dates; archived listings after 2 years; orphaned Storage objects or images belonging only to expired discarded drafts after 30 days; closed enquiries after 12 months from `closed_at`; approval history after 3 years. Assert active/directly held/dependency-held/referenced/current-published records are excluded.

- [ ] **Step 2: Write failing safety tests**

Assert dry-run changes nothing, execution is idempotent, batches are bounded, object deletion failure preserves metadata for retry, enquiry PII is anonymized rather than breaking the stable property link, audit rows are append-only, cascades cannot bypass another record's longer retention, and AAL1/non-admin callers are denied.

- [ ] **Step 3: Run focused tests to verify RED**

Run: `node scripts/assert-supabase-target.mjs test && npm run test:db:cloud -- supabase/tests/retention.test.sql`

Expected: FAIL because retention functions/fields do not exist.

- [ ] **Step 4: Implement candidate and execution functions**

Use explicit `as_of`, legal-hold predicates, owner-notice guard fields, row locks, candidate IDs, batch maximum, and one audit result per candidate. Keep automatic scheduling absent. Approval-history expiry must return `blocked_pending_legal_rule` until legal chooses deletion versus anonymization.

- [ ] **Step 5: Implement Storage cleanup as a two-phase operation**

An AAL2 server action reads eligible image candidates, deletes each private object using the caller-scoped Supabase client under a retention-specific AAL2 Storage policy, then calls a database finalizer that re-checks eligibility/reference state and removes metadata. Record retryable failures without exposing keys or paths to unauthorized users; do not bypass Storage RLS with the service role.

- [ ] **Step 6: Add admin dry-run/review UI**

Show counts and reasons by category, legal-hold exclusions, notification readiness, dry-run output, typed confirmation, execution result, and explicit “automatic scheduling disabled pending legal review” status.

- [ ] **Step 7: Run all checks and commit**

Run: `node scripts/assert-supabase-target.mjs test && npm run test:db:cloud && npm test && npm run lint && npm run typecheck`

Then:

```powershell
git add supabase src
git commit -m "feat: add safe SAT12 retention workflows"
```

---

### Task 10: Add cloud E2E/security coverage and deployment readiness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/property-workflow.spec.ts`
- Create: `tests/e2e/auth-access.spec.ts`
- Create: `scripts/check-client-secrets.mjs`
- Create: CI workflow file matching repository conventions
- Modify: `README.md`
- Create: `docs/stage3-cloud-development.md`
- Create: `docs/stage3-deployment-runbook.md`
- Create: `docs/stage3-retention-policy.md`
- Create: `docs/screenshots/sat12-stage3-owner-dashboard.png`
- Create: `docs/screenshots/sat12-stage3-admin-review.png`
- Create: `docs/screenshots/sat12-stage3-public-desktop.png`
- Create: `docs/screenshots/sat12-stage3-public-mobile.png`

**Interfaces:**
- Produces: repeatable browser workflow, bundle/source secret checks, teammate cloud setup, deployment gates, and final verification evidence.
- Consumes: the approved Development target and run-scoped role fixtures.

- [ ] **Step 1: Write the owner-to-public E2E test**

Log in as an admin-approved owner, create/edit a draft, upload a valid image, submit, verify edit lock, log in as an AAL2 admin, approve then separately publish, log out, and assert the public card and marker appear with filters/map synchronization intact. Create revision 2, repeat moderation, and assert the same public URL/enquiries now resolve to revision 2 while revision 1 is superseded.

- [ ] **Step 2: Write access-denial E2E tests**

Verify an unapproved user cannot access owner tools, owner A cannot open owner B draft/revision/image, AAL1 admin cannot access admin data/actions, return URLs cannot redirect off-site, and expired auth redirects safely.

- [ ] **Step 3: Add secret boundary check**

Scan `src` client modules and `.next/static` after build for `SUPABASE_SERVICE_ROLE_KEY`, database password names/values, and imports from privileged server modules. Exit nonzero on any match.

- [ ] **Step 4: Run E2E RED/GREEN cycle**

Run: `npx playwright test`

Expected after implementation: all supported desktop/mobile projects pass with no console errors.

- [ ] **Step 5: Add a Docker-free CI pipeline**

Do not configure remote database CI while the only available target is the shared Development project. Local CI may run application tests, lint, typecheck, build, and secret checks. Database/E2E cloud jobs remain manual, serialized, guarded, and explicitly approved; they run transactional pgTAP and run-scoped fixtures against Development without resets. A future Staging/Production pipeline requires separate approval and credentials.

- [ ] **Step 6: Document cloud setup and forward-only deployment**

Document Dashboard creation, `.env.example`, CLI login/link, target verification, migration list/dry-run/push, fixture setup, the Node-based cloud pgTAP runner, remote type generation, and `npm run dev`. Explain public versus operational secrets and least-privilege teammate access. For Staging/Production, require separate projects, backup, migration history review, explicit approval, schema-first compatible deploy, role smoke tests, bootstrap/TOTP recovery, monitoring, and forward corrective migrations. Prohibit all cloud resets.

- [ ] **Step 7: Document retention and launch blockers**

Record provisional periods, notices, legal holds, anonymization, audit evidence, and the disabled automatic schedule. List hard blockers: unconfirmed Development data classification, absent future Staging/Production targets, unverified AAL2/recovery, missing production email delivery/backup owner, and incomplete legal review.

- [ ] **Step 8: Run the complete Docker-free verification gate**

After explicit approval of the Development operations:

```powershell
npm ci
npm run supabase:migrations:apply
npm run test:db:cloud
npm test
npm run lint
npm run typecheck
npm run build
node scripts/check-client-secrets.mjs
npx playwright test
```

All commands must exit zero, generated types must match Development, and Stage 2 tests remain green. No reset is run.

- [ ] **Step 9: Perform real browser verification and save evidence**

At 1536×1024 and 390×844 verify the public 30/70 layout, three result columns where space permits, markers/clusters, filtering/map behavior, database states, login/recovery, owner approval/draft/upload/submit, AAL1 admin denial, TOTP/AAL2 moderation, same-URL revision cutover, authenticated enquiries, retention dry-run, keyboard/focus/reduced-motion behavior, and no overflow. Save the four screenshots and inspect console/network for leaked credentials, unauthorized private paths, hydration failures, or uncaught errors.

- [ ] **Step 10: Verify Git scope and commit**

Confirm no `.env*` secrets, `.next`, `node_modules`, Supabase temporary state, fixtures containing credentials, or unrelated UI changes are staged.

```powershell
git add README.md docs supabase src tests scripts package.json package-lock.json playwright.config.ts .github .gitignore .env.example
git commit -m "test: verify SAT12 cloud backend readiness"
```

## Plan self-review

- **Spec coverage:** schema, Auth/RBAC, RLS, workflows, Storage, live-data migration, all database states, environment setup, migrations, testing, deployment, and incremental preservation each map to explicit tasks.
- **Boundary consistency:** all public UI consumes `Property[]`; managed fields use `ManagedProperty`; only repository/mappers know generated database row shapes.
- **Security consistency:** normal requests use caller-scoped clients; RLS remains authoritative; lifecycle changes use RPCs; operational credentials are limited to trusted developer workstations/CI and never committed or exposed to browsers.
- **State consistency:** `properties` owns stable URL/ownership/public pointer; `property_revisions.status` owns workflow state; `listing_approvals` is immutable revision history; only the current published pointer reaches anonymous inventory.
- **Approval consistency:** all ten product choices are resolved. Local preparation is authorized; remote implementation begins only after the existing Development reference, data classification, and exact operations are approved. Staging/Production provisioning, deployment, production launch, and retention automation retain separate external gates.
