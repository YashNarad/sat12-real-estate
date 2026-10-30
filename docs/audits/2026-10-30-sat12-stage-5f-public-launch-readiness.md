# SAT12 Stage 5F Public Launch Readiness Audit

**Audit date:** 2026-10-30

**Branch:** `codex/sat12-stage-3`

**Audited commit:** `767cb41b6a382ec2d078120c046f1c84c448d810`

**Scope:** Local repository inspection and local verification only. No provider, Supabase Cloud, deployment, migration, or activation operation was performed.

## Executive verdict

SAT12 is **not ready for an unrestricted public launch today**. The core property catalogue, published-property details, authentication, owner/agent workspace, image workflow, and AAL2-protected administration are substantially implemented and locally tested. The approved first release is now a deliberately narrow **browse-only Nagpur catalogue MVP that also includes curated New Projects and Locations**. Those two public surfaces are launch requirements, not post-launch promises, and do not yet exist.

Buyer enquiry submission is not part of the currently launchable MVP. Its application and database gates must remain disabled until provider provisioning, trusted-IP validation, distributed-limiter integration testing, monitoring, privacy/legal review, and separate activation approvals are complete.

The audit found no failing local application check. The primary blockers are production environment and operational readiness, legal/privacy content, misleading or incomplete public controls, SEO/discovery essentials, hosted security validation, production data separation, and absent end-to-end launch rehearsal.

## Evidence and limitations

Fresh local evidence gathered for this audit:

- `npm test`: 491/491 passed across 88 files.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; 20 routes/pages were generated or validated by Next.js.
- `npm audit --omit=dev`: zero vulnerabilities.
- Full `npm audit`: one high-severity development-only `undici@7.30.0` finding through `jsdom@29.1.1`.
- Nine local Supabase migrations and six transactional pgTAP suites are present. The test plans total 182 assertions; cloud execution history was not rechecked because this audit prohibited remote operations.
- No Playwright/Cypress suite, automated accessibility scanner, Lighthouse budget, sitemap, robots file, web manifest, public privacy page, or public terms page was found.

This is a repository audit, not a live production assessment. Current provider pricing/capabilities, Hostinger runtime behavior, DNS/TLS, email delivery, production Supabase state, production content, and hosted proxy behavior remain unverified.

## Route and feature inventory

| Surface | Local status | Evidence and remaining concern |
|---|---|---|
| `/` property search | Implemented and tested | Published Supabase inventory, live client-side filters, sort, grid/list, map clustering, map-to-card focus, loading/empty/error states. The visible Search button submits to a no-op handler because filters already apply live; this is confusing. |
| `/properties/[propertyId]` | Implemented and tested | Published/non-archived exact revision only, signed ordered gallery, map, facts, canonical metadata, and 404 protection. Enquiry form is honestly disabled. |
| Authentication routes | Implemented and unit-tested | Signup, login, logout, callback, recovery/reset, TOTP enrolment/challenge, safe return paths, server-verified user/profile. Production SMTP, redirect allowlist, email delivery, recovery, MFA recovery, and disabled-user flows need hosted end-to-end verification. |
| `/dashboard` | Implemented and tested | Role-aware portal with responsive navigation, account identity, AAL display, and sign-out. |
| Owner property management | Implemented and tested | Draft creation/editing, lifecycle checks, image upload/deletion compensation, validation, and submission workflow. Needs production-like browser rehearsal against a non-production environment before launch. |
| Admin moderation | Implemented and tested | AAL2 queue, review, approve/reject, publish/archive, badge audit, and user role approval through audited RPCs. Needs hosted session-expiry and failure-path rehearsal. |
| Buyer enquiry inbox | Implemented but inactive | Owner-only inbox and status changes exist. Public submission gates are disabled, so no launch promise should imply active leads. |
| Buyer enquiry submission | Security implementation complete locally; operationally blocked | Database RPC/RLS and Stage 5E adapters exist, but hosted trusted-IP, atomic Redis, outage, monitoring, privacy, and activation checks are outstanding. |
| `/projects` and `/projects/[projectId]` | Required before launch; not implemented | No project schema, route, gallery, RLS, Storage policy, or moderation workflow exists. It requires a forward-only, separately deployed security migration and verified source content. |
| `/locations` and `/locations/[slug]` | Required before launch; not implemented | Existing listings contain owner-entered locality text and coordinates, but no curated location taxonomy, publication workflow, or locality route exists. Public statistics must be derived from current published inventory or omitted. |

