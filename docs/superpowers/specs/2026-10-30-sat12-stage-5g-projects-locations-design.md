# SAT12 Stage 5G Projects and Locations Design

**Status:** Proposed for approval; documentation only

**Date:** 2026-10-31

**Baseline:** `codex/sat12-stage-3` at `cf43d7b04d42b99e268ff690bf30a57dfef5cae2`

**Related documents:**

- `docs/audits/2026-10-30-sat12-stage-5f-public-launch-readiness.md`
- `docs/superpowers/plans/2026-10-30-sat12-stage-5g-safe-mvp-launch.md`
- `docs/superpowers/specs/2026-10-12-sat12-stage-3-supabase-property-management-design.md`

## Purpose

Add New Projects and Locations to SAT12's first public release without weakening the existing property, Auth, RLS, Storage, moderation, or AAL2 boundaries. The design treats projects as owner-managed, revisioned content and locations as administrator-curated editorial content.

The public catalogue must contain only verified, deliberately published data. SAT12 must not invent project names, builder identities, prices, possession dates, MahaRERA registrations, images, locality boundaries, rankings, or market statistics.

## Goals

- Public `/projects` and `/projects/[projectId]` pages for exact published, non-archived projects.
- Public `/locations` and `/locations/[slug]` pages for exact published, non-archived Nagpur locations.
- Owner/agent project drafting, image management, submission, rejection correction, and versioned updates.
- Recent-AAL2 administrator review, approval, rejection, publication, archival, and location curation.
- Private ordered project galleries delivered with short-lived signed URLs.
- Stable public identities, exact published-revision pointers, row locking, stale-state rejection, and immutable audit history.
- Honest location inventory derived from currently published properties/projects.
- Forward-only migration and rollback-only pgTAP/Storage verification before deployment.

## Non-goals

- Builder profiles, builder accounts, logos, claims, directory pages, or a `builders` table.
- Saved Properties, Alerts, Insights, analytics, or buyer enquiry activation.
- Project unit inventory, floor plans as structured inventory, booking, payments, lead routing, or availability guarantees.
- Automated MahaRERA scraping or legal verification.
- Automated geocoding, locality-boundary inference, market-price statistics, rankings, growth claims, or infrastructure scoring.
- Direct administrator editing of owner-authored project content.
- Ownership transfer in the first release.
- Retention deletion automation before legal approval.

## Existing contracts to preserve

1. Stable `properties` point to an exact `property_revisions` row through a same-parent composite foreign key.
2. Owners can edit only owned `draft` or `rejected` revisions; submitted and public history is immutable.
3. Lifecycle changes are RPCs with row locks and stable errors, not direct status updates.
4. AAL2 administrator status is authoritative profile role `admin` plus JWT `aal = aal2`.
5. Approval snapshots and audit logs are append-only.
6. Anonymous public reads require a non-archived parent, exact pointer match, and revision status `published`.
7. Private image paths bind owner, stable parent, revision, and image UUID; metadata and object policies both verify them.
8. Signed URLs are short-lived output capabilities and are never stored in database rows.
9. Anonymous metadata policies must not call helpers that require private-schema access; the published predicate remains self-contained.
10. The service-role credential is not part of routine application behavior.

## Decision register

### Already approved

- New Projects and Locations are required before public launch.
- Builder is a project revision's plain-text name only; no builder feature or profiles.
- Both enquiry gates remain disabled.
- No fabricated project, pricing, registration, or locality information.
- Cloud previews, migration deployment, database tests, Storage tests, content writes, and production operations require separate approvals.

### Recommended defaults awaiting approval

