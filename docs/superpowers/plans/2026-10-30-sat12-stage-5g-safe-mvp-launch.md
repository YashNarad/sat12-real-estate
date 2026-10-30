# SAT12 Stage 5G Safe MVP Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a professional browse-only Nagpur catalogue containing published Properties, New Projects, and Locations, without enabling buyer enquiries.

**Architecture:** Preserve the existing Next.js/Supabase security model. New Projects mirror the proven stable-record, revision, exact published-pointer, private-gallery, owner submission, AAL2 moderation, and immutable-audit pattern used for properties. Locations use a separately curated, versioned taxonomy; owner-entered locality text never creates public location content. Builders remain a reviewed `builder_name` string on project revisions—there is no builder profile table or Builders route.

**Tech Stack:** Next.js 16.4.1, React 19.3, Supabase Auth/PostgreSQL/PostGIS/Storage, private signed images, Zod, Vitest, Testing Library, transactional pgTAP, hosting-specific Node.js runtime.

**Audit:** `docs/audits/2026-10-30-sat12-stage-5f-public-launch-readiness.md`

## Approved release scope

Included before launch:

- Correct public navigation where every visible control works.
- Existing published property catalogue and controlled management.
- Published New Projects index/detail/gallery.
- Published Locations index/detail pages with current published inventory.
- Owner/agent project drafting and submission.
- AAL2 admin project moderation/publication/archival and location curation.
- Legal/trust, SEO, security headers, production operations, accessibility, performance, and deployed acceptance work.

Deferred:

- Full Builders feature, builder profiles, and builder directory.
- Saved Properties, Alerts, Insights, and buyer enquiry activation.
- Fabricated or inferred project inventory, prices, MahaRERA registrations, locality rankings, market trends, or locality statistics.

## Global constraints

- Keep both buyer-enquiry activation gates disabled.
- Do not use the development Supabase project as production.
- No remote preview, migration deployment, cloud database test, Storage API test, provider purchase, provisioning, deployment, DNS change, or activation without separate explicit authorization.
- Preserve RLS, private Storage, audited RPCs, role separation, ownership checks, recent AAL2 enforcement, and immutable moderation history.
- Public project/location pages must fail closed when the stable record, exact published pointer, revision status, archive state, or media authorization disagrees.
- Use verified editorial content only. Empty states are preferable to invented facts.

## Decisions required before implementation

1. Project field set: stage vocabulary, optional price-range meaning, possession-date policy, maximum gallery size, and which claims are mandatory for submission.
2. MahaRERA handling: source-of-truth evidence, reviewer responsibility, correction/takedown process, and public disclaimer. Absence must never be displayed as approval or exemption.
3. Location model: curated Nagpur locality list, slug ownership, centre/bounds source, merge/rename behavior, and whether mapping existing property revisions is admin-only.
4. Content ownership: who may submit projects, who verifies builder-name text and image rights, and who owns correction/archival SLAs.
5. Retention/legal holds: whether project/location revisions, images, approvals, and audits join existing retention mechanisms or require dedicated rules.
6. Storage design approval: separate private `project-images` bucket is recommended to avoid weakening the established property path contract.
7. Production hosting/Supabase, legal copy, monitoring, backup tier, accessibility target, and performance budgets remain launch decisions from Stage 5F.

## Proposed database contract

Prepare one forward-only migration after separate implementation approval. Exact names/signatures must be finalized by tests before SQL is written.

### Projects

- `projects`: stable UUID, owner profile, unique slug, exact `published_revision_id`, archive/retention timestamps, and created/updated timestamps.
- `project_revisions`: project/revision identity, replacement pointer, name, `builder_name` text, description, optional curated location reference, address/city/state/postal code, coordinates/PostGIS point, reviewed project stage, optional price range, optional MahaRERA number, lifecycle timestamps/status, and creator.
- `project_images`: revision-scoped ordered metadata with safe dimensions/type/size/alt/source constraints, creator, and maximum count.
- `project_approvals`: immutable AAL2 decisions with reviewer, notes, and revision snapshot.
- `project_audit_log`: immutable publication, archival, and material editorial events.

Optional price and registration fields mean “not supplied” rather than permission to infer a value. Their exact validation and public labels require content/legal approval.

### Locations

- `locations`: stable UUID, unique slug, exact `published_revision_id`, archive state, and created/updated timestamps.
- `location_revisions`: reviewed name, city/state, factual description, map centre and optional validated bounds, SEO title/description, lifecycle timestamps/status, and creator.
- Add nullable `location_id` references to property and project revisions while retaining textual locality snapshots for historical accuracy.
- Owner/agent input may select an already-published location. Only AAL2 administrators may create, edit, publish, or archive the curated taxonomy.
- Counts, inventory, and price ranges on location pages are derived from current exact published/non-archived inventory. Do not persist editorial market statistics in this phase.