## Essential MVP findings

### Complete enough to retain in the smallest MVP

- Public browsing of genuinely published, non-archived listings.
- Property details with ordered private-storage images delivered through signed URLs.
- Nagpur search/filtering, map/list interaction, sorting, and responsive layouts.
- Server-side role enforcement and authoritative profile lookup.
- Controlled owner/agent property management.
- AAL2-protected admin moderation and audited role/lifecycle operations.
- Safe generic error boundaries and missing/unauthorized 404 behavior.

### Incomplete, misleading, or untested

- `List Property` is a visible button with no action.
- `Saved` points to `#saved`, but favourites are in-memory only and no saved-listings section/account persistence exists.
- `Search Properties` invokes an empty callback even though filters update live.
- New Projects and Locations are currently disabled/coming soon but are approved launch requirements. They must become real, published-only destinations before appearing in primary navigation.
- Builders, Alerts, Saved Properties, and Insights remain deferred. They must be removed from launch navigation rather than presented as disabled promises. The project model may contain a reviewed `builder_name` text field, but this does not authorize builder profiles or a Builders route.
- No public Privacy, Terms, Contact, About, grievance/contact, or data-request pages exist.
- Enquiry copy states that retention terms are pending; therefore enquiries cannot be activated.
- No production-grade monitoring adapter, error tracking, alert routing, uptime check, or operational dashboard is configured.
- No browser end-to-end suite covers real navigation, session cookies, email callbacks, mobile layouts, MFA, Storage, or moderation across a deployed build.

## Content and data requiring replacement or review

- `src/data/properties.ts` contains nine illustrative demo listings. Code limits them to development when the published database is empty and visibly labels them as demo, but production configuration must be verified so this fallback cannot appear publicly.
- `public/images/properties/` and the placeholder artwork are illustrative assets, not verified listing photography.
- Every production listing must receive an editorial review for title, price unit, locality, coordinates, image rights, alt text, ownership/authority to list, publication state, and RERA claims/number.
- Every project must be sourced from an authorized owner/agent, reviewed by an AAL2 administrator, and published through an audited workflow. SAT12 must not invent project names, builder names, prices, availability, possession dates, MahaRERA registrations, images, or marketing claims.
- Location pages must use curated names and boundaries plus facts derived at request time from current published inventory. SAT12 must not publish invented average prices, growth rates, rankings, infrastructure claims, or locality statistics.
- Development Auth users, administrator/owner accounts, audit history, fixtures, and the development project must not be treated as production identities or production data.
- The existing development Supabase project must not become production merely by pointing the public domain at it. A separately approved production project/configuration, migration rehearsal, role bootstrap, backup plan, and least-privilege secrets are required.

## User experience, accessibility, performance, and SEO

### Mobile and accessibility

Positive repository evidence includes semantic headings, labelled forms, live regions, visible focus styles, keyboard gallery controls, responsive breakpoints, a mobile management menu, and loading/error states.

Launch gaps:

- No automated axe/pa11y scan or complete manual WCAG review.
- No documented keyboard-only, screen-reader, 200% zoom, high-contrast, reduced-motion, or touch-target acceptance run on the current build.
- Latest authenticated, moderation, enquiry, and property-detail surfaces lack recorded mobile browser acceptance evidence.
- Colour contrast and focus order must be measured rather than inferred from CSS.

### Performance

- The production build succeeds and `next/image` is used for public images.
- The homepage currently performs a property query followed by an image-metadata query and signed-URL creation per property. That N+1/signing pattern is acceptable only after a realistic inventory/load test establishes latency and Supabase/Storage cost bounds.
- Signed URL caching is process-local, so cache behavior differs across serverless/multi-instance deployments.
- The Leaflet/OpenStreetMap client bundle and tiles need mobile, slow-network, and failure testing.
- No Lighthouse/Web Vitals budgets, bundle budget, load test, or cold-start target exists.

