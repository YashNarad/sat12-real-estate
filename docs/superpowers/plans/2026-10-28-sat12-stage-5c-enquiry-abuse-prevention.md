# SAT12 Stage 5C Enquiry Abuse Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a provider-independent, fail-closed abuse-protection boundary before public enquiry validation and persistence while leaving both activation gates disabled.

**Architecture:** A pure orchestration module accepts trusted-IP, opaque-key, atomic distributed-limiter, metrics, and enquiry-service ports. The Next.js server action supplies request headers but production defaults deliberately resolve nothing and deny, so no header is trusted and no in-memory fallback exists. One limiter call carries both approved windows and is consumed before validation; later validation or RPC failures never refund it.

**Tech Stack:** Next.js 16 Server Actions, TypeScript, Zod, Vitest, Supabase RPC client.

---

### Task 1: Define the abuse-protection contract

**Files:**
- Create: `src/features/enquiries/abuse-protection.test.ts`
- Create: `src/features/enquiries/abuse-protection.ts`

- [x] **Step 1: Write failing contract tests**

Add tests that import the wished-for API and prove the default resolver ignores `forwarded`, `x-forwarded-for`, and `x-real-ip`; the default key deriver and limiter return unavailable; and the policy contains both `{ limit: 5, windowSeconds: 600 }` and `{ limit: 20, windowSeconds: 3600 }` in one immutable request.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/features/enquiries/abuse-protection.test.ts`

Expected: FAIL because `abuse-protection.ts` and its exports do not exist.

- [x] **Step 3: Implement minimal contracts and defaults**

Define `TrustedClientIpResolver`, `RateLimitKeyDeriver`, `DistributedRateLimiter`, `EnquiryAbuseMetrics`, discriminated results, the two-window `ENQUIRY_RATE_LIMIT_POLICY`, and fail-closed defaults. The limiter input must contain `mode: "atomic-all-windows"` and both windows in one call. The unconfigured resolver must not inspect headers.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the same Vitest command and require all assertions to pass.

### Task 2: Implement fail-closed enforcement

**Files:**
- Modify: `src/features/enquiries/abuse-protection.test.ts`
- Modify: `src/features/enquiries/abuse-protection.ts`

- [x] **Step 1: Add failing behavior tests**

Cover missing identity, invalid identity, key-derivation failure, limiter outage, ambiguous limiter response, exhausted limits, allowed consumption, metrics exceptions, and strict event allowlisting. Assert that metrics receives only `event`, `version`, `route`, `policyVersion`, `outcome`, and `reason`.

- [x] **Step 2: Verify RED**

Run the focused test and confirm failures are due to the missing enforcement function.

- [x] **Step 3: Implement the minimal enforcement function**

Implement `enforceEnquiryAbuseProtection(headers, dependencies)` so every non-allowed or ambiguous state denies. Invoke the limiter exactly once with both windows. Emit allowlisted metrics in a guarded helper whose failure cannot change the decision.

- [x] **Step 4: Verify GREEN**

Run the focused tests and require all cases to pass.

### Task 3: Add the submission orchestrator

**Files:**
- Create: `src/features/enquiries/submission.test.ts`
- Create: `src/features/enquiries/submission.ts`

- [x] **Step 1: Write failing submission-flow tests**

Prove: disabled application gate returns `BACKEND_UNAVAILABLE` before abuse dependencies; allowed attempts are consumed before form validation; invalid/honeypot input is not refunded; duplicate and RPC failures are not refunded; denied protection never calls the enquiry service; and concurrent submissions each issue one atomic limiter operation with both windows.

- [x] **Step 2: Verify RED**

Run: `npm test -- --run src/features/enquiries/submission.test.ts`

Expected: FAIL because the submission orchestrator does not exist.

- [x] **Step 3: Implement the minimal orchestrator**

Implement a dependency-injected `submitPublicEnquiry` that checks `enabled`, enforces abuse protection, parses `FormData`, then calls the existing service. Map limited to the existing privacy-safe `RATE_LIMITED` response and unavailable/invalid states to `BACKEND_UNAVAILABLE`. Do not retry or refund.

- [x] **Step 4: Verify GREEN and concurrency behavior**

Run the focused test and require deterministic concurrent tests to pass. Document in test names that actual distributed atomicity remains an adapter integration obligation.

### Task 4: Wire the Next.js server action

**Files:**
- Modify: `src/app/actions/enquiries.test.ts`
- Modify: `src/app/actions/enquiries.ts`

- [x] **Step 1: Update action tests first**

Mock async `headers()` and the production abuse dependencies. Prove the disabled gate avoids header/limiter/database access, enabled-but-unconfigured denies without an RPC, and an injected allowed flow reaches the existing RPC without accepting recipient fields.

- [x] **Step 2: Verify RED**

Run: `npm test -- --run src/app/actions/enquiries.test.ts`

Expected: FAIL because the action still validates and calls the service directly.

- [x] **Step 3: Wire minimal production defaults**

Use `await headers()` only after the application gate is enabled. Call the submission orchestrator with the unconfigured resolver, deriver, limiter, and no-op metrics. Keep `SAT12_ENQUIRIES_ENABLED` unchanged and disabled in local configuration. Preserve the status-update action.

- [x] **Step 4: Verify GREEN**

Run the action and enquiry focused suites.

### Task 5: Document operations and privacy prerequisites

**Files:**
- Modify: `docs/security/stage5a-enquiries.md`
- Create: `docs/security/stage5c-enquiry-abuse-operations.md`
- Test: `scripts/stage5c-enquiry-abuse-contract.test.ts`

- [x] **Step 1: Write a failing documentation contract test**

Require explicit text for trusted-proxy configuration, atomic provider integration testing, HMAC secret rotation, aggregate-only metrics, fail-closed outage handling, incident deactivation, deletion requests, no raw PII logging, and the unapproved twelve-month proposal.

- [x] **Step 2: Verify RED**

Run: `npm test -- --run scripts/stage5c-enquiry-abuse-contract.test.ts`

- [x] **Step 3: Add operational documentation**

Document provider acceptance criteria, deployment tests, alerting, outage and abuse response, deletion workflow, minimum retention, and explicit activation prerequisites. State that the twelve-month anonymization proposal remains pending and unimplemented.

- [x] **Step 4: Verify GREEN**

Run the documentation contract and focused security suites.

### Task 6: Complete local verification and commit

**Files:**
- Verify all files above.

- [x] **Step 1: Run focused tests**

Run all Stage 5C, existing enquiry schema/service/action/form, migration contract, and generated-type drift tests.

- [x] **Step 2: Run the full gate**

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

- [x] **Step 3: Review repository hygiene**

Run `git diff --check`, inspect the complete diff, confirm only approved files changed, scan changed files for credentials/private data, confirm both gates remain disabled, and confirm `SAT12_REMOTE_OPERATION_APPROVED` is empty.

- [x] **Step 4: Commit the implementation**

Stage only the plan, provider-independent code, tests, and security documentation. Commit with `feat: add fail-closed enquiry abuse boundary`. Confirm the working tree is clean and `main`/`origin/main` are unchanged.