### Private project media

Use a separate private `project-images` bucket and `project_images` table rather than broadening the existing property-image path contract. Paths must include authoritative owner/project/revision identity. Signed URLs are produced server-side only after metadata authorization. This requires a separately approved Storage policy deployment and rollback-only Storage API verification.

### RLS and RPC boundary

- Anonymous/authenticated public reads: exact published project/location revision only, stable pointer match, and non-archived parent only.
- Owner/agent: own projects and editable revisions/images only; no location editorial writes; no direct lifecycle or published-pointer update.
- AAL2 admin: project approve/reject/publish/archive and location create/revise/publish/archive through narrowly scoped `SECURITY DEFINER` RPCs with `search_path = ''`, row locks, stale-state checks, restricted EXECUTE, and immutable audits.
- No broad table UPDATE grants, public write grants, or private-schema exposure.
- Project submit requires complete reviewed fields and at least one eligible image. Publication switches the exact pointer atomically and supersedes the previous published revision.

## Phase sequence and authorization boundary

- **Phase A — local launch UX:** Task 1 only; application/tests may be implemented locally after approval, with no schema or cloud operation.
- **Phase B — local Projects and Locations build:** Tasks 2–6; forward-only migration SQL, pgTAP, application code, and documentation are prepared and verified locally, but nothing is deployed and no real content is created.
- **Phase C — separately authorized development-cloud verification:** Task 7; preview, one migration deployment, rollback-only database tests, run-scoped Storage tests, type generation, and any real content operation each remain distinct approvals.
- **Phase D — remaining launch readiness:** Tasks 8–12; local legal/SEO/security/test work precedes separately approved production Supabase, hosting, deployed acceptance, and DNS cutover.

No phase authorizes the next. A successful local build is not permission to connect to Supabase Cloud, and a successful development deployment is not permission to provision or launch production.

---