| ID | Recommendation | Reason |
|---|---|---|
| D1 | Reuse existing `construction_status` values: `under_construction` and `ready_to_move` | Avoids an ambiguous marketing-stage enum and matches current SAT12 vocabulary. “New Project” describes the catalogue, not a legal/construction claim. |
| D2 | Optional `price_min_inr` and `price_max_inr`; max requires min and must be >= min | Supports “starting at” and reviewed ranges without fabricating a unit price. |
| D3 | Optional `possession_month` stored as the first day of a month and displayed only as month/year | Avoids false day-level precision. Omit when unverified; require null for `ready_to_move`. |
| D4 | One to twenty project images, 5 MiB each, JPEG/PNG/WebP; position zero is cover | Provides a useful gallery while retaining current file controls and bounded cost. |
| D5 | Separate private `project-images` bucket | Avoids weakening or overloading the proven `property-images` path/policy contract. |
| D6 | Location centre is required; a PostGIS multipolygon boundary is optional and admin-authored | Allows safe map pages when a defensible boundary is unavailable. |
| D7 | Existing published properties are not automatically mapped from locality text | Protects revision immutability and prevents inaccurate string-based mapping. |
| D8 | Archived projects/locations are retained; deletion/anonymization remains disabled pending legal review | Matches the fail-closed retention posture and preserves audits/public URL history. |
| D9 | Owner content-rights attestation is required on project submission and its text version is recorded | Establishes accountability without pretending SAT12 independently owns submitted media. |
| D10 | No ownership-transfer RPC in the MVP | Prevents historic draft/gallery access ambiguity; transfer needs a separate audited design. |
| D11 | A property may link to a project only when both stable records have the same `owner_id` | Prevents an owner from claiming an unauthorised project affiliation; cross-owner/broker associations require a later audited authorization model. |

### Decisions the product owner must approve before migration SQL

1. Accept or change D1–D11.
2. Confirm whether a project may publish without a MahaRERA number when the owner claims exemption or non-applicability; legal review is required.
3. Approve public wording for indicative prices, expected possession, builder-name attribution, MahaRERA claims, and content accuracy.
4. Name the operator responsible for verifying project evidence, image rights, locality sources, corrections, and takedowns.
5. Approve the location-boundary source/provenance policy and whether boundary display is needed for launch.
6. Approve provisional project/location retention periods or confirm indefinite retention until a later privacy review.
7. Decide whether one project image is enough for submission or a minimum of three is required. This specification recommends one to avoid forcing filler imagery.

## Data model

All new public tables enable RLS immediately. Every relationship and function uses schema-qualified names. Circular stable-pointer foreign keys are added only after revision tables exist.

### Enums

Reuse:

- `public.revision_status`: `draft`, `submitted`, `approved`, `rejected`, `published`, `superseded` for project revisions.
- `public.construction_status`: `under_construction`, `ready_to_move` for the recommended project construction stage.
- `public.approval_decision`: `approved`, `rejected`.

Add:

- `public.location_revision_status`: `draft`, `published`, `superseded`.
- `public.project_audit_event`: `created`, `submitted`, `approved`, `rejected`, `published`, `archived`.
- `public.location_audit_event`: `created`, `published`, `archived`.
- `public.rera_review_decision`: `verified`, `not_applicable`, `correction_required`.

Do not add a builder type or project marketing-stage enum in the first release.

### `projects` — stable project identity

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK, generated |
| `owner_id` | `uuid` | Required FK to `profiles`; authoritative owner/agent |
| `slug` | `text` | Unique, immutable, lowercase safe-slug constraint |
| `published_revision_id` | `uuid` | Nullable exact revision pointer; same-project composite FK |
| `archived_at` | `timestamptz` | Null while active |
| `retention_notice_sent_at`, `retention_not_before` | `timestamptz` | Nullable guardrails; no automated job yet |
| `created_at`, `updated_at` | `timestamptz` | Database timestamps and update trigger |

Slug default: server generates `{normalized-name}-{8-char-random-suffix}`. Renaming content does not change the stable slug. No custom owner-selected slug in the MVP.

