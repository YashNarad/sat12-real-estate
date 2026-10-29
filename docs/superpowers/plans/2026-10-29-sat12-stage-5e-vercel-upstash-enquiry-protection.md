# SAT12 Stage 5E Vercel and Upstash Enquiry Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and locally verify the conditionally approved Vercel trusted-client-IP resolver, privacy-safe HMAC key derivation, and Upstash atomic two-window rate-limiter adapter without provisioning providers, creating secrets, deploying, or enabling buyer enquiries.

**Architecture:** Add host/provider adapters behind the Stage 5C interfaces and select them through a server-only dependency factory. The Vercel resolver trusts only the platform-specific header under an explicit production-runtime contract; the Upstash adapter executes one Lua script that checks and consumes both windows atomically. Missing or malformed configuration, timeouts, transport errors, and ambiguous results continue to fail closed, while both submission gates remain disabled.

**Tech Stack:** Next.js 16.4.1 Server Actions, Node.js crypto/net APIs, TypeScript, `@upstash/redis@1.40.0`, `ipaddr.js@2.5.0`, Vitest.

---

## File map

- Create `src/features/enquiries/providers/vercel-trusted-client-ip.ts`: Vercel-only runtime/header validation and public-IP normalization.
- Create `src/features/enquiries/providers/vercel-trusted-client-ip.test.ts`: header spoofing, topology, IPv4/IPv6, and fail-closed tests.
- Create `src/features/enquiries/providers/hmac-rate-limit-key.ts`: purpose/version-scoped HMAC-SHA-256 derivation.
- Create `src/features/enquiries/providers/hmac-rate-limit-key.test.ts`: determinism, separation, missing-key, and privacy tests.
- Create `src/features/enquiries/providers/upstash-distributed-rate-limiter.ts`: one-script atomic consumption, response validation, and timeout behavior.
- Create `src/features/enquiries/providers/upstash-distributed-rate-limiter.test.ts`: script contract, concurrency model, exhaustion, outage, timeout, and ambiguity tests with a fake transport.
- Create `src/features/enquiries/providers/dependencies.ts`: environment validation and fail-closed provider dependency assembly.
- Create `src/features/enquiries/providers/dependencies.test.ts`: complete/missing/wrong-runtime configuration tests.
- Modify `src/app/actions/enquiries.ts`: obtain dependencies from the server-only factory; leave the existing application gate check first.
- Modify `src/app/actions/enquiries.test.ts`: assert disabled gates never initialize providers and enabled-but-unconfigured requests fail closed before RPC.
- Modify `.env.example`: document variable names with empty values only.
- Modify `docs/security/stage5c-enquiry-abuse-operations.md`: add Vercel/Upstash deployment tests, rotation, rollback, monitoring, and activation blockers.
- Create `docs/security/stage5e-vercel-upstash-validation.md`: hosted validation procedure that remains unexecuted until separately approved infrastructure exists.
- Modify `scripts/stage5c-enquiry-abuse-contract.test.ts`: require the Stage 5E operational controls and validation-document reference.
- Modify `package.json` and `package-lock.json`: add only `@upstash/redis@1.40.0` and `ipaddr.js@2.5.0`.

## Task 1: Lock the Vercel trusted-IP contract with failing tests

**Files:**
- Create: `src/features/enquiries/providers/vercel-trusted-client-ip.test.ts`
- Create: `src/features/enquiries/providers/vercel-trusted-client-ip.ts`

- [ ] **Step 1: Write failing resolver tests**

Cover these exact cases with table-driven Vitest tests:

