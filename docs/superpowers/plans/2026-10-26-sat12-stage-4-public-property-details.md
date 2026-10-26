# SAT12 Public Property Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, responsive public details page for the stable SAT12 property identifier.

**Architecture:** Extend the existing public repository with an exact published-property lookup and reuse its mapper and signed-image delivery. Render the route as a server component with a focused client gallery/map wrapper, and add an independent card link so existing map/list selection remains unchanged.

**Tech Stack:** Next.js 16.4.1 App Router, React 19, TypeScript, Supabase SSR, Tailwind CSS, Vitest, Testing Library.

**Spec:** User-approved Stage 4 public property details brief attached to this task.

## Global Constraints

- Public data must resolve only through the exact non-archived published revision.
- Storage remains private; only short-lived signed URLs may reach the UI.
- No migrations, remote mutations, owner contact disclosure, or invented amenities.
- Preserve the existing Stage 2 `Property[]` behavior, map selection, filters, and gallery controls.

## Review Focus

- Malformed, missing, archived, or nonpublic property IDs return 404 without private detail leakage.
- Metadata never persists expiring signed image URLs.
- Gallery controls do not trigger card selection/navigation and remain keyboard accessible.
- Missing or expired image URLs degrade to the existing safe placeholder.
- Detail rendering omits unsupported optional fields rather than inventing content.

---

### Task 1: Exact published-property repository lookup

**Files:**
- Modify: `src/features/properties/repository.ts`
- Modify: `src/features/properties/supabase-repository.ts`
- Modify: `src/features/properties/mapper.ts`
- Modify: `src/types/property.ts`
- Test: `src/features/properties/supabase-repository.test.ts`

**Interfaces:**
- Produces: `PropertyRepository.findPublishedById(id: string): Promise<Property | null>` and `getPublishedProperty(id: string)`.

- [ ] Write failing tests for exact-ID filtering, published-pointer validation, optional detail mapping, ordered images, and safe null/error behavior.
- [ ] Run focused tests and confirm the missing method/fields fail.
- [ ] Implement the minimal exact query and shared image signing.
- [ ] Run focused tests and confirm they pass.

### Task 2: Public detail route and gallery

**Files:**
- Create: `src/app/properties/[propertyId]/page.tsx`
- Create: `src/app/properties/[propertyId]/loading.tsx`
- Create: `src/app/properties/[propertyId]/error.tsx`
- Create: `src/components/properties/PropertyLocationMap.tsx`
- Modify: `src/components/listings/PropertyImageGallery.tsx`
- Test: corresponding route and component test files.

**Interfaces:**
- Consumes: `getPublishedProperty(id)` and the existing `Property` contract.

- [ ] Write failing tests for published rendering, 404 cases, metadata, detail facts, gallery keyboard behavior, missing images, and safe enquiry copy.
- [ ] Run focused tests and confirm route/components are absent or incomplete.
- [ ] Implement request-time route loading, metadata, responsive details, gallery, location map, and non-operational enquiry panel.
- [ ] Run focused tests and confirm they pass.

### Task 3: Card navigation without interaction regressions

**Files:**
- Modify: `src/components/listings/PropertyCard.tsx`
- Test: `src/components/listings/PropertyResults.test.tsx`

**Interfaces:**
- Produces: public links at `/properties/{stablePropertyId}` while preserving `onSelect`.

- [ ] Write a failing test for the detail link and independent carousel/favorite/list-selection controls.
- [ ] Add the minimal `next/link` action outside existing buttons.
- [ ] Run focused map/list/gallery regression tests.

### Task 4: Verification and commit

- [ ] Run all focused tests and the full test suite.
- [ ] Run ESLint, TypeScript, and the production build.
- [ ] Run diff/whitespace and secret checks.
- [ ] Inspect the rendered page at desktop and mobile widths without mutating remote data.
- [ ] Commit only verified Stage 4 files on `codex/sat12-stage-3`.
