# SAT12 Stage 3 Supabase Backend and Property Management — Design Specification

## Status and intent

Stage 3 replaces the in-memory property source with a secure Supabase backend and adds authenticated property-management workflows without changing the approved SAT12 search, listing, map, or responsive presentation. The public experience must continue to consume the existing `Property[]` view model so Stage 2 filtering, marker clustering, map-bounds intersection, card selection, favorites, and mobile Map/List switching remain stable.

This document is a planning artifact only. Product decisions are resolved below, but it does not authorize provisioning a Supabase project, applying migrations, changing environment variables, or implementing backend code. Local implementation begins only after this revision is reviewed; remote provisioning and migration always require separate explicit approval.

## Existing Stage 2 baseline

- Next.js App Router 16.4.0, React 19.3.0, TypeScript, Tailwind CSS 4, Vitest, React Leaflet 5, Leaflet 1.9, and OpenStreetMap tiles.
- `src/app/page.tsx` is currently a Client Component that owns filters, selected property ID, map bounds, search-as-map-moves, and mobile view.
- `useFilteredProperties(properties, filters)` is data-source independent. It accepts `readonly Property[]` and applies query, Buy/Rent, property type, price, and bedroom filters.
- The map receives every property matching ordinary filters; map bounds narrow only the listing pane. This distinction must remain intact.
- `Property` contains the card/map fields: stable ID, title, listing intent, property type, price, locality, city, coordinates, primary image, bedrooms, bathrooms, area, construction status, RERA flag, and optional badge.
- Nine Nagpur records and project-owned illustrative WebP images provide deterministic Development/Test/Staging fixtures only; Production never presents them as real inventory or silently falls back to them.
- Loading and filter/map empty states already exist, but there is no database error state.

## Recommended architecture

Use Supabase Auth, PostgreSQL, Storage, generated database types, and Row Level Security. Keep authorization in PostgreSQL policies as the final enforcement layer; Server Components and Server Actions provide UX-level route guards and validation but never replace RLS.

Split the current page into:

```text
src/app/page.tsx                         Server Component; streams published properties
src/app/loading.tsx                      route loading shell using existing SAT12 skeletons
src/app/error.tsx                        recoverable database error state
src/components/properties/
  PropertyExplorer.tsx                  existing Stage 2 client coordinator, receives Property[]
src/data/properties.ts                   seed fixture only, never production runtime source
src/features/properties/
  repository.ts                         PropertyRepository contract
  supabase-repository.ts                published/owner/admin queries and row mapping
  mapper.ts                             Database row -> Property view model
  schemas.ts                            shared Zod input validation
src/lib/supabase/
  browser.ts                            cookie-aware browser client
  server.ts                             request-scoped server client
  proxy.ts                              token refresh helper
src/proxy.ts                            narrowly matched session refresh
```

Public reads happen in a Server Component through the authenticated/anonymous Supabase server client and stream behind `Suspense`. No service-role client is used for normal application reads or mutations. Owner and admin mutations use Server Actions with server-side validation, verified claims, and the caller's cookie-backed Supabase client so RLS evaluates the real user.

### Alternatives considered

1. **Recommended: server-first repository adapter.** It preserves a small client bundle, gives the initial page database-backed HTML, centralizes row mapping, and keeps the Stage 2 client contract unchanged. It requires splitting the current page coordinator into a child Client Component.
2. **Client-side Supabase queries.** This requires less initial movement but delays first results, exposes more query behavior to the browser, complicates loading/error handling, and makes privileged workflows easier to implement incorrectly.
3. **Next.js Route Handlers as a complete REST facade.** This can isolate Supabase but duplicates the generated Data API, adds serialization and authorization code, and provides little value for same-origin Server Components and Server Actions. Route Handlers remain appropriate only for future external integrations/webhooks.

## Database schema

All application tables use UUID primary keys, `timestamptz` timestamps in UTC, explicit constraints, and RLS. Enum values are stable database contracts; user-facing copy is mapped in application code.

### Enums

```sql
create type public.app_role as enum ('user', 'owner_agent', 'admin');
create type public.listing_intent as enum ('buy', 'rent');
create type public.property_type as enum ('apartment', 'villa', 'independent_house', 'plot');
create type public.construction_status as enum ('ready_to_move', 'under_construction');
create type public.revision_status as enum (
  'draft', 'submitted', 'approved', 'rejected', 'published', 'superseded'
);
create type public.approval_decision as enum ('approved', 'rejected');
create type public.enquiry_status as enum ('new', 'contacted', 'closed', 'spam');
```

### `profiles`

