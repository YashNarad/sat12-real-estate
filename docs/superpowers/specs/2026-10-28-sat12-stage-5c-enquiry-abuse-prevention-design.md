# SAT12 Stage 5C Enquiry Abuse Prevention Design

## Scope

Stage 5C adds provider-independent abuse-prevention contracts at the public enquiry server-action boundary. It does not choose or provision a hosting platform, trusted proxy, distributed rate-limit provider, or secret manager. Both enquiry activation gates remain disabled, and the existing PostgreSQL normalized-email throttle, duplicate detection, honeypot, validation, and RPC authorization remain unchanged.

## Security objectives

- Deny enquiry submissions unless SAT12 can establish a trusted client-network identity and atomically enforce every configured distributed limit.
- Never trust `X-Forwarded-For`, `Forwarded`, `X-Real-IP`, or similar caller-controlled headers without a hosting-specific trusted-proxy adapter.
- Never fall back to process memory in production.
- Count attempts before payload validation where the server-action framework provides the request context, so malformed submissions cannot bypass the network-level control.
- Return indistinguishable, privacy-safe unavailability responses for missing configuration, identity resolution failure, limiter failure, and ambiguous limiter outcomes.
- Never log raw IP addresses, derived limiter keys, buyer contact details, enquiry messages, or form payloads.

## Architecture

### Trusted client identity

`TrustedClientIpResolver` is an asynchronous port that resolves a normalized IP address only from hosting information whose trust boundary is documented by a future adapter. Its result is a discriminated union: trusted identity, unavailable, or invalid. The default production resolver is intentionally unconfigured and always returns unavailable. It never parses request headers.

A hosting adapter must document which proxy sets the identity, how direct client access is prevented, how multi-hop forwarding is normalized, and which IPv4/IPv6 formats are accepted. Header parsing cannot be added to shared code merely because a header is present.

### Privacy-safe key derivation

`RateLimitKeyDeriver` converts a trusted normalized IP into an opaque key using a keyed one-way construction such as HMAC-SHA-256 with a purpose/version prefix. The current implementation is intentionally unavailable because no secret manager or rotation process has been approved. A future adapter must support key rotation without emitting either the source IP or derived key.

### Atomic distributed limiting

`DistributedRateLimiter` accepts one request containing an opaque subject key and the complete policy:

- five attempts per ten minutes;
- twenty attempts per hour.

The adapter returns allowed, limited, or unavailable. Its contract requires a single atomic operation across all application instances: either all windows are checked and consumed together or none are consumed. An adapter must not independently increment windows in a way that permits partial consumption or concurrency bypass. Unknown, timed-out, malformed, or partially successful responses are unavailable and fail closed.

The production default is an unavailable adapter. No in-memory fallback exists.

### Submission flow

The server action follows this order:

1. Check the existing application activation gate. When disabled, return the existing unavailable response without contacting a limiter or Supabase.
2. Resolve trusted client identity.
3. Derive the opaque rate-limit subject.
4. Atomically consume both distributed limits.
5. If limited, unavailable, invalid, or ambiguous, return a generic safe denial and do not call Supabase.
6. Parse and validate the form, including the honeypot and payload limits.
7. Invoke the existing enquiry service and guarded `submit_property_enquiry` RPC.

This ordering counts invalid attempts where request context is available while preserving the disabled feature's fail-closed behavior. PostgreSQL remains responsible for published-property eligibility, normalized-email duplicate prevention, the three-per-hour email limit, recipient derivation, and persistence authorization.

## Error and response model

The public response distinguishes ordinary validation errors only after the distributed limiter allows the attempt. Abuse-protection configuration failures and backend outages use a generic temporary-unavailability message stating that no success was assumed. Rate-limit exhaustion uses a generic retry-later message. Neither response identifies a property owner, account, email, IP, policy counter, or recipient.

No automatic retry occurs after an ambiguous limiter result.

## Metrics and logging

The enforcement boundary emits a structured event through a provider-independent `EnquiryAbuseMetrics` port. Allowed fields are:

- fixed event name and schema version;
- route identifier;
- policy version;
- outcome: allowed, limited, unavailable, invalid identity, or disabled;
- coarse reason code;
- timestamp supplied by the metrics backend.

Forbidden fields include raw or hashed IPs, limiter keys, names, emails, phone numbers, property identifiers, user identifiers, enquiry text, form values, tokens, and database errors. The default metrics implementation is a no-op; production activation requires an approved durable metrics/alerting adapter.

## Monitoring and incident response

Before activation, operations must configure alerts for sustained limiter unavailability, spikes in limited attempts, abnormal submission-error rates, and divergence between limiter-allowed attempts and stored enquiries. Alert payloads must use aggregate counts only.

Incident handling must support immediate fail-closed deactivation through either activation gate, provider credential rotation, limiter-key rotation, investigation using aggregate telemetry, and documented communication/escalation. Operators must not inspect buyer messages for routine abuse triage.

## Privacy, retention, and deletion

Rate-limit records should retain only opaque keys and counters for the active windows plus a short provider cleanup margin. Metrics retention must be approved and minimized; no buyer payload belongs in telemetry.

Enquiry deletion and data-subject requests require an authenticated operational procedure that locates records through authorized database tooling, respects legal holds, records the action, and verifies downstream deletion. No automated deletion is added in Stage 5C.

The previously proposed twelve-month anonymization period for closed enquiries is explicitly pending privacy/legal review. It is not approved, configured, or implemented by this design.

## Provider integration requirements

Production activation remains blocked until SAT12 has:

1. a named hosting platform and documented trusted-proxy boundary;
2. a reviewed `TrustedClientIpResolver` adapter with spoofing tests;
3. an approved secret manager and HMAC key rotation procedure;
4. a distributed provider supporting atomic multi-window consumption;
5. a metrics and alerting backend with privacy review;
6. runbooks for outage, abuse response, deletion, and key rotation;
7. deployment tests proving fail-closed behavior and concurrency safety;
8. separate authorization to configure and enable both submission gates.

## Local verification

Local tests use injected deterministic adapters and prove:

- disabled, missing, invalid, and unavailable dependencies deny before the RPC;
- arbitrary forwarding headers cannot establish trust;
- both windows are passed in one atomic limiter request;
- allowed attempts proceed to validation and the existing RPC;
- exhausted limits and ambiguous outcomes return privacy-safe responses;
- invalid attempts consume limiter capacity before validation;
- telemetry contains only the approved event shape;
- concurrent calls rely on one atomic adapter operation per attempt;
- no in-memory production fallback exists.

No remote database, provider, Auth, Storage, or activation operation is part of Stage 5C local implementation.
