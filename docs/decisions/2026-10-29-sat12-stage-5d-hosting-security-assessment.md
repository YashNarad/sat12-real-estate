# SAT12 Stage 5D — Hosting and Security Provider Assessment

Status: **Conditionally approved architecture; implementation, provisioning, deployment, and activation remain unapproved**
Date: 2026-10-29
Baseline: `codex/sat12-stage-3` at `c22e9bbda446194e00d3dba163206992bca427e4`

## Executive recommendation

For SAT12's requested balance, with a slight preference for lower implementation and operational complexity, the conditionally approved primary architecture is:

**Vercel Pro, with the application functions pinned to Mumbai (`bom1`), plus an Upstash Redis database whose primary region is Mumbai (`ap-south-1`).**

This approval covers architecture and local planning only. It does not approve accounts, subscriptions, credentials, provider connections, integration, deployment, or activation. This is the least-complex candidate that can meet the mandatory controls, subject to the validation gates below. Vercel is the native Next.js path, documents spoof-resistant client-IP headers for direct Vercel traffic, automatically coordinates Server Action encryption, and offers Mumbai compute. Upstash offers a Mumbai primary region and Redis scripting suitable for one atomic check-and-consume operation across both rate-limit windows.

The conditionally approved fallback architecture is:

**A conventional Node.js deployment on Render in Singapore, plus Upstash Redis in Singapore, using `next build`/`next start`.**

The fallback preserves the real Next.js Node runtime and gives more runtime control, but it has more operational work, no India compute region, and its trusted-client-IP contract must be obtained from Render and verified before use. If in-country processing becomes mandatory, replace Render with a conventional Node.js deployment on an approved India-region cloud; that variant requires a separate assessment because its load balancer, cache coordination, secrets, monitoring, and cost profile are materially different.

Cloudflare Workers with vinext and Durable Objects is not recommended as the first production deployment today. It is attractive on price and its Durable Object model can atomically enforce both windows, but Cloudflare's recommended Next.js path uses the beta vinext compatibility layer, which reimplements the Next.js API surface. India-specific Durable Object placement is also not guaranteed by the currently documented jurisdiction controls.

## 1. Current SAT12 requirements

Repository inspection establishes these requirements:

- Next.js `16.4.1`, React `19.3`, App Router, Server Components, Server Actions, streaming, `headers()` and `cookies()`.
- Server-side Supabase SSR clients and authenticated Server Actions.
- The Stage 5C enquiry boundary already exposes provider-independent ports for trusted client-IP resolution, privacy-safe HMAC key derivation, atomic distributed rate limiting, and allowlisted metrics.
- Two limits must be consumed together atomically: 5 attempts per 10 minutes and 20 attempts per hour.
- Missing IP trust, key derivation, limiter availability, or ambiguous limiter results must fail closed before the Supabase RPC.
- Attempts are not refunded after validation, duplicate, or RPC failure.
- The database email throttle remains defense in depth.
- Both application and database enquiry activation gates remain disabled.

