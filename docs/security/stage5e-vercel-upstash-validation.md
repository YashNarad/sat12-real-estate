# SAT12 Stage 5E Vercel and Upstash validation

## Status and authorization boundary

Stage 5E supplies local provider adapters only. No Vercel or Upstash account, resource, credential, connection, deployment, or paid subscription is created. Both buyer-enquiry submission gates remain disabled. Hosted validation and every later activation step require separate explicit authorization.

## Vercel trusted-client-IP validation

The resolver reads only `x-vercel-forwarded-for`, only when server-only runtime markers identify an approved Vercel production deployment. Header presence alone is not trust. Generic `Forwarded`, `x-forwarded-for`, and `x-real-ip` values remain untrusted.

Before activation, use separately approved non-production infrastructure to send conflicting attacker-controlled forwarding headers through both the custom domain and every directly reachable Vercel direct deployment URL. Prove that:

- Vercel overwrites attacker-provided values and the request cannot select another limiter identity;
- missing, multiple, malformed, private, reserved, loopback, link-local, multicast, and zone-qualified addresses fail closed;
- public IPv4, public IPv6, and IPv4-mapped IPv6 normalize consistently;
- a proxy, CDN, preview deployment, or direct-origin bypass cannot create a second trusted identity;
- no raw IP, normalized IP, or derived limiter key enters logs, metrics, traces, or error responses.

Changing the proxy/CDN topology invalidates these results and requires a new threat review and spoofing test.

## Upstash atomicity and concurrency validation

The adapter issues one atomic EVAL operation against one sorted set per opaque HMAC subject. The Lua script uses Redis server time, removes entries older than the one-hour window, counts the preceding ten-minute and one-hour windows, checks both limits, and inserts one unique attempt only when both limits allow it. A pipeline or independent commands are not acceptable substitutes.

Provider-specific testing must execute at least 25 simultaneous operations for one opaque subject and prove:

- no more than 5 attempts are allowed in any preceding 10-minute window;
- no more than 20 attempts are allowed in any preceding one-hour window;
- both decisions are made inside the same script execution;
- unrelated opaque subjects remain isolated;
- boundary timestamps and expiry cannot create a burst bypass;
- duplicate attempt identifiers fail closed and do not create an allowance;
- malformed replies and Lua runtime errors fail closed;
- an error after a Redis write is not assumed to roll that write back.

Timeout and ambiguous completion can consume an attempt. SAT12 must deny the enquiry, perform no automatic retry, issue no refund, and never use an in-memory fallback. Test Redis outage, credential revocation, network timeout, late response, script-cache loss, malformed response, budget exhaustion, and recovery.

## Secrets and rotation

Production values must be stored as non-readable provider secrets and separated by environment. The required classes are the Upstash REST credential, rate-limit HMAC secret, HMAC key version, and any approved metrics credential. Values must never be committed or copied into logs.

Upstash credential rotation requires credential overlap: create a replacement, deploy it while the old credential remains valid, validate privacy-safe health signals, then revoke the old credential. Environment changes apply only to new deployments.

HMAC rotation uses an explicit HMAC key version. Because a new version starts a new limiter namespace, keep both gates disabled during cutover unless a separately reviewed dual-key design preserves counters. Never query both keys or merge counters ad hoc.

Vercel manages Server Action encryption for its platform, but hosted rolling-deployment tests must verify active forms across deployment transitions. The Render fallback requires one stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build and runtime across all instances.

## Privacy-safe monitoring and alerts

Monitoring accepts only the Stage 5C allowlisted event fields and coarse outcomes. Never record raw IPs, HMAC keys, buyer names, emails, phone numbers, messages, property/user identifiers, form payloads, tokens, or raw provider/database errors.

Alert on sustained identity-resolution failure, limiter unavailability/timeouts, malformed or unknown script responses, unexpected limited/allowed-rate changes, Server Action version errors, secret-rotation deadlines, and cost-budget thresholds. A monitoring failure is observational and cannot convert a denial into an allowance.

India and cross-border processing review must cover Vercel runtime/log/control-plane data, Upstash primary/replica/backup/support data, Supabase region and backups, monitoring, subprocessors, retention, deletion, and incident access. Mumbai compute alone is not proof of Indian data residency. The twelve-month closed-enquiry anonymization proposal remains pending privacy review and is not implemented.

## Rollback and outage handling

Keep both gates disabled during initial deployment and validation. Rollback means restoring the last verified application deployment, retaining or restoring fail-closed unconfigured adapters, and confirming both gates are disabled. During provider outage or uncertainty, disable or leave disabled the application gate, preserve only aggregate evidence, and validate the trusted-IP and limiter boundaries before restoration.

No emergency in-memory limiter, automatic retry, direct table write, provider bypass, or database-only fallback is approved.