One row per `auth.users` record.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, FK to `auth.users(id)` with cascade |
| `role` | `app_role` | not null, default `user`; never user-editable |
| `full_name` | `text` | 2–100 characters when present |
| `phone` | `text` | optional normalized value |
| `agency_name` | `text` | optional; relevant to owner/agent |
| `avatar_path` | `text` | optional Storage object path |
| `created_at`, `updated_at` | `timestamptz` | defaults and update trigger |

A trigger creates a profile after an Auth user is created, copying only explicitly accepted metadata such as full name. Role always defaults to `user`. Role elevation is an administrator-only operation and cannot be derived from user-editable metadata.

### `role_audit_log`

Append-only records contain target profile, previous/new roles, acting admin UUID or the literal bootstrap actor, reason, and timestamp. Authenticated clients cannot insert, update, or delete these records directly. AAL2 admins may read them; the bootstrap and role-change functions are the only writers.

### `properties` — stable listing identity

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `owner_id` | `uuid` | not null, FK to `profiles(id)`, indexed |
| `slug` | `text` | unique, immutable stable public URL key |
| `published_revision_id` | `uuid` | nullable FK added after revision table creation |
| `archived_at` | `timestamptz` | null while listing is active |
| `retention_notice_sent_at`, `retention_not_before` | `timestamptz` | nullable retention guardrails |
| `created_at`, `updated_at` | `timestamptz` | defaults and update trigger |

The stable property row owns URL identity, ownership, enquiries, and the pointer to the currently public revision. It does not contain mutable listing content. Deleting or replacing a revision therefore cannot change the public URL or detach enquiries.

### `property_revisions` — moderated listing content

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `property_id` | `uuid` | not null, FK to `properties(id)`, indexed |
| `revision_number` | `integer` | positive, unique per property |
| `replaces_revision_id` | `uuid` | nullable self-FK to the previously published revision |
| `title`, `description` | `text` | constrained lengths; description required for submission |
| `listing_intent` | `listing_intent` | not null |
| `property_type` | `property_type` | not null |
| `price_inr` | `bigint` | positive; monthly amount for rent |
| `locality`, `city`, `state`, `postal_code` | `text` | city defaults to Nagpur for Stage 3 |
| `latitude`, `longitude` | `double precision` | valid ranges and required before submission |
| `location` | `extensions.geography(Point,4326)` | generated/synchronized point with GiST index |
| `bedrooms`, `bathrooms` | `smallint` | non-negative; zero permitted for plots |
| `area_sq_ft` | `integer` | positive |
| `construction_status` | `construction_status` | not null |
| `rera_approved` | `boolean` | default false |
| `rera_number` | `text` | optional; required by policy only when business rules demand it |
| `badge` | `text` | nullable, constrained to `featured` or `new`; admin-controlled |
| `status` | `revision_status` | not null, default `draft`, indexed |
| `rejection_reason` | `text` | admin-authored snapshot for owner UX |
| `retention_notice_sent_at`, `retention_not_before` | `timestamptz` | nullable rejected-revision retention guardrails |
| `submitted_at`, `approved_at`, `published_at` | `timestamptz` | lifecycle timestamps |
| `created_by` | `uuid` | not null, FK to profile |
| `created_at`, `updated_at` | `timestamptz` | defaults and update trigger |

At most one non-terminal working revision (`draft`, `submitted`, `approved`, or `rejected`) may exist per property. A new draft for an already-published property is created only by `create_listing_revision(property_id)`, which clones the published revision and links `replaces_revision_id`. The public repository joins `properties.published_revision_id` to exactly one `published` revision and excludes `archived_at` rows. Publication atomically changes the approved revision to `published`, changes the prior published revision to `superseded`, and switches the stable pointer. No owner update can modify a `published`, `submitted`, `approved`, or `superseded` revision.

Indexes support public inventory and management queries: the stable slug and published pointer, `(property_id, status, updated_at desc)`, filter indexes for intent/type/price/bedrooms on revisions, a unique partial working-revision index, and GiST on `location`. Initial public queries return all published Nagpur properties and retain client-side filtering to preserve exact Stage 2 behavior. Server-side filter/RPC optimization is deferred until measured inventory size requires it.

### `property_images`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `revision_id` | `uuid` | FK to `property_revisions` with cascade, indexed |
| `storage_path` | `text` | unique object path, not a signed URL |
| `alt_text` | `text` | required before submission |
| `position` | `smallint` | 0–11, unique per revision |
| `width`, `height`, `size_bytes` | `integer` | positive metadata |
| `mime_type` | `text` | allow JPEG, PNG, WebP |
| `source_kind` | `text` | `owner_uploaded` or `sat12_illustrative` |
| `created_by` | `uuid` | FK to profile |
| `created_at` | `timestamptz` | default now |