### `project_revisions` — owner content under moderation

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `project_id` | `uuid` | Required FK to `projects` |
| `revision_number` | `integer` | Positive, unique per project |
| `replaces_revision_id` | `uuid` | Nullable same-project self-FK |
| `name` | `text` | Trimmed 3–140 characters |
| `builder_name` | `text` | Trimmed 2–160 characters; display attribution only |
| `description` | `text` | Up to 8,000 characters; minimum 20 on submission |
| `construction_status` | `public.construction_status` | Recommended D1 |
| `price_min_inr`, `price_max_inr` | `bigint` | Nullable positive amounts; max depends on min and cannot be lower |
| `possession_month` | `date` | Nullable; first of month; null for ready-to-move |
| `maharera_number` | `text` | Nullable trimmed claimed identifier; public only after review/publication |
| `location_id` | `uuid` | Nullable FK in draft; required on submission and must identify a published, non-archived location |
| `locality_text` | `text` | Required 2–120 character historical display snapshot copied from the selected location when submitted |
| `address_line` | `text` | Optional, max 240; no private contact/address data |
| `city`, `state` | `text` | Required; MVP submission requires Nagpur/Maharashtra |
| `postal_code` | `text` | Optional draft; Nagpur PIN validation when supplied; required by submit decision if approved |
| `latitude`, `longitude` | `double precision` | Nullable in draft; required and Nagpur-bounded on submit |
| `location_point` | `extensions.geography(Point,4326)` | Generated from coordinates when present; GiST indexed |
| `rights_attested_at` | `timestamptz` | Set by submit RPC after explicit owner attestation |
| `rights_attestation_version` | `text` | Exact approved copy version used at submission |
| `status` | `public.revision_status` | Default `draft` |
| `rejection_reason` | `text` | Nullable, 3–2,000 characters when present |
| lifecycle timestamps | `timestamptz` | Submitted, approved, published |
| retention timestamps | `timestamptz` | Nullable guardrails |
| `created_by` | `uuid` | Required profile FK |
| `created_at`, `updated_at` | `timestamptz` | Database timestamps |

Constraints:

- Unique `(project_id, revision_number)` and `(id, project_id)`.
- Same-project replacement FK.
- At most one working revision in `draft`, `submitted`, `approved`, or `rejected` per project.
- Price maximum cannot exist without minimum; when both exist, maximum >= minimum.
- `possession_month` day must be 1 and is incompatible with `ready_to_move`.
- Draft rows may be incomplete; `submit_project` performs complete cross-table validation under locks.

### `project_images`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | Generated client/server before object upload |
| `revision_id` | `uuid` | Required FK to project revision |
| `storage_path` | `text` | Unique; never a URL |
| `alt_text` | `text` | Required, 3–240 characters |
| `position` | `smallint` | Recommended 0–19, unique per revision |
| `width`, `height`, `size_bytes` | `integer` | Positive; size <= 5 MiB |
| `mime_type` | `text` | JPEG, PNG, or WebP only |
| `source_kind` | `text` | `owner_uploaded` only for launch; no illustrative production media |
| `created_by` | `uuid` | Required profile FK |
| `created_at` | `timestamptz` | Database timestamp |

At least one image and a position-zero cover are required on submit. Images remain revision-scoped; cloning a published project creates new immutable paths rather than mutating the live gallery.

### `project_rera_evidence`

Private compliance evidence, never anonymously selectable.

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `revision_id`, `project_id` | `uuid` | Composite FK to exact revision/project |
| `claimed_number` | `text` | Must equal revision claim when present |
| `official_source_url` | `text` | HTTPS URL, length-limited; not displayed publicly by default |
| `submitted_by` | `uuid` | Owner profile |
| `decision` | `rera_review_decision` | Nullable until AAL2 review |
| `reviewer_id`, `reviewed_at` | profile/timestamp | Both null or both present |
| `review_reason` | `text` | Required for `not_applicable` and `correction_required` |
| `created_at`, `updated_at` | `timestamptz` | Database timestamps |

Recommended first release accepts an official-source URL, not uploaded evidence documents. This avoids a second sensitive-document bucket, malware handling, and document-retention questions. `verified` means an administrator checked that the submitted number matched the cited official source at review time; it is not legal certification by SAT12.

### `project_approvals`

Append-only exact moderation decisions:

- `project_id`, `revision_id`, `reviewer_id`, `decision`, notes, `project_snapshot jsonb`, `rera_evidence_snapshot jsonb`, and `created_at`.
- Rejection requires notes.
- Direct inserts/updates/deletes are denied.
- Snapshot excludes signed URLs and private operator data not needed for the audit.

### `project_audit_log`

Append-only lifecycle events written only by project RPCs:

- `project_id`, optional `revision_id`, actor profile, event, reason/notes, `snapshot jsonb`, and timestamp.
- Creation, submission, moderation decision, publication, and archival each append one event in the same transaction as the state change.
- Public users and owners cannot read the global log. Owners may read audit entries for their own projects; AAL2 admins may read all.

