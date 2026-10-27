# SAT12 Stage 5A Enquiries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a locally prepared, privacy-conscious buyer enquiry flow and owner lead inbox without deploying or enabling remote submissions.

**Architecture:** A forward-only migration snapshots the recipient and published revision through a guarded database RPC; direct table writes remain unavailable. Thin Server Actions validate all client input and map stable database errors, while client forms receive only minimal display DTOs. Owner reads and status transitions are enforced by both server role checks and RLS/RPC ownership checks.

**Tech Stack:** Next.js 16.4.1 App Router, React 19 Server Actions, TypeScript, Zod, Supabase/PostgreSQL RLS and pgTAP, Vitest/Testing Library.

**Spec:** User-provided “SAT12 Stage 5A — Buyer Enquiries and Owner/Agent Lead Management” request.

## Global Constraints

- Local implementation only; no remote Supabase operation, migration deployment, Docker, push, merge, or main changes.
- No buyer-supplied recipient, owner, revision, status, or administrative fields.
- Submission stays disabled until the migration and an approved production-grade abuse-control boundary are deployed.
- Historic leads remain assigned to the recipient recorded at submission after archive, unpublish, or transfer.
- Only owner/agent recipients and AAL2 administrators may read leads; status is the only mutable business field.

## Review Focus

- Concurrent duplicate submissions must serialize and return a stable duplicate classification.
- A property transfer must not expose historic buyer contact details to the new owner.
- An archived/unpublished/stale property must fail before any PII is persisted.
- Server Action responses must never include database details or buyer PII.
- A direct RPC caller must not bypass the production-enablement gate or mutate restricted columns.

---

### Task 1: Forward-only enquiry security contract

**Files:**
- Create: `supabase/migrations/20261027120000_stage5a_secure_enquiries.sql`
- Replace: `supabase/tests/enquiries_rls.test.sql`
- Create: `scripts/stage5a-enquiries-migration.test.ts`

- [ ] Write failing contract tests for the new columns, RPC grants, fixed search paths, direct-write revocation, and policy scopes.
- [ ] Write transactional assertions for anonymous submission, eligibility, recipient snapshot, duplicate/rate rejection, private reads, transfer isolation, status-only updates, and AAL2 admin access.
- [ ] Implement the minimal migration and run local contract/assertion-count checks.

### Task 2: Validation and Server Actions

**Files:**
- Create: `src/features/enquiries/schema.ts`
- Create: `src/features/enquiries/service.ts`
- Create: `src/app/actions/enquiries.ts`
- Create corresponding tests.

- [ ] Write failing tests for field validation, payload size, honeypot, database error mapping, unavailable backend, owner authorization, restricted status, and sanitized output.
- [ ] Implement typed DTOs and thin actions backed by the caller’s publishable Supabase client.
- [ ] Re-run focused tests to green.

### Task 3: Public form and private inbox

**Files:**
- Create: `src/components/enquiries/EnquiryForm.tsx`
- Create: `src/components/enquiries/EnquiryStatusForm.tsx`
- Create: `src/app/dashboard/enquiries/{layout,page,loading,error}.tsx`
- Modify: `src/app/properties/[propertyId]/page.tsx`
- Modify: `src/components/management/ManagementPortalShell.tsx`
- Create/update corresponding tests.

- [ ] Write failing UI and route tests for accessible validation, pending/success/unavailable states, role navigation, privacy-safe owner queries, filters, and status controls.
- [ ] Implement the form, owner-only inbox, status actions, responsive states, and portal navigation.
- [ ] Re-run focused tests to green.

### Task 4: Privacy documentation and final gate

**Files:**
- Create: `docs/security/stage5a-enquiries.md`

- [ ] Document submitters, recipients, AAL2 admin access, transfer/archive behavior, retention decisions, consent copy, and production blockers.
- [ ] Run focused tests, full suite, ESLint, TypeScript, build, SQL static/assertion checks, diff check, and secret scan.
- [ ] Commit only Stage 5A files and confirm a clean branch with unchanged main.