At least one image is required for submission. Position zero is the primary image mapped to the existing `Property.image`. Images are revision-scoped so a draft cannot mutate the currently published gallery. A database constraint limits position; a transaction/RPC validates full submission requirements and prevents races that row-level checks alone cannot express.

### `enquiries`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `property_id` | `uuid` | FK, indexed |
| `property_revision_id_at_submission` | `uuid` | not null FK to the public revision seen by the sender |
| `sender_id` | `uuid` | not null FK to authenticated profile |
| `name`, `email`, `phone`, `message` | `text` | validated and length-limited |
| `status` | `enquiry_status` | default `new` |
| `created_at`, `updated_at`, `closed_at` | `timestamptz` | lifecycle timestamps |

Only authenticated users may create enquiries. The enquiry references the stable `property_id`, so it survives publication of later revisions. The submission function also records `property_revision_id_at_submission` for an immutable snapshot reference. Guest enquiries and Google OAuth are outside Stage 3.

### `listing_approvals`

Append-only moderation history.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `property_id` | `uuid` | FK with restrict, indexed |
| `revision_id` | `uuid` | FK with restrict to the exact reviewed revision |
| `reviewer_id` | `uuid` | FK to admin profile |
| `decision` | `approval_decision` | not null |
| `notes` | `text` | required for rejection |
| `property_snapshot` | `jsonb` | immutable reviewed-field snapshot |
| `created_at` | `timestamptz` | default now |

Current moderation state stays on `property_revisions.status`; `listing_approvals` is the append-only audit trail for the exact revision reviewed. Approval/rejection is performed only through narrowly granted database functions that atomically validate the current state, insert the review event, change status/timestamps, and preserve a snapshot.

### `legal_holds` and `retention_audit_log`

`legal_holds` stores an entity kind, entity UUID, reason, creator, and release metadata. Only AAL2 admins can read or modify holds through audited functions. `retention_audit_log` records dry-run/execution batch ID, entity, action, result, actor, and timestamp and is append-only. Retention candidate and execution functions exclude any directly held entity plus dependent records protected by a held stable property.

## Authentication and roles

Use Supabase Auth with cookie-based SSR through `@supabase/ssr`. The browser and server use the public publishable key. A Next.js Proxy refreshes expired tokens on a narrow matcher. Protected pages and mutations verify identity with `supabase.auth.getClaims()`; server code must not trust `getSession()` as authorization evidence.

Roles:

- `user`: browse published inventory, manage own profile, create/read own enquiries.
- `owner_agent`: all user permissions plus create drafts, manage owned editable listings/images, submit listings, and read enquiries for owned published listings.
- `admin`: review all submitted listings, approve/reject/publish/archive, set badges, manage roles, and inspect enquiries required for moderation/support.

Default signup role is `user`. Owner/agent elevation requires an existing administrator through a protected database function and an explicit approval record; self-service role escalation is impossible. Stage 3 supports verified email/password, logout, and password recovery. Google OAuth is deferred.

Administrators must enroll a TOTP factor and present an `aal2` token before any admin page, role mutation, moderation function, approval-history access, or administrative enquiry access succeeds. Both application guards and database helpers check `auth.jwt()->>'aal' = 'aal2'`; an `admin` role at `aal1` is deliberately insufficient. Local pgTAP tests use AAL claims, and staging browser verification must prove enrollment, challenge, recovery, and rejection at AAL1. Production deployment is blocked until staging demonstrates reliable MFA enforcement and an emergency recovery procedure is documented.

### First-administrator bootstrap

The first admin cannot be created by an ordinary client or by user metadata. A one-time operator script runs only from a trusted workstation/CI environment with a service-role secret supplied through the process environment. It resolves one exact, email-confirmed Auth user, calls a service-role-only `bootstrap_first_admin(target_user_id)` function, and refuses to run when any admin already exists. The function records actor `bootstrap`, target UUID, timestamp, and reason in an immutable `role_audit_log`. The script never prints tokens and the service key never enters application runtime or browser bundles. After bootstrap, the user must enroll and verify TOTP before any admin operation; all later role changes require an existing AAL2 administrator. Production bootstrap requires an explicit runbook approval and credential rotation/revocation review after use.

Authorization is checked in three places:

1. Navigation/page guards for understandable UX.
2. Server Action validation and verified claims for early rejection.
3. PostgreSQL RLS and functions as the authoritative boundary.

## Row Level Security model

RLS is enabled on every public table. Policies specify `to anon` or `to authenticated`, wrap `auth.uid()` in `select` where appropriate, and index policy columns.