### `locations` — stable curated identity

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `slug` | `text` | Unique lowercase slug, immutable after publication |
| `published_revision_id` | `uuid` | Nullable exact same-location pointer |
| `archived_at` | `timestamptz` | Removes the location route/index entry |
| `created_at`, `updated_at` | `timestamptz` | Database timestamps |

Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, are chosen by the administrator from the reviewed locality name, and never accept `/`, percent encoding, Unicode confusables, or path traversal. Renaming uses a new revision while retaining the stable slug. Redirect aliases are deferred.

### `location_revisions`

| Column | Type | Rule |
|---|---|---|
| `id`, `location_id` | `uuid` | Exact revision and stable parent |
| `revision_number` | `integer` | Positive, unique per location |
| `replaces_revision_id` | `uuid` | Nullable same-location published predecessor |
| `name` | `text` | Reviewed 2–120 characters |
| `description` | `text` | Factual, 20–4,000 characters |
| `city`, `state` | `text` | Nagpur, Maharashtra for MVP |
| `centre_latitude`, `centre_longitude` | `double precision` | Required and Nagpur-bounded |
| `centre_point` | `extensions.geography(Point,4326)` | Generated and indexed |
| `boundary` | `extensions.geometry(MultiPolygon,4326)` | Nullable, valid, non-empty, bounded to approved Nagpur extent |
| `boundary_source` | `text` | Required when boundary exists; reviewed attribution/provenance |
| `seo_title`, `seo_description` | `text` | Length-limited, factual editorial copy |
| `status` | `location_revision_status` | `draft`, `published`, `superseded` |
| `created_by` | `uuid` | AAL2 admin profile |
| `published_at`, `created_at`, `updated_at` | timestamps | Database-owned |

Only AAL2 administrator RPCs create or revise locations. One working draft per stable location is allowed. Publication locks both rows, supersedes the old revision, and swaps the stable pointer atomically.

### `location_audit_log`

Append-only admin events with stable/revision IDs, actor, event, mandatory reason, snapshot, and timestamp. It records create, publish, and archive. Direct writes are denied.

### Property/location relationship

Add `property_revisions.location_id uuid null references public.locations(id) on delete restrict`.

- Keep existing `locality` text unchanged. It is the historical display snapshot and remains required.
- New/editable revisions may select only a current published, non-archived location.
- `submit_listing` must require `location_id` after the rollout date and verify it under the revision lock. A backward-compatible deployment may initially permit null for existing working drafts; the activation point requires a reviewed migration/application sequence.
- Existing published revisions remain unchanged and continue to display their text locality. They do not appear on a curated location page until an owner creates a new revision, selects the location, and completes normal AAL2 publication.
- No string-match backfill, fuzzy matching, bulk update, or administrator mutation of an existing published revision is allowed.

### Property/project relationship

Add an optional all-or-none pair to `property_revisions`:

- `project_id uuid null references public.projects(id) on delete restrict`.
- `project_revision_id uuid null`, with composite FK `(project_revision_id, project_id)` to `project_revisions(id, project_id)`.

Standalone properties keep both fields null. When set, `submit_listing` verifies that the stable project is non-archived, its exact `published_revision_id` equals `project_revision_id`, the revision status is `published`, and—under recommended D11—the project/property owners match. The AAL2 property reviewer sees and approves the affiliation claim.

The captured revision records what was reviewed. A public property page may link to the stable project's current public route while the project remains published and non-archived; it must not expose the captured superseded revision. Archiving a project removes that link but does not archive the property. Existing property revisions remain null and receive no inferred/backfilled project association.

### Project/location relationship

`project_revisions.location_id` follows the same snapshot rule. The selected stable location may receive newer published editorial revisions without altering the project revision; the project retains `locality_text` for historical display. Public project pages may link to the current public location route only while that location remains published and non-archived.

### Location page inventory

A location page queries:

- Properties whose exact `published_revision_id` points to a `published`, non-archived revision with that `location_id`.
- Projects whose exact `published_revision_id` points to a `published`, non-archived revision with that `location_id`.