### Task 1: Fix misleading public navigation and controls

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/search/PropertyFilters.tsx`
- Modify: `src/components/properties/PropertyExplorer.tsx`
- Test: `src/components/search/PropertyFilters.test.tsx`
- Test: `src/app/page.test.tsx`

- [ ] Write failing tests proving `List Property`, Saved, Alerts, Builders, and Insights are absent unless they have working destinations; New Projects and Locations remain unavailable until their routes exist.
- [ ] Replace the no-op Search submit with one understandable live-filter/result-announcement behavior.
- [ ] Preserve favourites as session-only card state without advertising persistence.
- [ ] Run focused tests, accessibility assertions, lint, TypeScript, and build; commit only this navigation change.

### Task 2: Finalize the Projects/Locations specification and migration contract locally

**Files:**
- Create: `docs/superpowers/specs/2026-10-30-sat12-stage-5g-projects-locations-design.md`
- Create: `supabase/migrations/<timestamp>_stage5g_projects_locations.sql`
- Create: `supabase/tests/projects_locations_schema.test.sql`
- Create: `supabase/tests/projects_locations_rls.test.sql`
- Create: `supabase/tests/project_storage_rls.test.sql`
- Create: `src/supabase/projects-locations-migration.test.ts`

- [ ] Resolve exact project fields, price semantics, project-stage enum, gallery limit, location bounds representation, rejected-project editing, retention/legal-hold scope, and production content ownership before SQL.
- [ ] Write failing migration-contract tests for tables, FKs, exact pointers, indexes, checks, RLS, grants, secure functions, immutable audits, and denial of direct lifecycle writes.
- [ ] Write pgTAP fixtures for anonymous/authenticated/owner/cross-owner/AAL1-admin/AAL2-admin, stale states, archive, exact pointers, revisions, ownership transfer, and audits.
- [ ] Implement the smallest forward-only migration locally; do not connect to Supabase Cloud.
- [ ] Run contract tests and assertion discovery. Report pgTAP as unexecuted until separately authorized.

### Task 3: Build New Projects management and moderation locally

**Files:**
- Create: `src/features/projects/schemas.ts`
- Create: `src/features/projects/management.ts`
- Create: `src/features/projects/management-supabase.ts`
- Create: `src/features/project-images/storage.ts`
- Create: `src/app/actions/projects.ts`
- Create: `src/app/dashboard/projects/page.tsx`
- Create: `src/app/dashboard/projects/new/page.tsx`
- Create: `src/app/dashboard/projects/[id]/page.tsx`
- Create: `src/app/admin/projects/page.tsx`
- Create: `src/app/admin/projects/[revisionId]/page.tsx`
- Modify: management navigation components
- Test: colocated tests for each module, route, and action

- [ ] TDD owner/agent authorization, exact target IDs, validation, optimistic concurrency, duplicate-submit prevention, editable-state rules, image limits/compensation, and sanitized errors.
- [ ] Add reviewed project fields only. `builder_name` is plain text; create no builder route, relationship, profile, logo, or claim.
- [ ] TDD AAL2 admin approve/reject/publish/archive actions using only audited RPCs; admins receive no owner editing capability.
- [ ] Add clear queue, history, loading, empty, success, and failure states without remote mutations.

### Task 4: Build published New Projects pages and secure galleries locally

**Files:**
- Create: `src/features/projects/public-repository.ts`
- Create: `src/features/projects/mapper.ts`
- Create: `src/app/projects/page.tsx`
- Create: `src/app/projects/[projectId]/page.tsx`
- Create: `src/components/projects/ProjectGallery.tsx`
- Modify: `src/components/layout/Header.tsx`
- Test: repository, mapper, route, gallery, navigation, and metadata tests

- [ ] TDD exact published/non-archived visibility and denial of every nonpublic/unknown state.
- [ ] Sign only ordered images attached to the exact published revision; fail safely on missing or expired URLs.
- [ ] Render verified name, builder-name string, location, description, reviewed facts, map when coordinates are valid, and honest missing-data states.
- [ ] Add canonical/metadata/structured data using facts only; never infer price, availability, MahaRERA status, possession, or builder credentials.
- [ ] Enable New Projects navigation only after route and empty/error behavior pass.

### Task 5: Build curated Locations management and public pages locally

**Files:**
- Create: `src/features/locations/schemas.ts`
- Create: `src/features/locations/repository.ts`
- Create: `src/app/actions/locations.ts`
- Create: `src/app/admin/locations/page.tsx`
- Create: `src/app/admin/locations/[revisionId]/page.tsx`
- Create: `src/app/locations/page.tsx`
- Create: `src/app/locations/[slug]/page.tsx`
- Modify: property/project forms to select published locations while retaining text snapshots
- Modify: `src/components/layout/Header.tsx`
- Test: schema, repository, action, route, navigation, and metadata tests

- [ ] TDD AAL2-only editorial workflow, exact pointer publication, archive behavior, immutable history, safe slugs, coordinates/bounds, and denial to non-admins.
- [ ] TDD public pages exposing only published/non-archived locations and inventory whose exact current revision is published.
- [ ] Derive counts and displayed ranges from current authorized data; show “no published inventory” instead of invented statistics.
- [ ] Preserve property/project textual locality snapshots when mapping to a curated location.
- [ ] Enable Locations navigation only after routes, empty/error states, map behavior, metadata, and access tests pass.

### Task 6: Complete local security and compatibility verification

**Files:**
- Modify after deployment only: `src/types/database.generated.ts`
- Create/modify: project/location contract and application security tests

- [ ] Run focused project/location suites, all existing property/moderation/Storage tests, full application tests, ESLint, TypeScript, production build, dependency audit, diff/whitespace, and secret scan.
- [ ] Prove existing property RLS/Storage behavior is unchanged and the proposed project bucket remains private by contract.
- [ ] Confirm both enquiry gates remain disabled and no new public personal-data collection exists.
- [ ] Do not hand-edit generated types before authorized deployment; follow the repository’s approved type-generation workflow afterward.

### Task 7: Obtain separate cloud approvals for schema and Storage rollout

**Files:**
- Create: `docs/operations/stage5g-projects-locations-deployment.md`
- Modify only after authorized generation: `src/types/database.generated.ts`

- [ ] Read-only preview: verify target, checksum, migration history, exact pending file, dry-run SQL, grants, RLS, functions, and bucket changes.
- [ ] Migration deployment: apply exactly one reviewed migration once, clear process approval, and verify catalog state read-only.
- [ ] Transactional pgTAP: execute exact suites once with guaranteed rollback and independent residue inspection.
- [ ] Storage API tests: use run-scoped fixtures only, verify private project galleries, and prove zero residue.
- [ ] Read-only type generation: regenerate types, inspect the diff, run the full local gate, and commit separately.
- [ ] Real project/location content creation, moderation, and publication require separate authorization and verified source material.

### Task 8: Add legal, contact, and public trust surfaces

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Create: `src/app/contact/page.tsx`
- Create: `src/components/layout/PublicFooter.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/app/legal-pages.test.tsx`
- Create: `docs/operations/privacy-content-approval.md`

- [ ] Obtain approved organization/contact/grievance, privacy, retention/deletion, content rights, RERA, project marketing, builder-name attribution, map, processor, and cross-border copy. Do not invent legal promises.
- [ ] TDD accessible routes/footer and ensure no enquiry-retention proposal is represented as implemented.
- [ ] Implement static pages with no unapproved form, analytics, or third-party script.

### Task 9: Complete SEO and indexing for all catalogues

**Files:**
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Create: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx`
- Modify: property, project, and location metadata modules
- Create: `src/app/seo.test.ts`