### Profiles

- Authenticated users select and update their own non-role profile fields.
- AAL2 admins select profiles and change roles through `private.set_user_role(target_id, role, reason)` only; every change appends to `role_audit_log`.
- No client can directly update `profiles.role`.

### Properties and revisions

- `anon` and `authenticated`: select active stable properties only through their `published_revision_id`, and select only that current published revision.
- Owners: additionally select their own stable property and every revision belonging to it.
- Owners/agents: create a stable property plus revision 1 only through `create_draft_listing`; `owner_id` is derived from `auth.uid()`.
- Owners/agents: directly update/delete only owned `draft` or `rejected` revisions. Stable `owner_id`, slug, published pointer, moderation timestamps, status, and badge are guarded by column grants and lifecycle functions.
- Owners create edits to a published listing only through `create_listing_revision`, which clones current published content/images into a new draft. The public pointer remains unchanged throughout review.
- `submitted`, `approved`, `published`, and `superseded` revisions are immutable to owners. Rejection makes only that rejected revision editable.
- Admin access is mediated by `private.is_aal2_admin()` with a fixed `search_path`, revoked public execution where appropriate, and accompanying pgTAP tests.

### Property images and Storage

- Metadata visibility follows the revision: public only for images on the stable property's current published revision; owner for owned revisions; AAL2 admin for all.
- Owners insert/update/delete image metadata only for owned editable revisions.
- The private `property-images` bucket uses paths `{owner_uuid}/{property_uuid}/{revision_uuid}/{image_uuid}.{ext}`.
- Storage policies require the authenticated UID to match the first path segment and verify stable ownership plus editable revision state for upload/delete.
- Public pages create short-lived signed URLs using the anonymous/caller-scoped server client only for the current published revision. Use a ten-minute URL lifetime with a server data-cache lifetime no longer than five minutes so cached pages do not routinely emit expired URLs. Owner/AAL2-admin dashboards receive signed URLs for rows their RLS identity may select.
- The browser never receives a service-role key. Signed URLs are output capabilities with short expiry, not permanent database values.

### Enquiries

- Authenticated users insert enquiries with `sender_id = auth.uid()` against published properties.
- Senders select their own enquiries.
- Property owners select and update status for enquiries targeting their own properties.
- AAL2 admins can inspect/update all enquiries.
- No user may alter identity, property, or message fields after insert.

### Listing approvals

- Owners can select approval history for their own properties.
- AAL2 admins can select all reviews.
- Direct inserts/updates/deletes are denied; approve/reject functions create events atomically.

Security-definer functions live in an unexposed `private` schema, set `search_path = ''`, schema-qualify every relation, validate caller role and AAL internally, and have execute privileges revoked from `public` unless explicitly required. The service-role key is never prefixed with `NEXT_PUBLIC_`, never committed, and is not needed by routine application paths. The sole Stage 3 use is the explicit first-admin bootstrap operator script; local fixture scripts use local-only credentials.

## Listing lifecycle

```text
stable property ──points to──> published revision N
       │                            ▲
       └─create revision N+1        │ atomic pointer swap on publish
              draft -> submitted -> approved -> published
                ▲          │                       │
                └─rejected─┘        prior published└-> superseded
```

- **Draft:** owner can edit fields and revision-scoped images. For a published listing, it is a private clone and does not affect the public revision.
- **Submitted:** immutable to owner; visible in admin review queue.
- **Rejected:** owner sees required notes, can edit, and resubmit. Old approval events remain immutable.
- **Approved:** moderation passed but not publicly visible. This separation supports scheduled/manual publication and a final admin check.
- **Published:** visible only when referenced by the stable property's `published_revision_id`.
- **Superseded:** immutable former public revision retained for moderation and enquiry context.
- **Archived property:** `archived_at` removes the stable listing from public inventory while retaining its revisions, URL identity, enquiries, and audit records according to retention rules.

Draft creation, revision cloning, submission, approval, rejection, publication, and archival are database functions, not arbitrary status updates. Every transition locks the stable property and target revision, checks source state/ownership/role/AAL, stamps timestamps, and returns the updated row. Concurrent or repeated transitions fail cleanly. Publication performs one transaction: confirm the approved revision belongs to the property, supersede the old public revision, publish the new one, and update `published_revision_id`. A revision can never become public through a direct update.

The approved published-edit strategy is **copy-on-revision**. The stable property ID and slug never change, so public URLs, enquiries, and listing-level history remain attached while revision-specific content and images pass through a fresh moderation cycle.

## Image upload workflow