Counts and optional price ranges are calculated from those authorized rows at request time. Null project prices are excluded from price calculations. The page must say “No published inventory” when empty and must not infer averages, trends, rankings, amenities, commute times, or appreciation.

## Lifecycle and RPC design

### Owner project RPCs

- `create_draft_project(p_project jsonb) -> project_revisions`: authenticated authoritative `owner_agent`; derives owner/creator from `auth.uid()`; creates stable project and revision 1 atomically.
- `create_project_revision(p_project_id uuid) -> project_revisions`: owner only; locks stable project/current published revision; clones reviewed content and gallery metadata into a new draft with new object paths completed through the application compensation workflow.
- `submit_project(p_revision_id uuid, p_attestation_version text) -> project_revisions`: owner only; locks stable/revision; accepts only draft/rejected; validates required content, published location, coordinates, image count/cover, price/possession consistency, rights attestation, and RERA evidence rules; appends audit; moves to submitted.

Owners directly update only allowlisted content columns on owned draft/rejected revisions. Stable owner, slug, status, moderation/lifecycle timestamps, published pointer, audit fields, evidence decisions, and admin notes are never owner-writable.

### AAL2 project RPCs

- `approve_project(p_revision_id uuid, p_notes text default null)`: requires `private.is_aal2_admin()`, submitted state, complete evidence review, row locks, immutable approval/audit inserts, and approved state.
- `reject_project(p_revision_id uuid, p_notes text)`: requires AAL2, submitted state, mandatory reason, immutable approval/audit inserts, and rejected state.
- `publish_project(p_revision_id uuid)`: requires AAL2 and approved state; locks project plus target/prior revision; rejects archived parent; supersedes prior public revision and swaps exact pointer atomically; appends audit.
- `archive_project(p_project_id uuid, p_reason text)`: requires AAL2 and reason; locks active project, sets archive timestamp, appends audit; never deletes history/media.
- `review_project_rera_evidence(p_revision_id uuid, p_decision rera_review_decision, p_reason text)`: requires AAL2; locks revision/evidence; accepts submitted state; records reviewer/time/decision. Approval is impossible while evidence is `correction_required` or otherwise inconsistent with the legal rule approved for launch.

Repeated, concurrent, stale, cross-project, missing, or wrong-state operations fail with stable SQLSTATE/error codes and no partial event.

### AAL2 location RPCs

- `create_location_draft(p_location jsonb, p_reason text) -> location_revisions`.
- `create_location_revision(p_location_id uuid, p_reason text) -> location_revisions` clones the exact published revision.
- `publish_location(p_revision_id uuid, p_reason text) -> location_revisions` validates slug/content/geometry, locks rows, supersedes old revision, swaps pointer, and appends audit.
- `archive_location(p_location_id uuid, p_reason text) -> locations` archives without modifying referenced property/project history.

Every location RPC requires AAL2 internally even if an application page is already protected.

## RLS and grants

### Projects and revisions

- `anon`, `authenticated`: select only stable, non-archived projects with an exact published pointer and that exact `published` revision.
- Owner: additionally select own stable projects and all their revisions.
- AAL2 admin: select all through authenticated-only policy.
- Stable project INSERT/UPDATE/DELETE: no direct client grants.
- Revision INSERT/status/pointer/lifecycle fields: no direct grants; lifecycle RPC only.
- Owner revision UPDATE: allowlisted content columns only and only owned draft/rejected rows.
- No owner `DELETE` recommendation for project revisions after evidence/media exists; correction and retention workflows are safer than ad hoc deletion.

Use separate public, owner, and AAL2 SELECT policies for project images so anonymous policy evaluation never depends on private-schema access.

### Locations

- Public selects only non-archived stable locations and exact published revisions.
- Authenticated owners receive no additional location editorial access beyond public selection needed for forms.
- AAL2 admins select all stable/revision/audit rows.
- All writes occur through AAL2 RPCs; no direct authenticated INSERT/UPDATE/DELETE grants.

### Evidence and audit

- Project owner selects/updates own evidence only while its revision is draft/rejected.
- AAL2 admin reads/reviews all evidence.
- No anonymous grant on evidence, approval logs, or audit logs.
- Audit/approval inserts are RPC-only; updates/deletes are denied to application roles.