```ts
const productionVercel = { VERCEL: "1", VERCEL_ENV: "production" };

it("accepts one Vercel-derived public address only in the approved runtime", async () => {
  const resolver = createVercelTrustedClientIpResolver(productionVercel);
  await expect(resolver.resolve(new Headers({
    "x-vercel-forwarded-for": "8.8.8.8",
    "x-forwarded-for": "1.1.1.1",
  }))).resolves.toEqual({ status: "trusted", ip: "8.8.8.8" });
});

it.each([
  [{}, "8.8.8.8"],
  [{ VERCEL: "1", VERCEL_ENV: "preview" }, "8.8.8.8"],
  [productionVercel, "8.8.8.8, 1.1.1.1"],
  [productionVercel, "127.0.0.1"],
  [productionVercel, "10.0.0.1"],
  [productionVercel, "203.0.113.10"],
  [productionVercel, "not-an-ip"],
] as const)("fails closed for an untrusted runtime or address", async (runtime, value) => {
  const resolver = createVercelTrustedClientIpResolver(runtime);
  await expect(resolver.resolve(new Headers({
    "x-vercel-forwarded-for": value,
  }))).resolves.toMatchObject({ status: expect.stringMatching(/invalid|unavailable/) });
});
```

Also prove that ordinary `forwarded`, `x-forwarded-for`, and `x-real-ip` are ignored; missing headers fail closed; canonical IPv6 is returned; IPv4-mapped IPv6 has one documented normalization; multiple values and whitespace ambiguity are rejected; and thrown header access returns unavailable without logging.

- [ ] **Step 2: Run the resolver test and verify RED**

Run: `npm test -- src/features/enquiries/providers/vercel-trusted-client-ip.test.ts`
Expected: FAIL because the resolver module does not exist.

- [ ] **Step 3: Implement the minimal resolver**

Use `ipaddr.js` for parsing and range classification. Export:

```ts
type VercelRuntime = Readonly<Partial<Pick<NodeJS.ProcessEnv, "VERCEL" | "VERCEL_ENV">>>;

export function createVercelTrustedClientIpResolver(
  runtime: VercelRuntime,
): TrustedClientIpResolver;
```

Require `VERCEL === "1"` and `VERCEL_ENV === "production"`. Read only `x-vercel-forwarded-for`. Reject commas, empty values, parse failures, and every `ipaddr.js` range except `unicast`. Normalize with `toNormalizedString()` and map IPv4-mapped IPv6 consistently. Catch all header/parser errors and return an existing fail-closed result without emitting the input.

- [ ] **Step 4: Run resolver tests and verify GREEN**

Run: `npm test -- src/features/enquiries/providers/vercel-trusted-client-ip.test.ts`
Expected: all resolver tests PASS.

- [ ] **Step 5: Commit the isolated resolver unit**

```powershell
git add package.json package-lock.json src/features/enquiries/providers/vercel-trusted-client-ip.ts src/features/enquiries/providers/vercel-trusted-client-ip.test.ts
git commit -m "feat: add fail-closed Vercel client IP resolver"
```

## Task 2: Add privacy-safe HMAC key derivation

**Files:**
- Create: `src/features/enquiries/providers/hmac-rate-limit-key.ts`
- Create: `src/features/enquiries/providers/hmac-rate-limit-key.test.ts`

- [ ] **Step 1: Write failing HMAC tests**

Tests must prove same key/input is deterministic, different IPs and secret versions differ, output never contains the IP or secret, missing/short key material is unavailable, and provider errors fail closed.

```ts
const deriver = createHmacRateLimitKeyDeriver({
  secret: Buffer.alloc(32, 7).toString("base64"),
  keyVersion: "v1",
});

await expect(deriver.derive("8.8.8.8")).resolves.toEqual({
  status: "derived",
  key: expect.stringMatching(/^sat12:enquiry-ip:v1:[a-f0-9]{64}$/u),
});
```

- [ ] **Step 2: Run the HMAC test and verify RED**

Run: `npm test -- src/features/enquiries/providers/hmac-rate-limit-key.test.ts`
Expected: FAIL because the HMAC adapter does not exist.

- [ ] **Step 3: Implement minimal derivation**

Use Node `createHmac("sha256", secretBytes)` over `sat12/enquiry-ip/${keyVersion}/${normalizedIp}`. Require exactly 32 decoded bytes and a version matching `/^[a-z0-9-]{1,16}$/u`. Return only the versioned hexadecimal digest; never log inputs.

- [ ] **Step 4: Run HMAC tests and verify GREEN**

Run: `npm test -- src/features/enquiries/providers/hmac-rate-limit-key.test.ts`
Expected: all HMAC tests PASS.

- [ ] **Step 5: Commit the HMAC unit**