1. Owner creates a stable property plus editable revision and receives both UUIDs.
2. Client validates count, MIME type, and size, then requests upload through the authenticated Supabase client.
3. Storage RLS permits a unique object path only under the owner's/property/revision prefix.
4. After upload, a Server Action validates object metadata and inserts `property_images` metadata under database RLS.
5. Removal deletes metadata and object only while the revision is editable.
6. Submission verifies one to twelve complete images and alt text.

Bucket policy allows JPEG, PNG, and WebP up to 5 MB each. Standard uploads are appropriate below 6 MB. Images use new immutable paths instead of upsert to avoid stale CDN content. Server-side image transformation/moderation is not included in the first Stage 3 slice; generated Stage 2 images remain clearly labelled illustrative seed data.

## Data access and Stage 2 preservation

Define a narrow repository contract:

```ts
interface PropertyRepository {
  listPublished(): Promise<readonly Property[]>;
  listOwned(ownerId: string): Promise<readonly ManagedProperty[]>;
  getManaged(id: string): Promise<ManagedProperty | null>;
}
```

`listPublished()` selects only fields needed by the existing card/map view plus the primary image metadata, maps database enums to current display unions, and creates signed image URLs. `PropertyImage` gains a data-source-neutral `kind: "listing" | "illustrative"` field so live owner uploads are not mislabeled as generated imagery; card layout does not change. The Stage 2 seed data maps into the same interface for tests and an explicitly configured local fallback only; production does not silently fall back to mocks after a database error.

`page.tsx` becomes a Server Component and renders `PropertyExplorer initialProperties={properties}` behind `Suspense`. `PropertyExplorer` contains the current client state and continues this exact derivation:

```text
database-published Property[]
  -> useFilteredProperties(filters)
     -> all ordinary matches to PropertyMap
     -> useMapBoundsFilter(...) to PropertyResults only
```

For the initial launch, filtering remains client-side to preserve behavior. A later measured scale threshold (recommended: several thousand active listings or excessive initial payload) can introduce a typed bounds/filter RPC and pagination without altering card/map contracts.

## Loading, error, and empty states

- Route loading uses the existing SAT12 skeleton language and retains the 30/70 desktop frame.
- Database query failure renders a recoverable `error.tsx` state with “Try again”; it never presents stale mocks as live listings.
- Zero published rows renders a neutral inventory-empty message distinct from “filters returned no results.”
- Client filters yielding zero results keep the current filter-empty state.
- Map bounds yielding zero results keep the current map-specific empty guidance.
- Owner/admin forms expose field errors, form-level errors, pending state, and success confirmation using accessible status regions.
- Auth/session expiry redirects protected routes to login with a safe relative return path.
- Image upload failures remain retryable and do not discard the draft.

## Docker-free cloud development