### Function security

- `SECURITY DEFINER` only when crossing RLS is necessary.
- `search_path = ''`; every relation/function is schema-qualified.
- Revoke EXECUTE from `public`, `anon`, and unintended roles before granting exact authenticated access.
- Every public RPC rechecks role, ownership, status, parent/revision relationship, archive state, and AAL as applicable.
- Helpers in `private` remain unexposed except narrowly required boolean RLS helpers. Anonymous public predicates should be directly expressible without private-schema dependency.

## Project Storage and signed galleries

### Bucket

- New bucket ID/name: `project-images`.
- `public = false`.
- File limit: 5 MiB.
- Allowed MIME: JPEG, PNG, WebP.
- No public bucket conversion, service-role signing in routine pages, or permanent URL columns.

### Object path

`{owner_uuid}/{project_uuid}/{revision_uuid}/{image_uuid}.{ext}`

The parser requires exactly four path segments, canonical UUIDs, an allowed extension, and no traversal. A metadata trigger verifies path IDs, MIME/extension, Storage object MIME/size, and matching metadata UUID before insert/update.

### Object policies

- Upload: authenticated authoritative owner_agent, UID/path owner match, owned draft/rejected project revision, no applicable legal hold.
- Read: exact public project/revision/image path, or owning owner_agent, or AAL2 admin.
- Delete: owning owner_agent, editable revision, no legal hold, metadata-first compensation contract.
- Orphan select/delete: authenticated owner only for exact eligible orphan path, matching the property follow-up policy.

### Application workflow

- Validate filename, extension, MIME, magic bytes, size, count, dimensions, alt text, and position before metadata insert.
- Never upsert an existing path.
- If metadata insert fails, remove the just-uploaded object; if cleanup is uncertain, report uncertainty and leave a retention candidate rather than deleting broadly.
- Signed URLs: recommended 10-minute lifetime and no more than 5-minute server cache, matching property behavior.
- Public gallery selects metadata only for the exact published revision, orders by position, and signs only those paths. Individual signing failure omits that image safely; no fallback exposes another revision.

## MahaRERA evidence and correction

1. Owner supplies the claimed number and official-source URL; SAT12 does not generate either.
2. Submission snapshots the claim and locks owner editing.
3. AAL2 reviewer checks the official source and records `verified`, `not_applicable`, or `correction_required` with reason.
4. Approval/publish requires the launch-approved compliance rule. Recommended default: a nonempty number must be `verified`; missing numbers require an explicit `not_applicable` decision and reason, subject to legal approval.
5. Public copy distinguishes “MahaRERA number reviewed on [date]” from legal endorsement. Do not use the existing ambiguous `rera_approved` wording for projects.
6. Rejected/correction-required revisions return to owner editing; history remains immutable.
7. A correction to a published claim uses a new revision and normal review. If the claim may mislead users, an AAL2 admin archives the stable project immediately with a reason until correction is published.
8. The evidence URL and review notes are not public fields. Approval snapshots preserve only what retention/legal policy authorizes.

## Location curation and boundaries

- Administrators create only Nagpur/Maharashtra locations from an approved source list.
- The centre point must fall within the same conservative Nagpur coordinate bounds used by application validation.
- Optional boundaries must be valid, nonempty multipolygons in SRID 4326 and remain within an approved Nagpur envelope; invalid/self-intersecting geometry is rejected.
- Boundary provenance and review date are recorded. If provenance or licensing is unclear, publish the centre point without a polygon.
- A location archive removes its route/index entry but does not archive properties/projects or rewrite their snapshot text.
- Public maps retain OpenStreetMap attribution and privacy disclosures. A boundary must not imply administrative/legal precision unless its source supports that claim.

## Content ownership, archival, and retention