### SEO and public trust

Implemented: root metadata, per-property title/description/canonical/Open Graph basics, semantic page content, and a favicon.

Missing before professional launch:

- `robots.txt` and dynamic/static sitemap.
- Absolute production `metadataBase` and verified canonical domain behavior.
- Property/listing structured data, organization/site identity, and social preview images.
- Search Console/Bing verification and an indexing plan.
- Public contact, privacy, terms, content accuracy, RERA, and grievance disclosures.
- A footer with organization identity and legal navigation.

## Security and privacy review

### Strong controls already present

- Supabase publishable credentials only in browser-safe configuration; privileged operations are server/database controlled.
- RLS/RPC-based authorization, immutable audit mechanisms, role separation, ownership checks, and recent AAL2 for sensitive admin actions.
- Private image bucket with signed delivery and published-revision checks.
- Safe return paths, HTTPS production-origin validation, generic error mapping, and fail-closed enquiry adapters.
- Stage 5E uses HMAC-derived opaque limiter keys and no in-memory production fallback.

### Launch blockers

- No application security-header policy was found: CSP, HSTS ownership decision, frame protection, MIME sniffing protection, referrer policy, and permissions policy require a reviewed hosting-aware configuration.
- No production secrets inventory, owner, rotation calendar, break-glass procedure, or tested restore process is configured.
- No production Supabase backup/PITR decision, restore rehearsal, audit-log review, or incident runbook has been executed.
- OpenStreetMap tile requests disclose visitor network metadata to a third party; the privacy notice and provider usage policy must cover this.
- Public signup/auth abuse controls, production email rate limits, CAPTCHA decision, SMTP reputation, and account-support/recovery procedures need approval and hosted tests.
- Legal/privacy review is required for Indian DPDP obligations, cross-border processing, subprocessors, retention/deletion, grievance handling, image/content rights, and RERA representation. This document is not legal advice.

## Stage 5E hosted work still required

1. Provision only after separate approval and keep both enquiry gates disabled.
2. Validate Vercel's trusted header contract through the custom domain and every direct deployment URL, including attacker-supplied conflicting headers and direct-origin bypass attempts.
3. Run real Upstash Lua tests for 25+ concurrent attempts, both exact boundaries, duplicate identifiers, independent subjects, expiry, malformed replies, credential revocation, outage, timeout, and late/ambiguous completion.
4. Prove one atomic EVAL enforces both windows; no pipeline or multi-command substitute is acceptable.
5. Confirm no retry/refund and fail-closed behavior after ambiguous completion.
6. Configure privacy-safe allowlisted metrics and prove a metrics outage cannot permit a request.
7. Test HMAC/Redis credential rotation, rolling deployment, rollback, and Server Action compatibility while gates remain disabled.
8. Complete availability-tier, cost-budget, DPA/subprocessor, India/cross-border, retention/deletion, and incident-response approvals.
9. Enable the application and database gates only through two separately reviewed changes after all evidence passes.

## Vercel and Hostinger portability

### Shared technical baseline

SAT12 requires a real Node.js runtime, not static export: Next.js 16.4.1 App Router, Server Components, Server Actions, Proxy, cookies, dynamic Supabase reads, image optimization, and server-side signing. Installed Next.js requires Node.js `>=20.9.0`. The repository has standard `npm run build` and `npm start` commands.

### Vercel

Vercel is the currently conditionally approved and locally prepared path. The Stage 5E factory recognizes only the Vercel production runtime and its approved header. Actual region availability, trusted-header overwrite semantics, direct URL behavior, Server Action rolling-deployment behavior, secrets, logging, and cost still require hosted verification.

### Hostinger managed Node.js

Compatibility is **unverified**. Before choosing it, obtain evidence for:

- Node.js 20.9+ selection, Next.js 16.4.1 support, build memory/time, `next start`, persistent process supervision, and zero-downtime deploy behavior;
- Server Actions, Proxy, streaming, cookies, request-body limits, dynamic routes, and Next image optimization/Sharp;
- custom-domain TLS, redirect behavior, environment-secret isolation/rotation, log access/retention, backups, regions, outbound Supabase/Upstash connectivity, and incident support;
- exact reverse-proxy chain, authoritative client-IP header, header overwrite/removal behavior, trusted-hop allowlisting, and whether the origin can be reached directly;
- multi-instance behavior, stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, deployment/version-skew strategy, cache sharing/invalidation, and asset retention across rolling releases.