Next.js documents that a native Node.js `next start` process supports Server Actions and the full framework feature set. For multi-instance self-hosting it additionally requires a consistent `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, consistent build identity, and coordinated cache/tag invalidation. Vercel handles Server Action encryption automatically; self-hosted and adapter deployments must prove it explicitly. See [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting) and [deployment platform guidance](https://nextjs.org/docs/app/guides/deploying-to-platforms).

## 2. Hosting comparison

| Area | Vercel Pro | Cloudflare Workers + vinext | Conventional Node.js on Render |
|---|---|---|---|
| Next.js 16.4.1 | **Best fit.** Native, zero-configuration Next.js platform and full Server Actions support. | **Plausible, not yet proven for SAT12.** Cloudflare recommends vinext for existing Next.js 16 apps; Server Actions are listed as supported, but vinext is beta and `next/*` support is only described as mostly supported. | **Strong fit.** Render documents full Next.js apps as Node web services using normal build/start commands. Native `next start` avoids an API reimplementation. |
| Implementation effort | Low | Medium-high: compatibility scan, adapter configuration, regression work, and platform-specific deployment tests. | Medium: service configuration, multi-instance Next settings, health checks, proxy/IP adapter, cache coordination, and observability. |
| Server Action encryption | Vercel documents automatic handling. Rotation and deployment behavior still require an operational runbook. | Must be verified with vinext and rolling deployments. Do not assume Vercel's automatic behavior carries over. | Set a base64 AES-length `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build and runtime for every instance; rotate through a coordinated rebuild/redeploy. |
| Trusted client IP | Direct Vercel deployments can use `x-vercel-forwarded-for`; Vercel says it remains reliable when another proxy is in front, while ordinary XFF may be overwritten. Custom trusted proxy support is Enterprise. | Use `CF-Connecting-IP` only for the documented direct request topology. Same-zone Worker subrequests can alter the value through `x-real-ip`, so the resolver must reject unapproved topologies. | **Unverified blocker.** Render's public documentation reviewed here does not establish a sufficiently precise spoof-resistance contract for inbound client-IP headers. Obtain written documentation/support confirmation and run direct-origin/spoof tests before launch. |
| India location | Functions can run in Mumbai (`bom1`). This does not by itself localize logs, control-plane data, build artifacts, or every subprocess. | Global edge presence includes India, but Durable Objects only document `us`, `eu`, and `fedramp` jurisdictions; APAC hints are best-effort, not India guarantees. | Render offers Singapore but not India. This is cross-border processing. |
| Scaling | Managed function scaling; low operator burden. | Global Workers scaling; Durable Object per HMAC key provides a coordination point. | Horizontal scaling is available on paid workspace tiers; operator owns Next multi-instance correctness. |
| Operational control | Lowest | Medium; strong platform primitives but adapter/runtime constraints. | Highest of the three, with correspondingly greater responsibility. |
| Main risk | Vendor dependence and incomplete India-wide data residency without contractual validation. | Beta Next compatibility layer and no guaranteed India Durable Object jurisdiction. | Trusted-IP contract, multi-instance cache/version coordination, and Singapore-only regional processing. |

Official references: [Vercel Next.js support](https://vercel.com/docs/frameworks/full-stack/nextjs), [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Vercel function pricing/regions](https://vercel.com/docs/functions/usage-and-pricing), [Cloudflare Next.js/vinext status](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/), [Render Next.js deployment](https://render.com/docs/deploy-nextjs-app), and [Render regions](https://render.com/docs/regions).

## 3. Distributed rate-limiter comparison

### Upstash Redis — recommended with Vercel

Implement one server-side Lua script invoked with `EVAL`/`EVALSHA`. The script must, in one atomic execution:

1. Read both HMAC-derived counters.
2. Reject without incrementing if either limit is already exhausted.
3. Otherwise increment both counters and set/retain the correct expiries.
4. Return a versioned, unambiguous decision containing only allow/deny and retry metadata.

Upstash documents that pipelines are not atomic and Lua scripts execute atomically. Provider integration tests must prove concurrent requests cannot exceed either window and that both counters advance together. The application must time out quickly and fail closed on connection, script, parse, or ambiguity errors. Only HMAC-derived opaque keys leave SAT12; raw IPs do not.

Mumbai (`ap-south-1`) is an available primary region. A single-region primary minimizes cross-border limiter data, but Upstash control-plane, telemetry, support, backups/replicas, and subprocessors still require DPA review. The application must verify whether the selected plan provides the required availability and support; an SLA/HA add-on materially changes cost.

### Cloudflare Durable Objects — technically strong, coupled to Cloudflare hosting

Route each privacy-safe HMAC key to one Durable Object. The object's single-threaded execution plus strongly consistent transactional storage can check and consume both windows atomically. Deterministic concurrency, restart, eviction, timeout, and ambiguous-response tests remain mandatory.

This avoids a separate Redis provider and is inexpensive at small scale, but it couples rate limiting to the Cloudflare adapter decision. Durable Object location hints are not guarantees, and the documented jurisdiction restrictions do not include India. Logs can also exist outside a selected jurisdiction. These facts prevent claiming Indian data residency.

### Conventional managed Redis — fallback

For Render, use a Redis-compatible service in the same region and the same one-script atomic algorithm. Upstash Singapore is the simpler cross-platform choice. Render Key Value could reduce network surface through private networking, but its scripting semantics, persistence/HA tier, and exact production price must be validated before selection. Do not use process memory or independent per-window commands.

## 4. Cost scenarios

All figures are USD/month before taxes, domain registration, Supabase charges, support, security review, and optional monitoring. Verified list prices are separated from planning estimates.

| Candidate | Verified current price elements | Small-project planning scenario | Important caveat |
|---|---|---|---|
| Vercel Pro + Upstash | Vercel Pro is $20/month for one deploying seat and includes $20 usage credit. Upstash PAYG is $0.20/100k commands; its fixed entry plan is $10/month. | **About $20–30/month** at low traffic if Vercel usage stays within credit and Upstash is PAYG/fixed. | Upstash's production SLA/HA Prod Pack is listed at +$200/database/month. Decide whether launch can accept the base plan's support/availability or budget for the add-on. |
| Cloudflare Workers + Durable Objects | Workers Paid has a $5/month minimum and includes Workers/Durable Object usage allocations. | **About $5–15/month** at small traffic is a planning estimate. | Compatibility engineering and data-localization products can dominate the apparent savings; validate DO usage calculations and any paid localization features. |
| Render Node + managed limiter | Render Pro workspace is $25/month plus compute; Hobby is $0 plus compute. Exact current compute and Key Value charges must be confirmed in the deployment quote. | **About $15–40/month on Hobby plus compute/limiter**, or **$40–70/month with Pro workspace** is an estimate, not a verified quote. | Singapore processing, horizontal-scaling requirements, and external limiter/network cost remain. |

At 10,000 rate-limit attempts/month, one atomic Upstash script per attempt is roughly 10,000 billable commands; at the published PAYG rate the command component is about $0.02. This is an estimate and excludes storage, bandwidth, retries, monitoring, and any HA/SLA plan. Sources: [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Upstash Redis pricing](https://upstash.com/pricing/redis), [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), and [Render pricing](https://render.com/pricing).

## 5. Trusted-IP security boundary

The production `TrustedClientIpResolver` must be a host-specific adapter, not a generic XFF parser.

For the primary candidate, the documented contract as of 2026-10-29 is:

- Vercel sets `x-forwarded-for` to the public client IP and states that it overwrites an incoming value to prevent spoofing on direct Vercel deployments.
- Vercel states that `x-vercel-forwarded-for` is identical to `x-forwarded-for`, but remains the Vercel-derived value when an upstream proxy could overwrite ordinary `x-forwarded-for`.
- SAT12 will accept only `x-vercel-forwarded-for`, only when an explicit server-only deployment marker identifies the approved Vercel production environment. Header presence alone is never sufficient trust.
- The resolver will accept exactly one syntactically valid IPv4 or IPv6 address and reject missing, comma-separated/multi-hop, malformed, zone-qualified, private, loopback, link-local, documentation, multicast, unspecified, or otherwise non-public values.
- If Cloudflare or another proxy is placed before Vercel, the trust model must be re-approved and retested; Vercel's custom trusted proxy is an Enterprise feature.

Required hosted spoofing tests must send conflicting and attacker-controlled `Forwarded`, `x-forwarded-for`, `x-vercel-forwarded-for`, and `x-real-ip` values through both the production custom domain and any directly reachable deployment URL. Tests must prove that: the platform overwrites attacker values; a request cannot choose another rate-limit subject; multi-value input fails closed; IPv4/IPv6 normalization is stable; direct-origin/proxy bypass does not create a second identity; preview and non-Vercel runtimes remain unconfigured; and the resolver produces no raw-IP logs. These hosted tests cannot be completed locally and are an activation blocker.

For Cloudflare, accept `CF-Connecting-IP` only in the approved direct Worker topology and explicitly account for same-zone subrequests. For Render, leave the resolver unconfigured until Render supplies an authoritative header/overwrite contract and direct-origin access is prevented or incorporated into the trust model.

## 6. Secrets and rotation

Required secrets include the Supabase server credentials already used by SAT12, the rate-limit HMAC secret, limiter credentials, metrics sink credentials, and—outside Vercel—`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

- Store secrets only in the platform's encrypted secret manager/environment controls; never expose them as `NEXT_PUBLIC_*`.
- Separate production, preview, and development values.
- Restrict provider access with least privilege and separate limiter databases/namespaces by environment.
- Rotation must be a documented, tested deployment: rotate limiter credentials without bypassing fail-closed behavior; rotate the HMAC key with a defined cutover impact; rotate Server Action encryption through one coordinated build/deploy across all instances.
- A key rotation that makes the limiter uncertain must deny enquiries, not fall back to memory or the database RPC alone.
- Enable spend caps/alerts where supported, but treat budget exhaustion as limiter unavailability and fail closed.

Proposed rotation procedure (no values are created by this decision):

1. Create a replacement credential/key in the approved secret manager and record only its version identifier in the change ticket.
2. For Upstash credentials, keep the previous credential valid, deploy the replacement to a non-production environment, run atomicity/outage tests, deploy production, verify privacy-safe health metrics, and only then revoke the previous credential.
3. For the HMAC key, use an explicit key-version prefix in limiter keys. A rotation intentionally starts fresh counters, so keep both enquiry gates disabled during cutover unless a separately reviewed dual-key design preserves the old counters. Do not try both keys or merge counters ad hoc.
4. Vercel automatically manages Server Action encryption. Do not add an application-managed `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to the primary architecture unless Vercel support requires it. For the Render fallback, generate one valid base64 AES key, make it available at build and runtime to every instance, and rotate it only through a coordinated build/deploy that prevents mixed-key instances.
5. Environment-variable changes apply only to new Vercel deployments. Disable access to superseded deployment URLs or accept that old deployments fail closed after old credentials are revoked.
6. On any uncertain cutover, keep enquiry gates disabled or disable them; never fall back to an in-memory limiter.

## 7. Privacy-safe monitoring and operations

Use only the Stage 5C allowlisted metrics events. Record event type, coarse outcome/reason, environment, provider adapter version, duration bucket, and coarse region if approved. Never record raw IPs, HMAC keys, buyer names/emails/phones/messages, form payloads, Supabase responses containing personal data, or recipient identities.

Alerts should cover:

- resolver failures or malformed trusted headers;
- limiter timeouts, unavailable/ambiguous decisions, and script-version mismatches;
- deny-rate spikes by coarse aggregate, without exposing keys;
- Server Action decryption/version-skew failures;
- enquiry RPC errors after an allowed limiter decision;
- secret expiry/rotation and cost-budget thresholds.

Runbooks must define fail-closed incident response, recovery validation, provider outage communication, secret compromise, rollback, and evidence retention. The previously proposed 12-month closed-enquiry anonymization is still pending privacy review and is not approved here.

## 8. India residency and cross-border processing

Buyer contact details, IP-derived rate-limit identifiers, logs, and support data are personal-data concerns. India's DPDP Act section 16 permits the Central Government to restrict transfers to notified countries/territories, and other laws can impose stricter rules. The 2025 Rules have phased commencement. This document is an engineering assessment, not legal advice; obtain India-focused privacy counsel before launch. Sources: [DPDP Act, 2023](https://www.indiacode.nic.in/bitstream/123456789/22037/1/a2023-22.pdf) and [DPDP Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025).

The recommended Mumbai Vercel function and Mumbai Upstash primary reduce data-plane transfers, but do **not** establish complete Indian residency. Before approval, inventory and contractually validate:

- the actual Supabase project region and its Auth, database, Storage, backup, log, and support locations;
- Vercel build, runtime, log, analytics, support, and control-plane processing/subprocessors;
- Upstash primary, replicas/backups, telemetry, support, and control-plane processing/subprocessors;
- the metrics/alerting provider and incident-support access;
- retention, deletion, data-subject request, breach, and cross-border transfer procedures.

Render's nearest available region is Singapore, so it is explicitly cross-border. Cloudflare's APAC location hint is not an India guarantee, and documented Durable Object jurisdictions omit India. Vercel's DPA also places responsibility on the customer to determine legal suitability. See [Vercel DPA](https://vercel.com/legal/dpa), [Cloudflare Durable Object data location](https://developers.cloudflare.com/durable-objects/reference/data-location/), and [Upstash regions](https://upstash.com/docs/redis/features/globaldatabase).

## 9. Mandatory validation gates before implementation or activation

No candidate is acceptable until all applicable gates pass:

1. Run the SAT12 full suite and a production build on the exact target runtime.
2. Prove Server Actions through rolling/multi-instance deployments, including stable encryption, build/version skew, cache invalidation, and form replay behavior.
3. Prove trusted-IP spoof resistance on the real custom-domain/proxy topology.
4. Prove atomic two-window consumption under high concurrency and provider retries; test exhaustion, timeout, malformed response, ambiguous completion, and outage fail-closed behavior.
5. Verify secrets are scoped, encrypted, auditable, and rotatable; perform a staged rotation drill.
6. Verify metrics emit only allowlisted fields, and that metrics failure cannot bypass a denial.
7. Complete provider DPA/subprocessor/data-location review and confirm the Supabase project region.
8. Set budgets and alerts, then verify budget exhaustion fails closed.
9. Keep both enquiry gates disabled through deployment validation. Enabling each gate requires a separate, explicit change and approval.

## 10. Refined cost model

Costs below remain planning figures, not quotes. Taxes, currency conversion, and India GST treatment require billing confirmation.

| Cost center | Low-volume expectation | Verification status |
|---|---:|---|
| Vercel Pro hosting | $20/month platform fee for one deploying seat, including $20 usage credit; Mumbai compute overage is usage-based | Published pricing verified; actual SAT12 CPU, memory, transfer, image optimization, and build usage unknown |
| Upstash Redis | PAYG at $0.20/100k commands, or $10/month entry fixed plan | Published pricing verified; one Lua execution is expected per attempt, but exact billing and production traffic require measurement |
| Upstash availability | Optional Prod Pack listed at +$200/database/month | Published pricing verified; whether SAT12 requires its SLA/multi-zone guarantees is unresolved |
| Supabase | Existing project cost continues independently | Current plan, region, egress, and growth cost were not inspected and must be supplied separately |
| Monitoring/alerting | $0 if existing approved tooling has capacity; otherwise unknown | No provider selected; retention and region materially affect price |
| Domain/DNS | Existing or separately billed | Not assessed |
| Taxes/currency | Additional | Quote and invoice validation required |

The practical low-volume baseline is approximately **$20–30/month plus existing Supabase, monitoring, domain, taxes, and any overages**. Selecting Upstash Prod Pack changes the baseline to roughly **$220–230/month plus the excluded items**. These figures do not price engineering, legal review, incident response, or support time.

## 11. Remaining decisions requiring approval

Before any integration work, the owner must approve:

1. **Availability tier:** Upstash PAYG/fixed without a contractual SLA versus the Prod Pack/Enterprise availability commitment.
2. **Hosting topology:** direct Vercel custom domain versus any additional proxy/CDN; adding a proxy reopens the trusted-IP decision.
3. **Data location:** whether Mumbai data-plane placement with documented cross-border control-plane/log processing is acceptable; otherwise require an India-resident conventional deployment assessment.
4. **Budget:** baseline monthly budget and overage cap.
5. **Monitoring provider and retention:** including approved regions and strict field allowlist.
6. **Legal/privacy sign-off:** cross-border processing, notices/consent, retention/deletion, subprocessors, and incident obligations.

Until those decisions and validation gates are complete, the Stage 5C fail-closed defaults and both disabled submission gates must remain unchanged.