- `projects.owner_id` is the submitting owner_agent and controls draft access. Admin review does not transfer authorship or grant admins owner editing capabilities.
- Submission records an explicit image/content-rights attestation version. SAT12 moderation verifies completeness and apparent consistency, not legal title.
- Project archival is non-destructive and immediately removes the stable project and exact gallery from anonymous access.
- Location archival is non-destructive and removes only the curated public location surface.
- Extend `legal_holds.entity_kind` only through a reviewed constraint change for `project`, `project_revision`, `project_image`, `project_approval`, `location`, and `location_revision`.
- Retention candidates must treat a held project/location as protecting dependent rows and Storage objects.
- Recommended provisional alignment: rejected project revisions 90 days after notice; archived projects two years; unused project images 30 days; approval/audit history at least three years. These are engineering proposals, not approved production deletion rules.
- No purge schedule, destructive retention RPC, or automatic object deletion is activated by the Stage 5G migration. Legal approval, notice copy, dry-run review, batch limits, idempotency, referential-history protection, and rollback/incident procedures remain prerequisites.

## Indexes and concurrency

- Project owner index; unique slug; revision `(project_id, status, updated_at desc)`; unique partial working revision; project-image `(revision_id, position)`; approval/audit history indexes.
- Project point GiST index for future measured queries; do not add speculative full-text or boundary-overlap indexes without query evidence.
- Location unique slug; revision history/status; optional boundary GiST index only if the public query uses it.
- Property/project `location_id` indexes support location inventory joins.
- All lifecycle RPCs lock stable parent then target revision in the same consistent order. Publication additionally locks the prior published revision. Submission locks the selected location row/revision and verifies its exact pointer.

## Forward-only migration outline

One migration is preferred so tables, grants, functions, and policies arrive atomically; split only if Supabase dry-run or dependency review proves necessary.

1. Create enums.
2. Create projects/revisions, then add composite stable pointer and replacement FKs.
3. Create project images, RERA evidence, approvals, and audit tables.
4. Create locations/revisions, then add composite stable pointer and replacement FKs.
5. Add nullable location and optional project-association columns to property revisions; add indexes without rewriting existing values.
6. Extend legal-hold constraint only after preserving existing allowed values.
7. Add indexes and update triggers.
8. Enable RLS and revoke all new-table privileges before adding policies/grants.
9. Add private authorization/path helpers with safe search paths and exact EXECUTE grants.
10. Add lifecycle/moderation/location RPCs and immutable-audit protections.
11. Insert the private bucket and add Storage object policies/triggers.
12. Add explicit public/owner/AAL2 metadata policies; verify anonymous predicates contain no private helper.
13. Leave all existing data unchanged; no location backfill, demo project seed, or real content migration.

Migration deployment remains a separate operation after local review, checksum, official dry-run, migration-history confirmation, and fresh aggregate preflight.

## Test plan

### Local migration contract tests

Statically verify:

- Forward-only filename/order and absence of seed/content rows.
- Every table, enum, constraint, FK, index, trigger, and RLS enablement.
- Exact pointer and same-parent composite FKs.
- Safe `SECURITY DEFINER` search paths, schema qualification, revocations, and narrow grants.
- No direct status/pointer/audit/evidence-decision writes.
- Anonymous image/location/project predicates contain exact published/archive checks and no private helper dependency.
- Private bucket, allowed MIME, file limit, path parser, metadata trigger, and no public bucket change.
- Existing property policies/functions remain present and are not weakened.

### Transactional pgTAP suites

`projects_locations_schema.test.sql`:

- Schema, enums, constraints, indexes, RLS, grants, function ownership/security, and immutable audit protections.

`projects_locations_rls.test.sql`:

- Anonymous exact published project/location visibility.
- Denial for draft/submitted/approved/rejected/superseded, archived, pointer-mismatched, unknown, and cross-owner rows.
- Owner_agent draft/update/submit/resubmit; ordinary user and downgraded owner denial.
- Owner cannot edit submitted/published history, lifecycle fields, ownership, slug, evidence decision, audits, or curated locations.
- AAL1 admin denial and AAL2 success for every moderation/location RPC.
- Approval/rejection snapshots, publication pointer swap, prior supersession, archival, stable error codes, repeat/concurrency failure, and immutable audits.
- Location selection requires an exact current published/non-archived location.
- Existing null location mappings remain private from location inventory and are never string-matched.
- Optional property/project links require an exact published project revision, recommended same-owner association, and no automatic backfill.
- RERA evidence privacy/review/correction paths.
- Legal holds prevent relevant image/retention eligibility.

`project_storage_rls.test.sql`:

- Valid owned editable path upload and metadata insert.
- Cross-owner, wrong project/revision/image ID, invalid extension/MIME/size, submitted/published/archived, and held-entity denial.
- Anonymous metadata/object visibility for exact published gallery only.
- Owner and AAL2 visibility; ordinary authenticated/cross-owner denial.
- Metadata-first delete, orphan cleanup authorization, and no property-bucket regression.

All database suites run in one TLS PostgreSQL session with explicit `BEGIN`, guaranteed `ROLLBACK`, no automatic retry, deterministic collision-resistant fixtures, and an independent read-only residue check. Cloud execution requires separate exact-file authorization.

### Storage API integration tests

Use separately authorized run-scoped users, rows, objects, and prefixes. Verify real Storage API upload/read/delete behavior, signed URL expiry/denial, legal holds, rollback/cleanup ordering, zero residue, unchanged `property-images` behavior, and private bucket configuration. No test uses production data.

### Application tests planned for later tasks

- Schema/mapper/service/action validation and sanitized error mapping.
- Owner/admin page authorization and AAL2 redirects.
- Duplicate submission prevention and stale optimistic-concurrency handling.
- Public repository exact pointer/archive defense and image ordering/signing failure.
- Location inventory joins, null-price handling, empty states, and no statistics fabrication.
- SEO/canonical/sitemap published-only behavior and absence of signed URLs/private evidence.
- Responsive galleries/maps, keyboard access, focus, loading/error/404 states, and existing property regression suites.

## Deployment and activation boundaries

Local implementation may create migration SQL, contract tests, pgTAP files, application code, and documentation after approval. It may not connect to Supabase Cloud.

Each later operation needs separate authorization:

1. Read-only official migration preview.
2. One exact migration deployment to the approved development project.
3. Exact rollback-only pgTAP execution.
4. Run-scoped Storage API security test.
5. Read-only generated-type synchronization.
6. Creation of any real project/location content.
7. Moderation/publication of that content.
8. Production project provisioning, migration, content population, hosting, and launch.

## Risks and current-schema conflicts

1. **Published property immutability:** existing rows cannot safely receive curated locations or project affiliations in place. Normal new revisions are required; launch content planning must account for this.
2. **Ambiguous current RERA model:** `property_revisions.rera_approved` is a boolean without evidence provenance. Projects must not copy that model; evidence/review is separate.
3. **Private-helper anonymous failure history:** the prior `property_images` policy caused PostgreSQL `42501`. New anonymous policies must remain self-contained and separately tested.
4. **RLS recursion:** property/revision cross-policies previously required security-definer helpers. Project/location policies must be designed and pgTAP-tested for recursion before deployment.
5. **Storage compensation:** database transactions cannot roll back Storage API calls. Project upload/delete paths need the existing metadata/object compensation model and uncertainty reporting.
6. **Revision cloning with images:** database metadata cannot simply point at old mutable paths. Copying objects is an external operation and needs deterministic compensation and no impact on the live gallery.
7. **Location archive references:** archived locations cannot cascade into listings. Public property/project pages retain snapshot text while the location link disappears.
8. **Legal-hold constraint:** current allowed entity kinds exclude projects/locations; extending it without implementing retention automation must not imply deletion approval.
9. **Audit duplication:** approval rows and lifecycle audit rows have distinct purposes. Tests must require one event per successful transition and zero events on failure.
10. **Performance:** project/location pages add signing and join work. Avoid N+1 signing/query patterns where possible and measure realistic inventory before launch.
11. **Content/legal accuracy:** admin approval is workflow evidence, not legal certification. Correction/takedown ownership and public disclaimers remain launch blockers.

## Acceptance criteria for design approval

- Product owner resolves the decision register or explicitly accepts the recommended defaults.
- Schema preserves stable identity, exact published pointers, historical locality text, owner/admin separation, and immutable audits.
- Public reads cannot expose nonpublic project/location revisions, private evidence, other-owner media, or archived content.
- No builder-profile capability or fabricated data path exists.
- Migration/test plan covers RLS, RPC, Storage, concurrency, evidence, audit, archival, retention, and existing-property regressions.
- Cloud and content operations remain separately authorized.

No migration or application implementation begins until this design is approved.