The current Stage 5E dependency factory intentionally refuses non-Vercel environments. Hostinger cannot activate buyer enquiries until a separate hosting-specific trusted-IP resolver/factory integration is designed, tested, and approved.

### Hostinger VPS

A VPS can run the Node application if the runtime requirements are met, but SAT12 would own OS patching, firewalling, reverse proxy/TLS, process supervision, log rotation, monitoring, backups, deploy rollback, capacity, and trusted-proxy hardening. This is portable in principle, but materially higher operational risk and effort than a managed platform.

## Development-only undici advisory

`npm audit` reports `undici@7.30.0` through the development-only `jsdom@29.1.1` chain. `npm audit --omit=dev` reports zero production vulnerabilities, and Stage 5E did not introduce or change this package.

Safe remediation path:

1. Do not run `npm audit fix --force` and do not override `undici` blindly.
2. Track the upstream fixed `undici` range and compatible `jsdom`/Vitest release.
3. Test the smallest direct `jsdom` patch/minor update in an isolated dependency-security branch.
4. Inspect the lockfile to confirm only the intended dev chain changed.
5. Run all 491+ tests, lint, TypeScript, build, production audit, and full audit.
6. Until fixed, keep CI/test runners patched and isolated from untrusted network/content; do not expose the test toolchain as a service.

## Launch blockers versus optional improvements

### Critical blockers

1. Choose and validate hosting; establish the trusted-proxy/IP contract for that exact topology.
2. Establish a separate production Supabase project/data/security baseline, backups, restore plan, and production Auth/email configuration.
3. Add and review public Privacy, Terms, Contact/grievance, retention/deletion, content/RERA, and third-party map disclosures.
4. Remove or correct misleading public controls (`List Property`, `Saved`, no-op Search) and decide whether public signup is in the MVP.
5. Add production security headers, secrets/rotation ownership, monitoring, alerting, uptime checks, and incident/rollback runbooks.
6. Implement and security-test the approved New Projects lifecycle, gallery, moderation, and published-only public routes.
7. Implement and security-test the curated Locations taxonomy and published-only locality pages without fabricated statistics.
8. Add sitemap/robots, canonical-domain configuration, structured metadata, and production content review for properties, projects, and locations.
9. Run deployed end-to-end, accessibility, mobile, performance, auth-email, Storage, moderation, and recovery acceptance tests.
10. Keep enquiries disabled unless every Stage 5E hosted and legal gate passes.

### Optional post-launch improvements

- Persistent saved properties and alerts.
- Full builder profiles/directory and Insights.
- Friendly property slugs while retaining stable IDs.
- Advanced geospatial/full-text search and pagination.
- Buyer enquiry activation after the separate security programme.
- Analytics/experimentation only after privacy approval.
- Image transformations, CDN tuning, and richer social previews.

## Recommended smallest safe MVP

Launch SAT12 first as a **curated Nagpur property, project, and locality catalogue**:

- public published-property search, filters, map, details, and galleries;
- public New Projects index/detail pages backed only by exact published project revisions and reviewed ordered galleries;
- public Locations index/detail pages backed by a curated published taxonomy and current published inventory, with honest empty states instead of invented statistics;
- private owner/agent listing management for pre-approved accounts;
- private owner/agent project drafting and submission for pre-approved accounts;
- private AAL2 admin moderation, publication, archival, location curation, and role approval;
- production contact/legal pages and a support channel;
- no buyer enquiry submission, saved properties, alerts, Insights, full builder profiles, or roadmap navigation promises;
- controlled owner onboarding rather than unreviewed public capability escalation.

This scope provides a credible public catalogue while avoiding premature handling of buyer contact data. It is larger than the original property-only audit recommendation and therefore adds one forward-only database/security programme, one private project-gallery programme, and one curated location-publishing workflow before launch.
