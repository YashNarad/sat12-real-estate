# SAT12 Stage 5C enquiry abuse operations

## Current activation status

Both submission gates remain disabled. `SAT12_ENQUIRIES_ENABLED` is not enabled in the application runtime, and `app.settings.enquiry_submissions_enabled` is disabled or absent in PostgreSQL. The provider-independent code is intentionally unusable for production submissions until every integration requirement below is approved and verified.

## Hosting and trusted proxy boundary

SAT12 has no selected production host or trusted proxy. Shared code must not interpret `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, or a similarly named header as client identity. A hosting-specific `TrustedClientIpResolver` may be added only after its infrastructure contract documents:

- the proxy or load balancer that overwrites the trusted value;
- how direct requests that bypass the proxy are prevented;
- the accepted hop and forwarding format;
- IPv4 and IPv6 normalization;
- spoofing and malformed-header tests.

Until that adapter exists, identity resolution returns unavailable and enquiry submission fails closed.

## Distributed limiter acceptance criteria

The approved policy is five attempts per ten minutes and twenty attempts per hour for one opaque trusted-IP subject. A provider adapter must enforce both windows in one concurrency-safe atomic multi-window operation across every application instance. It may not check or increment the windows independently, partially consume a request, or treat a timeout as success.

Local deterministic concurrency tests verify that SAT12 issues one all-window operation per attempt. Actual atomicity requires a provider-specific integration test against the selected distributed backend under concurrent load, timeout, retry, and partial-failure conditions. No in-memory production fallback is permitted.

The application must derive the provider key with a purpose- and version-scoped HMAC. Production readiness requires an approved secret manager, separation from application logs, and a documented key rotation procedure that supports an overlap period without exposing the trusted IP or derived key.

## Failure behavior

Missing trusted-proxy configuration, missing key material, limiter unavailability, timeout, malformed response, or ambiguous consumption must fail closed before validation or Supabase persistence. The application must not automatically retry an ambiguous consume operation. Attempts are not refunded after validation failure, honeypot rejection, duplicate detection, database throttling, or RPC failure.

The database's normalized-email duplicate and hourly controls remain defense in depth and are not replaced by the distributed limiter.

## Privacy-safe observability

Operational telemetry uses an aggregate-only allowlisted event containing a schema version, fixed route name, policy version, coarse outcome, and coarse reason. Never log raw IP addresses, derived limiter keys, names, email addresses, phone numbers, property or user identifiers, buyer messages, form payloads, access tokens, or raw database errors.

Before activation, an approved metrics adapter and retention period must be configured. Alerts should cover:

- sustained limiter or trusted-identity unavailability;
- sudden changes in aggregate allowed or limited attempts;
- elevated generic submission failures;
- divergence between aggregate limiter allowances and stored enquiry counts.

Metrics failures are observational: they cannot convert a denied request into an allowed request or bypass any security decision.

## Incident and abuse response

The on-call runbook must identify owners and escalation channels. During a limiter outage or suspected bypass, operators deactivate either submission gate, preserve aggregate evidence, rotate affected provider credentials or HMAC keys, and validate fail-closed behavior before restoration. Routine abuse investigation must not inspect buyer messages.

No automatic retry, emergency in-memory limiter, or manual direct-table insertion is an approved workaround.

## Retention and deletion requests

Distributed counters should retain only opaque keys for the active windows plus the provider's minimum cleanup margin. Metrics retention requires separate privacy approval and should contain aggregate events only.

A buyer deletion request requires an authenticated operator procedure that verifies the requester, locates data through authorized tooling, checks legal holds, records the action, performs approved downstream deletion, and independently verifies completion. That procedure and its audit fields require separate review before activation.

The twelve-month closed-enquiry anonymization proposal remains pending privacy and legal review. It is not implemented, scheduled, or approved by Stage 5C.

## Activation checklist

Buyer submissions remain blocked until all of the following are separately approved and verified:

1. production host and trusted proxy configuration;
2. spoof-resistant trusted-IP adapter;
3. secret manager and HMAC key rotation procedure;
4. distributed provider with atomic multi-window support;
5. provider-specific concurrency and outage integration tests;
6. privacy-reviewed aggregate metrics, retention, and alerts;
7. incident, deletion-request, and key-rotation runbooks;
8. deployment verification of application and database fail-closed states;
9. separate authorization to enable each submission gate.

## Stage 5E provider preparation

The conditionally approved primary architecture is Vercel Pro in Mumbai with Upstash Redis in Mumbai. Local provider adapters and the still-unexecuted hosted security procedure are documented in [`stage5e-vercel-upstash-validation.md`](./stage5e-vercel-upstash-validation.md).

This preparation does not authorize provider accounts, credentials, connections, deployment, or activation. Hosted trusted-header spoofing, atomic Lua concurrency, ambiguous timeout, rotation, rollback, monitoring, availability-tier, India/cross-border, and legal/privacy checks remain activation blockers.