```powershell
git add src/features/enquiries/providers/hmac-rate-limit-key.ts src/features/enquiries/providers/hmac-rate-limit-key.test.ts
git commit -m "feat: derive privacy-safe enquiry limiter keys"
```

## Task 3: Specify the atomic Lua operation with failing adapter tests

**Files:**
- Create: `src/features/enquiries/providers/upstash-distributed-rate-limiter.ts`
- Create: `src/features/enquiries/providers/upstash-distributed-rate-limiter.test.ts`

- [ ] **Step 1: Write failing adapter contract tests**

Define a narrow injectable transport so local tests never connect:

```ts
export interface UpstashScriptTransport {
  eval<Result>(script: string, keys: string[], args: (string | number)[]): Promise<Result>;
}
```

Assert that one `consume()` call makes exactly one `eval()` call, supplies two sorted-set keys with the same Redis hash tag, supplies both limits/windows plus a non-sensitive unique attempt nonce, and never issues independent reads or writes. Assert exact mappings for script tuples `[1, shortCount, longCount]` (allowed), `[0, shortCount, longCount]` (limited), and every malformed tuple (unavailable).

- [ ] **Step 2: Add deterministic concurrency-model tests**

Implement a test-only serialized fake that runs the intended sliding-window script semantics under `Promise.all` for 25 attempts against one subject. Assert exactly 5 are allowed in the first ten minutes, both sorted sets contain the same 5 attempts, no partial consumption occurs, and a second subject is isolated. Advance the fake clock just past 600 seconds, prove only expired short-window members are removed while the hourly window continues, and prove no chosen ten-minute or one-hour interval exceeds its respective limit.

- [ ] **Step 3: Add failure tests**

Cover transport rejection, configured timeout, response after timeout, empty result, wrong version/status/count types, negative counts, and unknown status. Assert no automatic retry and an unavailable result for every ambiguous case.

- [ ] **Step 4: Run adapter tests and verify RED**

Run: `npm test -- src/features/enquiries/providers/upstash-distributed-rate-limiter.test.ts`
Expected: FAIL because the adapter and script do not exist.

- [ ] **Step 5: Implement one atomic Lua script**

Export a constant script and adapter factory. The script must use Redis server time and perform one conditional sliding-window operation across two stable sorted-set keys:

```lua
local short_limit = tonumber(ARGV[1])
local long_limit = tonumber(ARGV[2])
local short_window_ms = tonumber(ARGV[3]) * 1000
local long_window_ms = tonumber(ARGV[4]) * 1000
local attempt_nonce = ARGV[5]
local redis_time = redis.call('TIME')
local now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms - short_window_ms)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now_ms - long_window_ms)

local short_count = tonumber(redis.call('ZCARD', KEYS[1]))
local long_count = tonumber(redis.call('ZCARD', KEYS[2]))

if short_count >= short_limit or long_count >= long_limit then
  return {0, short_count, long_count}
end

local member = tostring(redis_time[1]) .. ':' .. tostring(redis_time[2]) .. ':' .. attempt_nonce
redis.call('ZADD', KEYS[1], now_ms, member)
redis.call('ZADD', KEYS[2], now_ms, member)
redis.call('PEXPIRE', KEYS[1], short_window_ms)
redis.call('PEXPIRE', KEYS[2], long_window_ms)
return {1, short_count + 1, long_count + 1}
```

Use keys `sat12:enquiry:{<subjectKey>}:600` and `sat12:enquiry:{<subjectKey>}:3600` so both share a hash tag. Generate the attempt nonce with `randomUUID()`; it identifies only this limiter operation and contains no buyer or network data. Validate the policy equals `stage5c-v1` and the approved windows before calling the transport. Race the call against a configured timeout, never retry, and map timeout/late/invalid results to unavailable. Document that a client timeout can occur after Redis consumed the attempt; this ambiguity intentionally denies the request and does not refund counters.

- [ ] **Step 6: Run adapter tests and verify GREEN**

Run: `npm test -- src/features/enquiries/providers/upstash-distributed-rate-limiter.test.ts`
Expected: all adapter tests PASS, including deterministic concurrency semantics.