- [ ] TDD absolute canonical URLs and published-only sitemap entries for properties, projects, and locations.
- [ ] Exclude auth/admin/dashboard, drafts, archived records, owner identities, private paths, and signed image URLs.
- [ ] Add truthful structured data only where supportable from published fields; do not represent missing offers, ratings, statistics, or registrations.
- [ ] Add organization/site identity and reviewed social assets after content approval.

### Task 10: Add hosting-aware security and operational boundaries

**Files:**
- Modify: `next.config.ts`
- Create: `src/security/headers.test.ts`
- Create: `docs/operations/production-security-runbook.md`
- Create: `docs/operations/secrets-rotation.md`
- Create: `docs/operations/backup-restore.md`
- Create: `docs/operations/incident-response.md`

- [ ] Finalize the conditionally approved Vercel topology or a separately approved alternative with Node.js >=20.9, Next.js 16.4.1, stable multi-instance Server Action encryption, trusted proxy, secrets, logs, rollback, and cost evidence.
- [ ] TDD CSP, frame, MIME, referrer, permissions, and hosting-owned HSTS policy without breaking signed images or maps.
- [ ] Document secret rotation, access ownership, audit review, backups/restore, rollback, incidents, privacy-safe logs, content takedown, and gates-disabled recovery.

### Task 11: Rehearse a separate production Supabase environment

**Files:**
- Create: `docs/operations/production-supabase-rehearsal.md`

- [ ] Approve a separate production project, India/cross-border boundary, region, budget, backup tier, and operators; never reuse development identities/data.
- [ ] Under separate approvals, preview/apply migrations in order, run rollback-only database/Storage verification, inspect grants/RLS/buckets, and prove zero fixtures.
- [ ] Bootstrap controlled roles, AAL2, recovery, and editorial workflows without demo public content.
- [ ] Rehearse backup/restore, project/location archival, content correction, audit review, and private-media incident response.

### Task 12: Add deployed acceptance and perform controlled launch

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/public-catalogue.spec.ts`
- Create: `tests/e2e/auth-management.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `docs/operations/launch-acceptance-checklist.md`
- Create: `docs/operations/launch-record.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] With separately approved tooling/deployment, test property/project/location journeys, galleries, maps, empty/error/expired-image states, metadata, mobile, and keyboard behavior.
- [ ] Test controlled auth, MFA freshness, owner property/project workflows, AAL2 moderation, session expiry, Storage, and rollback without customer data.
- [ ] Run automated accessibility plus manual keyboard/screen-reader/zoom/contrast/reduced-motion/touch checks; set performance and inventory/load budgets.
- [ ] Review all real content and image rights; prove no development demo fallback can appear in production.
- [ ] Perform separately authorized DNS cutover only after go/no-go, monitoring, support, backup, rollback, and cost checks pass. Keep enquiries disabled.

## Smallest safe launch acceptance criteria

Launch is permitted only when:

1. Every primary navigation destination works; deferred features are absent.
2. Public properties, projects, locations, and media are exact-published-only and non-archived.
3. Published project/location content is verified; an empty catalogue is never represented as populated.
4. Owner project management and AAL2 project/location moderation pass local, rollback-only database, Storage, and hosted checks.
5. No fabricated project, builder, price, registration, or locality statistic is present.
6. Legal, SEO, security, production Supabase, monitoring, backup/restore, accessibility, performance, and content-review blockers from Stage 5F are closed.
7. Both buyer-enquiry gates remain disabled.

## Explicitly deferred work

- Buyer enquiry activation and Stage 5E hosted provider validation.
- Full Builders feature, builder profiles/directory, Saved Properties, Alerts, and Insights.
- Advanced search, analytics, experimentation, and editorial market statistics.
- The development-only `undici` remediation remains a separate isolated dependency-security task using the smallest compatible jsdom/Vitest update.