Commit `.env.example` with names only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_TEST_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=
SUPABASE_TEST_DB_URL=
```

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-safe. Project references are identifiers but still remain environment-specific. `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_SERVICE_ROLE_KEY` are operational secrets for a developer shell, OS credential store, or protected CI secret store; they must never be imported by Client Components, printed, committed, or exposed through Server Action responses. Add `server-only` guards to privileged modules. Existing `.env*` ignore rules remain; `.env.example` is explicitly unignored and contains names only.

Stage 3 uses no Docker runtime and no local Supabase containers. Each developer connects the checked-out migrations to an explicitly approved, dedicated Supabase Cloud **Development** project. Destructive migration replay and tests that need an empty database use a separate disposable/replaceable Supabase Cloud **Test** project (or an isolated Supabase preview branch when separately approved and available). Development, Test, Staging, and Production have different project references, credentials, Auth users, Storage contents, and deployment approvals.

After the user approves the exact Development/Test project references and the operation, the Docker-free CLI flow is:

```text
npx supabase login
npx supabase link --project-ref <approved-development-project-ref>
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase gen types typescript --project-id <approved-development-project-ref> --schema public > src/types/database.generated.ts
npm run test:db:cloud
npm run dev
```

`supabase login` is interactive and its token is never copied into chat. Linking must be repeated/verified when switching worktrees or targets. Before every mutating CLI command, print and compare the intended project reference against an allowlist. Commit `supabase/config.toml`, timestamped migrations, database tests, safe seed tooling, and generated TypeScript types. Ignore `supabase/.temp/`, `.supabase/`, and all environment files except `.env.example`.

`supabase db reset` is prohibited against every cloud project, including Development and Test. The CLI dry-run and migration list are mandatory before `db push`. Applied migrations are never edited; corrections are new forward-only migrations. Staging and Production pushes occur only through separately approved deployment gates.

## Migrations and seed strategy

Use forward-only reviewed SQL migrations:

1. Extensions, enums, tables, constraints, indexes, update triggers.
2. Profile creation, role helpers, and grants.
3. RLS policies and lifecycle functions.
4. Storage bucket and object policies.
5. Development/Test fixture tooling for Auth users and the nine Nagpur properties/images metadata; fixtures are not embedded in a production migration.

The nine project-owned WebP files stay in `public/` for the Stage 2 baseline and tests. An idempotent, environment-guarded script creates disposable test identities and uploads/copies illustrative fixtures into Development/Test Storage using unique run IDs. It requires an explicit allowlisted project reference, refuses Staging/Production, and cleans up only records created by that run. No illustrative listing seed is ever applied to Production.

Migration replay from an empty database is verified only on a disposable Test project/preview branch whose destruction is explicitly approved. Shared Development is never reset. Generated types come from the migrated Development schema and are regenerated to a temporary file for drift comparison.

## Provisional retention and privacy workflows

These periods are approved as provisional engineering defaults and remain subject to legal review:

| Data | Eligibility | Safe action |
|---|---|---|
| Rejected draft revisions | 90 days after last activity | Send owner notice, set `retention_not_before`, then delete revision content/images only after the notice window; never delete the stable property if it has published history or enquiries |
| Archived listings | 2 years after `archived_at` | Anonymize owner-facing descriptive/PII fields and remove non-required images; retain stable ID/slug tombstone and required audit/enquiry references |
| Unused images | 30 days after becoming unreferenced | Mark candidate, re-check references in the deletion transaction, delete Storage object, then metadata; retry object failures without deleting metadata first |
| Closed enquiries | 12 months after closure | Anonymize name/email/phone/message while retaining property, timestamps, status, and aggregate-safe identifiers |
| Approval history | 3 years | Retain immutable decision/snapshot until expiry, then apply the legally approved anonymization/deletion rule without breaking revision integrity |

Implementation provides `retention_candidates(as_of)` and AAL2-admin `apply_retention(candidate_ids, dry_run)` functions, an append-only `retention_audit_log`, idempotency, legal-hold exclusion, dry-run reports, and batch limits. Automatic production scheduling remains disabled until legal approves the periods, notice language/delivery, legal-hold rules, and whether approval snapshots may be deleted or must be anonymized. No cascade may remove enquiries or moderation history earlier than its own retention rule.

## Testing and security verification

### Database tests

Use pgTAP under `supabase/tests/` to verify:

- RLS is enabled on every exposed table.
- Anonymous users see published properties only.
- Users cannot create listings or change roles.
- Owners can mutate only their own editable listings and image paths.
- Submitted/published listings cannot be altered by owners.
- Admin transitions create immutable approval history.
- AAL1 admins are denied every privileged function; AAL2 admins succeed.
- First-admin bootstrap refuses unconfirmed targets and refuses every run after an admin exists.
- Enquiry sender/owner/admin visibility is correct.
- Storage policies reject cross-owner paths and unpublished unauthorized reads.
- Invalid transitions and concurrent/repeated approvals fail.
- Revision publication swaps the stable pointer atomically and never exposes a draft/approved revision.
- Retention dry-runs are non-mutating; execution is idempotent, legal-hold aware, and preserves referential history.

The Supabase CLI pgTAP runner can rely on a container even when a linked database is selected, so Stage 3 does not use it. `npm run test:db:cloud` invokes a repository-owned Node runner using the `pg` package and an ignored `SUPABASE_TEST_DB_URL`. The runner verifies the allowlisted Test project, opens a TLS PostgreSQL connection, runs each `supabase/tests/*.test.sql` file in an explicit transaction, captures pgTAP output, exits nonzero on SQL or `not ok` results, and always rolls back. Tests use deterministic or run-scoped UUIDs and do not depend on pre-existing shared data. Application/Storage integration tests create run-scoped Auth users, object prefixes, and rows, then clean up only those resources. If a separate Test project or preview branch is unavailable, database security, clean-schema replay, and destructive lifecycle verification remain blocked; they are not redirected to Development.

### Application tests

- Mapper tests cover every enum and missing-image defense.
- Repository tests cover success, empty result, error propagation, and stable ordering.
- Server Action tests cover validation, unauthenticated, wrong-role, RLS rejection, and success.
- Existing 50 Stage 2 tests remain green with repository data.
- Page tests distinguish route loading, database failure, no published inventory, filter empty, and map-bounds empty.
- Browser tests cover sign-up/login/logout/recovery, owner approval, owner draft/upload/submit, TOTP enrollment/challenge, AAL1 admin rejection, AAL2 admin approve/publish, revision swap at the same public URL, and public listing/map appearance.

### CI and deployment gates

Run:

```text
npm ci
npx supabase link --project-ref <approved-test-project-ref>
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
npm run test:db:cloud
npm test
npm run lint
npm run typecheck
npm run build
```

CI uses a dedicated Test project or per-PR Supabase preview branch and serialized access when the target is shared; it never uses Development, Staging, or Production for destructive testing. Add secret scanning, migration-history checks, generated-type drift detection, and a check that privileged identifiers do not appear in client bundles/source imports. Apply migrations to Staging before Production. Back up Production, verify migration history, deploy schema before application code when backward compatible, smoke-test public and role workflows, and roll back with a forward corrective migration rather than rewriting applied migrations.

## Incremental delivery strategy

1. **Foundation:** CLI config, schema, migrations, generated types, seed data, pgTAP. No runtime UI change.
2. **Read path:** server repository and `PropertyExplorer` extraction behind a temporary data-source flag; preserve Stage 2 behavior and compare mock/live output.
3. **Auth/profile:** cookie SSR clients, Proxy refresh, login/recovery, first-admin bootstrap, TOTP/AAL2 admin enforcement, profile bootstrap, protected route shell.
4. **Owner management:** dashboard, draft create/edit, private image upload, validation, submission.
5. **Admin moderation:** review queue, approval/rejection/publish functions, audit history.
6. **Enquiries:** authenticated lead submission and owner/admin inbox.
7. **Cutover/hardening:** default to Supabase, remove production mock fallback, run security/browser/performance verification, stage deployment.

Each slice is independently testable and committed separately. The Stage 2 public page remains runnable throughout; the data-source switch occurs only after live data parity tests pass.

## Approved product decisions

1. Owner/agent elevation requires AAL2-admin approval.
2. Stage 3 authentication is verified email/password plus recovery; Google OAuth is deferred.
3. Enquiries require an authenticated user.
4. Published edits use copy-on-revision with stable listing IDs/slugs, enquiry links, and moderation history.
5. Approval and publication are separate AAL2-admin actions.
6. Property images use a private bucket and short-lived signed URLs.
7. Admin MFA is mandatory before production; inability to verify it blocks deployment.
8. Development uses a dedicated Supabase Cloud Development project without Docker; destructive/replay verification uses an isolated Cloud Test target; Staging and Production remain separate and every cloud reset is prohibited.
9. Retention periods use the provisional table above, safe deletion/anonymization, and legal review before production automation.
10. Nine illustrative Nagpur listings are Development/Test/Staging fixtures only and are prohibited in Production.

## Supabase Cloud setup runbook (operator-performed)

No step in this section is authorized until the user approves the exact target project and operations. The operator performs these actions without pasting secrets into chat:

1. In Supabase Dashboard, create a new project named **SAT12 Development** in the chosen organization and an India-adjacent region appropriate for the team. Generate a unique database password and store it in the team's password manager.
2. Create a separate **SAT12 Test** project, or enable an isolated preview-branch workflow, for clean migration replay and destructive test data. Never point tests at Staging or Production.
3. From Development **Project Settings → API**, copy the Project URL and publishable key into ignored `.env.local`. Do not place a service-role key in any `NEXT_PUBLIC_*` variable.
4. From the developer's Supabase account settings, create a least-privilege personal access token for CLI use. Store it in the OS credential manager or transient process environment, not the repository or chat. Use a separate protected CI token later.
5. In Development **Authentication → Providers**, enable email/password and require email confirmation. Set Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` for development. Production URLs and SMTP remain separate launch tasks.
6. Confirm TOTP MFA is available for Development. Do not grant an admin role until the audited bootstrap migration/script exists; afterward, enroll the first admin and prove AAL1 denial plus AAL2 success.
7. Do not manually create application tables, functions, RLS policies, or the Storage bucket in the Dashboard. Apply them from reviewed migrations so Git remains authoritative.
8. Invite teammates through the Supabase organization/project access UI with the minimum role required. Share project identifiers and browser-safe values through team configuration; share operational secrets only through an approved secret manager.

Developer `.env.local` contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. CLI/project automation values belong in transient shell variables or a separate ignored operational env file: `SUPABASE_PROJECT_REF`, `SUPABASE_TEST_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_TEST_DB_URL`, and, only when prompted by the CLI, `SUPABASE_DB_PASSWORD`. The database URL/password are secrets and must never be printed. `SUPABASE_SERVICE_ROLE_KEY` is permitted only for the one-time bootstrap and tightly scoped fixture/cleanup scripts running in a trusted server process; the application does not read it during normal runtime.

## Implementation prerequisites and external blockers

- **Required before implementation:** user-approved Development project reference and permitted operations, Project URL/publishable key, CLI access token, database password in a local secret store, and a confirmed Auth redirect URL. A separate approved Cloud Test project/preview branch is required for clean migration replay and destructive security verification. None is provisioned by this plan.
- **Required for staging:** a separately approved Staging Supabase project/reference, public URL/publishable key, protected database/operational credentials in the deployment secret store, configured Auth redirect URLs/email delivery, and a staging hosting URL. These are not provisioned by this plan.
- **Required for production:** a separate explicitly provisioned production Supabase project, production hosting environment, verified email provider/domain, backup/restore ownership, monitoring, first-admin identity, secure bootstrap operator, TOTP recovery procedure, and successful staging MFA/security evidence. Remote provisioning needs explicit user approval.
- **Legal blocker:** automatic production retention/purge stays disabled until counsel approves periods, notice language/delivery, legal holds, enquiry anonymization, and approval-history disposition. Manual deletion must also honor holds and audit logging.
- **Operational blocker:** production launch is blocked if AAL2 cannot be enforced in both database policies/functions and browser flows, or if the initial admin cannot enroll/recover MFA safely.

## Consistency review

- **Schema:** stable listing identity is separated from moderated revisions. Enquiries reference the stable property and capture the revision seen at submission; images and approvals reference exact revisions. Circular published-pointer creation is handled by an ordered FK migration.
- **Lifecycle:** owners can change only draft/rejected revisions. Approval does not publish. Publication locks the property/revisions and atomically supersedes the prior revision plus swaps one stable pointer. Direct status/pointer writes are denied.
- **RLS:** owner identity comes from `auth.uid()`, never input. Role comes from the protected profile, never user metadata. Every admin path requires both role `admin` and JWT `aal2`. Cross-owner and cross-revision operations are denied in table, function, and Storage tests.
- **Images:** draft and public galleries cannot share mutable metadata. Signed URLs are created only after caller-scoped RLS selection, expire after ten minutes, and are cached for at most five minutes. Object deletion is finalized only after eligibility is rechecked.
- **Admin bootstrap/MFA:** one service-role-only bootstrap is audited and self-disabling after the first admin. It grants the role but not administrative access until TOTP produces AAL2. Production remains blocked until staging verifies enrollment, challenge, denial, and recovery.
- **Retention:** candidate calculation, holds, notices, anonymization/deletion, retries, and audit are explicit. No automatic production schedule exists before legal review; approval-history disposition deliberately fails closed pending that decision.
- **Stage 2 preservation:** database rows map to the existing `Property[]`; filters remain client-side initially; markers receive all ordinary-filter matches and map bounds narrow only listings.
- **Migration/deployment:** migrations are forward-only, every cloud reset is prohibited, mutating commands require an approved/allowlisted target plus dry-run, illustrative data is blocked from Staging/Production, and no remote resource or migration is authorized by this document.

The review found no unresolved internal contradiction after adopting the stable-property/versioned-revision split. Remaining blockers are external/operational or legal and are listed above; they do not require weakening RLS or changing the Stage 2 UI.

## Acceptance criteria

1. Public listings are read from Supabase and still satisfy the current `Property[]` UI contract.
2. Stage 2 filters, 30/70 layout, three-column results, markers, clusters, previews, map-bounds behavior, and mobile toggle remain unchanged.
3. RLS is enabled and tested for every exposed table and Storage object operation.
4. No service-role or database secret reaches browser code, logs, screenshots, or committed files.
5. Owners can manage only their listings and cannot bypass moderation; admins have auditable transition controls.
6. Only published listings appear to anonymous users.
7. Database loading, error, inventory-empty, filter-empty, and map-empty states are distinct and accessible.
8. Migrations replay cleanly on an approved disposable Cloud Test target, generated types match the Development schema, and database/application/browser/security checks pass without Docker.
9. Deployment uses staging verification and forward-only migration discipline.
10. Published revisions retain one stable public URL and cannot bypass submission, approval, and publication.
11. AAL1 administrators cannot perform privileged reads or mutations; production remains blocked until AAL2 is verified in staging.
12. Retention actions are dry-run capable, idempotent, audited, legal-hold aware, and not automatically scheduled before legal approval.

## Explicit non-goals

- Payments, subscriptions, paid boosts, or invoicing.
- Chat, push notifications, saved-search alerts, or persistent favorites.
- Automated identity/KYC, RERA verification, image moderation, or fraud scoring.
- Multi-city search, geocoding, routing, or replacing OpenStreetMap.
- Direct public access to service-role credentials or disabling RLS for convenience.