- [ ] **Step 7: Commit the atomic adapter unit**

```powershell
git add src/features/enquiries/providers/upstash-distributed-rate-limiter.ts src/features/enquiries/providers/upstash-distributed-rate-limiter.test.ts
git commit -m "feat: add atomic Upstash enquiry limiter adapter"
```

## Task 4: Assemble production dependencies without enabling submissions

**Files:**
- Create: `src/features/enquiries/providers/dependencies.ts`
- Create: `src/features/enquiries/providers/dependencies.test.ts`
- Modify: `src/app/actions/enquiries.ts`
- Modify: `src/app/actions/enquiries.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing factory tests**

Test that missing provider name, non-production Vercel runtime, missing URL/token/HMAC/version, invalid URL, non-HTTPS URL, and malformed secrets all return the existing unconfigured dependencies. A complete injected test configuration should return configured adapters without exposing secret values in objects, errors, or snapshots.

- [ ] **Step 2: Write failing action-boundary tests**

Assert:

- application gate false does not call `headers()`, construct Upstash, or call RPC;
- application gate true plus incomplete provider configuration returns the generic backend-unavailable response before RPC;
- a limited decision returns the generic rate-limit response;
- an allowed decision calls the existing submission service once;
- validation/RPC failures do not invoke a second consume or refund operation.

- [ ] **Step 3: Run factory/action tests and verify RED**

Run: `npm test -- src/features/enquiries/providers/dependencies.test.ts src/app/actions/enquiries.test.ts`
Expected: new tests FAIL because the factory is not wired.

- [ ] **Step 4: Implement the server-only factory**

Export:

```ts
export function createEnquiryAbuseDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): EnquiryAbuseDependencies;
```

Recognize only `SAT12_ENQUIRY_ABUSE_PROVIDER=vercel-upstash`. Construct `Redis` from `@upstash/redis` only after all fields validate. Required names are:

```ini
SAT12_ENQUIRY_ABUSE_PROVIDER=
SAT12_RATE_LIMIT_HMAC_KEY=
SAT12_RATE_LIMIT_HMAC_KEY_VERSION=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Do not add values. Require HTTPS Upstash URL syntax, nonempty token, and valid HMAC configuration. On any failure return the Stage 5C unconfigured dependencies. Keep metrics on the existing privacy-safe interface; do not invent a monitoring provider in Stage 5E.

- [ ] **Step 5: Wire the action after the disabled-gate check**

Replace direct unconfigured imports with `createEnquiryAbuseDependencies()`, but instantiate it only when `SAT12_ENQUIRIES_ENABLED === "true"`. Do not alter validation, honeypot, duplicate handling, Supabase RPC behavior, or database gate behavior.

- [ ] **Step 6: Run factory/action tests and verify GREEN**

Run: `npm test -- src/features/enquiries/providers/dependencies.test.ts src/app/actions/enquiries.test.ts`
Expected: all tests PASS and no network request occurs.

- [ ] **Step 7: Commit dependency assembly**

```powershell
git add .env.example src/features/enquiries/providers/dependencies.ts src/features/enquiries/providers/dependencies.test.ts src/app/actions/enquiries.ts src/app/actions/enquiries.test.ts
git commit -m "feat: wire fail-closed enquiry protection providers"
```

## Task 5: Document hosted verification, rotation, monitoring, and rollback

**Files:**
- Modify: `docs/security/stage5c-enquiry-abuse-operations.md`
- Create: `docs/security/stage5e-vercel-upstash-validation.md`
- Modify: `scripts/stage5c-enquiry-abuse-contract.test.ts`

- [ ] **Step 1: Add a documentation contract test or repository text assertions**

Extend `scripts/stage5c-enquiry-abuse-contract.test.ts` to load both `stage5c-enquiry-abuse-operations.md` and `stage5e-vercel-upstash-validation.md`, then require these phrases/concepts: `x-vercel-forwarded-for`, attacker-controlled header conflict, direct deployment URL, one atomic EVAL, no automatic retry, timeout may consume, HMAC version, credential overlap, fail closed, gates disabled, raw IP prohibited, India/cross-border review, and rollback.

