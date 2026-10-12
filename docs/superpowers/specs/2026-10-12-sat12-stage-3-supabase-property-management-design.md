# SAT12 Stage 3 Supabase Backend and Property Management — Design Specification

## Status and intent

Stage 3 replaces the in-memory property source with a secure Supabase backend and adds authenticated property-management workflows without changing the approved SAT12 search, listing, map, or responsive presentation. The public experience must continue to consume the existing `Property[]` view model so Stage 2 filtering, marker clustering, map-bounds intersection, card selection, favorites, and mobile Map/List switching remain stable.

This document is a planning artifact only. It does not authorize provisioning a Supabase project, applying migrations, changing production environment variables, or implementing backend code. Those actions begin only after the approval decisions near the end of this document are resolved.

## Existing Stage 2 baseline

- Next.js App Router 16.4.0, React 19.3.0, TypeScript, Tailwind CSS 4, Vitest, React Leaflet 5, Leaflet 1.9, and OpenStreetMap tiles.
- `src/app/page.tsx` is currently a Client Component that owns filters, selected property ID, map bounds, search-as-map-moves, and mobile view.
- `useFilteredProperties(properties, filters)` is data-source independent. It accepts `readonly Property[]` and applies query, Buy/Rent, property type, price, and bedroom filters.
- The map receives every property matching ordinary filters; map bounds narrow only the listing pane. This distinction must remain intact.
- `Property` contains the card/map fields: stable ID, title, listing intent, property type, price, locality, city, coordinates, primary image, bedrooms, bathrooms, area, construction status, RERA flag, and optional badge.
- Nine Nagpur records and project-owned illustrative WebP images provide a deterministic fallback and local seed fixture.
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
create type public.listing_status as enum (
  'draft', 'submitted', 'approved', 'rejected', 'published', 'archived'
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

### `properties`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `owner_id` | `uuid` | not null, FK to `profiles(id)`, indexed |
| `slug` | `text` | unique, immutable after publication |
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
| `status` | `listing_status` | not null, default `draft`, indexed |
| `rejection_reason` | `text` | admin-authored snapshot for owner UX |
| `submitted_at`, `approved_at`, `published_at` | `timestamptz` | lifecycle timestamps |
| `created_at`, `updated_at` | `timestamptz` | defaults and update trigger |

Indexes support public inventory and management queries: partial index on `(published_at desc)` where `status = 'published'`, `(owner_id, status, updated_at desc)`, filter indexes for intent/type/price/bedrooms, and GiST on `location`. Initial public queries return all published Nagpur properties and retain client-side filtering to preserve exact Stage 2 behavior. Server-side filter/RPC optimization is deferred until measured inventory size requires it.

### `property_images`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `property_id` | `uuid` | FK with cascade, indexed |
| `storage_path` | `text` | unique object path, not a signed URL |
| `alt_text` | `text` | required before submission |
| `position` | `smallint` | 0–11, unique per property |
| `width`, `height`, `size_bytes` | `integer` | positive metadata |
| `mime_type` | `text` | allow JPEG, PNG, WebP |
| `source_kind` | `text` | `owner_uploaded` or `sat12_illustrative` |
| `created_by` | `uuid` | FK to profile |
| `created_at` | `timestamptz` | default now |

At least one image is required for submission. Position zero is the primary image mapped to the existing `Property.image`. A database constraint limits position; a transaction/RPC validates full submission requirements and prevents races that row-level checks alone cannot express.

### `enquiries`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `property_id` | `uuid` | FK, indexed |
| `sender_id` | `uuid` | nullable FK for authenticated users |
| `name`, `email`, `phone`, `message` | `text` | validated and length-limited |
| `status` | `enquiry_status` | default `new` |
| `created_at`, `updated_at` | `timestamptz` | defaults |

The initial recommendation is authenticated enquiries only, which reduces abuse and gives reliable ownership. Guest enquiries are an approval decision because they require CAPTCHA, rate limiting, retention rules, and an abuse-response process.

### `listing_approvals`

Append-only moderation history.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `property_id` | `uuid` | FK with restrict, indexed |
| `reviewer_id` | `uuid` | FK to admin profile |
| `decision` | `approval_decision` | not null |
| `notes` | `text` | required for rejection |
| `property_snapshot` | `jsonb` | immutable reviewed-field snapshot |
| `created_at` | `timestamptz` | default now |

The current state stays on `properties.status`; `listing_approvals` is the audit trail. Approval/rejection is performed only through narrowly granted database functions that atomically validate the current state, insert the review event, change status/timestamps, and preserve a snapshot.

## Authentication and roles

Use Supabase Auth with cookie-based SSR through `@supabase/ssr`. The browser and server use the public publishable key. A Next.js Proxy refreshes expired tokens on a narrow matcher. Protected pages and mutations verify identity with `supabase.auth.getClaims()`; server code must not trust `getSession()` as authorization evidence.

Roles:

- `user`: browse published inventory, manage own profile, create/read own enquiries.
- `owner_agent`: all user permissions plus create drafts, manage owned editable listings/images, submit listings, and read enquiries for owned published listings.
- `admin`: review all submitted listings, approve/reject/publish/archive, set badges, manage roles, and inspect enquiries required for moderation/support.

Default signup role is `user`. Owner/agent and admin elevation require an existing admin through a protected database function. The recommended initial login methods are verified email/password and password recovery; social OAuth and MFA are separate future enhancements. Admin MFA can become mandatory before production launch if the selected Supabase plan supports the desired enforcement.

Authorization is checked in three places:

1. Navigation/page guards for understandable UX.
2. Server Action validation and verified claims for early rejection.
3. PostgreSQL RLS and functions as the authoritative boundary.

## Row Level Security model

RLS is enabled on every public table. Policies specify `to anon` or `to authenticated`, wrap `auth.uid()` in `select` where appropriate, and index policy columns.

### Profiles

- Authenticated users select and update their own non-role profile fields.
- Admins select profiles and change roles through `private.set_user_role(target_id, role)` only.
- No client can directly update `profiles.role`.

### Properties

- `anon` and `authenticated`: select only rows with `status = 'published'`.
- Owners: additionally select their own rows in every state.
- Owners/agents: insert rows only with `owner_id = auth.uid()` and `status = 'draft'`.
- Owners/agents: directly update/delete only owned `draft` or `rejected` rows; protected columns (`owner_id`, moderation status/timestamps, badge) are guarded by column grants and transition functions.
- `submitted`, `approved`, and `published` rows are immutable to owners. Editing a published listing requires the explicit revision strategy selected before implementation.
- Admin access is mediated by `private.is_admin()` with a fixed `search_path`, revoked public execution where appropriate, and accompanying pgTAP tests.

### Property images and Storage

- Metadata visibility follows the parent property: public only for published properties; owner for owned properties; admin for all.
- Owners insert/update/delete image metadata only for owned editable properties.
- The private `property-images` bucket uses paths `{owner_uuid}/{property_uuid}/{image_uuid}.{ext}`.
- Storage policies require the authenticated UID to match the first path segment and verify ownership/editable property state for upload/delete.
- Public pages request short-lived signed URLs on the server only for published image rows. Owner/admin dashboards receive signed URLs for records they are authorized to see.
- The browser never receives a service-role key. Signed URLs are output capabilities with short expiry, not permanent database values.

### Enquiries

- Authenticated users insert enquiries with `sender_id = auth.uid()` against published properties.
- Senders select their own enquiries.
- Property owners select and update status for enquiries targeting their own properties.
- Admins can inspect/update all enquiries.
- No user may alter identity, property, or message fields after insert.

### Listing approvals

- Owners can select approval history for their own properties.
- Admins can select all reviews.
- Direct inserts/updates/deletes are denied; approve/reject functions create events atomically.

Security-definer functions live in an unexposed `private` schema, set `search_path = ''`, schema-qualify every relation, validate caller role internally, and have execute privileges revoked from `public` unless explicitly required. The service-role key is never prefixed with `NEXT_PUBLIC_`, never committed, and is not needed by routine application paths.

## Listing lifecycle

```text
draft ──submit──> submitted ──approve──> approved ──publish──> published
  ▲                    │                      │                    │
  └────edit rejected<──┴──reject─────────────┘                    └──archive──> archived
```

- **Draft:** owner can edit fields and images.
- **Submitted:** immutable to owner; visible in admin review queue.
- **Rejected:** owner sees required notes, can edit, and resubmit. Old approval events remain immutable.
- **Approved:** moderation passed but not publicly visible. This separation supports scheduled/manual publication and a final admin check.
- **Published:** visible to anonymous users and public search/map queries.
- **Archived:** removed from public inventory but retained for audit and existing enquiries.

Submission, approval, rejection, publication, and archival are database functions, not arbitrary status updates. Every transition checks source state and role, stamps timestamps, and returns the updated row. Concurrent or repeated transitions fail cleanly.

The recommended published-edit strategy is **copy-on-revision**: keep the published row immutable, create a new draft linked by `revision_of`, review it, then atomically supersede the old published version. This prevents unreviewed edits from appearing publicly but adds schema and UI work; it requires approval before implementation.

## Image upload workflow

1. Owner creates a draft property and receives its UUID.
2. Client validates count, MIME type, and size, then requests upload through the authenticated Supabase client.
3. Storage RLS permits a unique object path only under the owner's/property's prefix.
4. After upload, a Server Action validates object metadata and inserts `property_images` metadata under database RLS.
5. Removal deletes metadata and object only while the property is editable.
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

## Environment and local development

Commit `.env.example` with names only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=
```

Only the first two values are browser-safe. `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_PASSWORD` are optional operational secrets for trusted scripts/CI and must never be imported by Client Components or exposed through Server Action responses. Add `server-only` guards to privileged modules. Existing `.env*` ignore rules remain; `.env.example` must be explicitly unignored.

Local development uses the Supabase CLI and a Docker-compatible runtime:

```text
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > src/types/database.generated.ts
npm run dev
```

Commit `supabase/config.toml`, timestamped migrations, seed data, database tests, and generated TypeScript types. Ignore `supabase/.temp/` and `supabase/.branches/`. Use explicit `--local` or `--linked` flags for potentially ambiguous CLI commands. Never run destructive `db reset --linked` against production.

## Migrations and seed strategy

Use forward-only reviewed SQL migrations:

1. Extensions, enums, tables, constraints, indexes, update triggers.
2. Profile creation, role helpers, and grants.
3. RLS policies and lifecycle functions.
4. Storage bucket and object policies.
5. Seed fixtures for local Auth users and the nine Nagpur properties/images metadata.

The nine project-owned WebP files stay in `public/` for the Stage 2 baseline and tests. Local seed setup uploads/copies equivalent fixtures into Storage through a repeatable seed script; production seed data is applied only when explicitly approved. Every migration must replay from empty state with `npx supabase db reset` and generated types must match the resulting schema.

## Testing and security verification

### Database tests

Use pgTAP under `supabase/tests/` to verify:

- RLS is enabled on every exposed table.
- Anonymous users see published properties only.
- Users cannot create listings or change roles.
- Owners can mutate only their own editable listings and image paths.
- Submitted/published listings cannot be altered by owners.
- Admin transitions create immutable approval history.
- Enquiry sender/owner/admin visibility is correct.
- Storage policies reject cross-owner paths and unpublished unauthorized reads.
- Invalid transitions and concurrent/repeated approvals fail.

Run with `npx supabase test db` against the local stack.

### Application tests

- Mapper tests cover every enum and missing-image defense.
- Repository tests cover success, empty result, error propagation, and stable ordering.
- Server Action tests cover validation, unauthenticated, wrong-role, RLS rejection, and success.
- Existing 50 Stage 2 tests remain green with repository data.
- Page tests distinguish route loading, database failure, no published inventory, filter empty, and map-bounds empty.
- Browser tests cover sign-up/login/logout, owner draft/upload/submit, admin approve/publish, and public listing/map appearance.

### CI and deployment gates

Run:

```text
npm ci
npx supabase start
npx supabase db reset
npx supabase test db
npm test
npm run lint
npm run typecheck
npm run build
```

Add secret scanning, migration linting, generated-type drift detection, and a check that service-role identifiers do not appear in client bundles/source imports. Apply migrations to a staging Supabase project before production. Back up production, verify migration history, deploy schema before application code when backward compatible, smoke-test public and role workflows, and document rollback as a forward corrective migration rather than rewriting applied migrations.

## Incremental delivery strategy

1. **Foundation:** CLI config, schema, migrations, generated types, seed data, pgTAP. No runtime UI change.
2. **Read path:** server repository and `PropertyExplorer` extraction behind a temporary data-source flag; preserve Stage 2 behavior and compare mock/live output.
3. **Auth/profile:** cookie SSR clients, Proxy refresh, login/recovery, profile bootstrap, protected route shell.
4. **Owner management:** dashboard, draft create/edit, private image upload, validation, submission.
5. **Admin moderation:** review queue, approval/rejection/publish functions, audit history.
6. **Enquiries:** authenticated lead submission and owner/admin inbox.
7. **Cutover/hardening:** default to Supabase, remove production mock fallback, run security/browser/performance verification, stage deployment.

Each slice is independently testable and committed separately. The Stage 2 public page remains runnable throughout; the data-source switch occurs only after live data parity tests pass.

## Decisions requiring approval before implementation

1. **Owner onboarding:** recommended admin approval before changing `user` to `owner_agent`; alternative is self-service owner registration with later verification.
2. **Authentication methods:** recommended verified email/password plus recovery for Stage 3; decide whether Google OAuth is required now.
3. **Guest enquiries:** recommended authenticated-only initially; enabling guests requires CAPTCHA, rate limiting, retention, and consent copy.
4. **Published edits:** recommended copy-on-revision; simpler alternative unpublishes the listing during edits, while direct edits are not recommended.
5. **Approval versus publication:** recommended separate `approved` and `published` states; decide whether approval should publish immediately.
6. **Image privacy:** recommended private bucket with short-lived signed URLs; public bucket is simpler but can expose unapproved images to anyone with a URL.
7. **Admin security:** decide whether MFA is mandatory at launch and which account creates the first admin.
8. **Deployment topology:** identify Supabase development, staging, and production projects and the hosting provider that will receive environment variables.
9. **Data retention:** define retention/deletion periods for rejected drafts, archived listings, images, profiles, and enquiries.
10. **Seed publication:** confirm whether the nine illustrative Nagpur properties should appear in production or remain local/staging fixtures only.

## Acceptance criteria

1. Public listings are read from Supabase and still satisfy the current `Property[]` UI contract.
2. Stage 2 filters, 30/70 layout, three-column results, markers, clusters, previews, map-bounds behavior, and mobile toggle remain unchanged.
3. RLS is enabled and tested for every exposed table and Storage object operation.
4. No service-role or database secret reaches browser code, logs, screenshots, or committed files.
5. Owners can manage only their listings and cannot bypass moderation; admins have auditable transition controls.
6. Only published listings appear to anonymous users.
7. Database loading, error, inventory-empty, filter-empty, and map-empty states are distinct and accessible.
8. Migrations recreate the local environment, generated types are current, and database/application/browser/security checks pass.
9. Deployment uses staging verification and forward-only migration discipline.

## Explicit non-goals

- Payments, subscriptions, paid boosts, or invoicing.
- Chat, push notifications, saved-search alerts, or persistent favorites.
- Automated identity/KYC, RERA verification, image moderation, or fraud scoring.
- Multi-city search, geocoding, routing, or replacing OpenStreetMap.
- Direct public access to service-role credentials or disabling RLS for convenience.
