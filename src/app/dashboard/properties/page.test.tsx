/**
 * Regression tests for the owner properties dashboard page.
 *
 * PGRST201 fix: properties has two FK relationships to property_revisions
 * (one-to-many via property_revisions_property_id_fkey, and a published_revision_id FK).
 * Without the FK hint PostgREST returns HTTP 300 (Multiple Choices / PGRST201) which the
 * page surfaced as "Properties unavailable". The fix adds
 * property_revisions!property_revisions_property_id_fkey in the select string.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Capture every select string the mock receives so we can assert on the FK hint.
const harness = vi.hoisted(() => ({
  lastSelect: "" as string,
  resolvedWith: { data: null as unknown, error: null as unknown },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: (cols: string) => {
        harness.lastSelect = cols;
        return {
          order: () =>
            Promise.resolve(harness.resolvedWith),
        };
      },
    }),
  })),
}));

import OwnerPropertiesPage from "./page";

describe("OwnerPropertiesPage", () => {
  it("uses the FK hint to disambiguate the property_revisions embed (PGRST201 regression)", async () => {
    harness.resolvedWith = { data: [], error: null };
    render(await OwnerPropertiesPage());
    expect(harness.lastSelect).toContain("property_revisions!property_revisions_property_id_fkey");
  });

  it("renders the empty-state message when no properties are returned", async () => {
    harness.resolvedWith = { data: [], error: null };
    render(await OwnerPropertiesPage());
    expect(screen.getByRole("heading", { name: "No properties yet" })).toBeInTheDocument();
  });

  it("renders the error state when Supabase returns an error", async () => {
    harness.resolvedWith = { data: null, error: { code: "PGRST201", message: "Multiple Choices" } };
    render(await OwnerPropertiesPage());
    expect(screen.getByRole("heading", { name: "Properties unavailable" })).toBeInTheDocument();
  });

  it("renders a property card for each returned property", async () => {
    harness.resolvedWith = {
      data: [
        {
          id: "prop-1",
          slug: "nagpur-flat-1",
          archived_at: null,
          published_revision_id: null,
          property_revisions: [
            {
              id: "rev-1",
              title: "3BHK Flat in Civil Lines",
              status: "draft",
              revision_number: 1,
              rejection_reason: null,
              updated_at: "2026-10-20T12:00:00Z",
            },
          ],
        },
      ],
      error: null,
    };
    render(await OwnerPropertiesPage());
    expect(screen.getByRole("heading", { name: "3BHK Flat in Civil Lines" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit & photos" })).toHaveAttribute(
      "href",
      "/dashboard/properties/rev-1",
    );
  });
});