- [ ] **Step 2: Run the documentation test and verify RED**

Run: `npm test -- scripts/stage5c-enquiry-abuse-contract.test.ts`
Expected: FAIL until the Stage 5E validation document exists with every required control.

- [ ] **Step 3: Write the hosted validation procedure**

The procedure must require separately approved, non-production provider resources and must not contain credentials. Include:

1. Vercel Mumbai region and custom-domain verification.
2. Conflicting/spoofed forwarding-header tests through custom and direct URLs.
3. IPv4/IPv6 identity normalization checks without logging addresses.
4. 25+ concurrent requests for one opaque key, proving atomic caps and no partial counters.
5. Independent subjects, window expiry, timeout, Redis outage, invalid response, budget exhaustion, and credential revocation.
6. Confirmation that timeout/ambiguous attempts are denied and never automatically retried or refunded.
7. Server Action rolling-deployment tests and confirmation of Vercel-managed encryption behavior.
8. Privacy-safe metric schema and deliberate metrics-sink outage.
9. Both submission gates disabled throughout validation.
10. Rollback by restoring the prior deployment and keeping/disabling gates; no in-memory fallback.

- [ ] **Step 4: Document rotation and operational ownership**

Record Upstash credential overlap/revoke order, HMAC version cutover and counter reset, Vercel new-deployment semantics, incident owners, alert thresholds, data-location/legal approval, and the unresolved availability-tier decision. Explicitly keep the 12-month anonymization proposal unimplemented.

- [ ] **Step 5: Run documentation tests and verify GREEN**

Run: `npm test -- scripts/stage5c-enquiry-abuse-contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit operations documentation**

```powershell
git add docs/security/stage5c-enquiry-abuse-operations.md docs/security/stage5e-vercel-upstash-validation.md scripts/stage5c-enquiry-abuse-contract.test.ts
git commit -m "docs: define Stage 5E provider validation and rollback"
```

## Task 6: Complete local verification without provider connections

**Files:**
- Review all Stage 5E files listed above.

- [ ] **Step 1: Prove tests cannot make provider connections**

Search tests for real Upstash URLs/tokens and assert the transport is injected/mocked. Confirm neither enquiry gate is enabled in tracked configuration.

Run:

```powershell
rg -n "https://.*upstash|UPSTASH_REDIS_REST_TOKEN=.*[^=]" src docs .env.example
rg -n "SAT12_ENQUIRIES_ENABLED=true|enquiry_submissions_enabled.*true" . --glob '!node_modules/**'
```

Expected: no secret/activation values; documentation URLs are acceptable only when clearly references.

- [ ] **Step 2: Run focused Stage 5E and enquiry tests**

```powershell
npm test -- src/features/enquiries src/app/actions/enquiries.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 3: Run the full application suite**

Run: `npm test`
Expected: all tests PASS with zero provider connections.

- [ ] **Step 4: Run static and production checks**

```powershell
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Run diff, whitespace, dependency, and secret review**

```powershell
git diff --check
git diff --stat
npm audit --omit=dev
```

Review the complete diff. Run the repository's existing secret-scan convention, and confirm only dependency manifests, provider adapters/tests, action wiring, blank environment names, and approved documentation changed.

- [ ] **Step 6: Commit the verified Stage 5E local implementation**

```powershell
git add package.json package-lock.json .env.example src/features/enquiries/providers src/app/actions/enquiries.ts src/app/actions/enquiries.test.ts docs/security
git commit -m "feat: prepare Vercel Upstash enquiry protection"
```

- [ ] **Step 7: Verify the safe stopping state**

Run:

```powershell
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse main
git rev-parse origin/main
```

Expected: clean `codex/sat12-stage-3`; `main` and `origin/main` unchanged; no provider resources, secrets, deployment, Supabase mutation, or gate activation.

## Hosted validation and activation are separate work

This plan stops after local implementation. Provider provisioning, credentials, Vercel linking/deployment, Upstash integration tests, legal/DPA approval, monitoring-provider integration, availability-tier selection, and each enquiry gate activation require separate explicit authorization. A failed or ambiguous hosted validation must leave both gates disabled and must not trigger automatic retry or fallback.
