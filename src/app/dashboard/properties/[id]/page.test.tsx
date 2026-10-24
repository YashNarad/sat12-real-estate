import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const REVISION_ID = "10000000-0000-4000-8000-000000000002";
const PROPERTY_ID = "10000000-0000-4000-8000-000000000003";

const harness = vi.hoisted(() => ({
  selected: "",
  filteredId: "",
  result: { data: null as unknown, error: null as unknown },
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: harness.notFound }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: (columns: string) => {
        harness.selected = columns;
        return {
          eq: (_column: string, id: string) => {
            harness.filteredId = id;
            return { maybeSingle: async () => harness.result };
          },
        };
      },
    }),
  })),
}));
vi.mock("@/app/actions/properties", () => ({
  createRevision: vi.fn(),
  deletePropertyImage: vi.fn(),
  submitListing: vi.fn(),
  updateDraft: vi.fn(),
}));
vi.mock("@/components/dashboard/PropertyEditor", () => ({
  PropertyEditor: () => <div>Draft editor</div>,
}));
vi.mock("@/components/dashboard/PropertyImageManager", () => ({
  PropertyImageManager: () => <div>Secure image uploader</div>,
}));
vi.mock("@/components/dashboard/LifecycleAction", () => ({
  LifecycleAction: () => <button type="button">Lifecycle action</button>,
}));

import PropertyRevisionPage from "./page";

function revision() {
  return {
    id: REVISION_ID,
    property_id: PROPERTY_ID,
    revision_number: 1,
    title: "New Nagpur draft",
    description: "",
    listing_intent: "buy",
    property_type: "apartment",
    price_inr: 5000000,
    locality: "Dharampeth",
    city: "Nagpur",
    state: "Maharashtra",
    postal_code: null,
    latitude: 21.1458,
    longitude: 79.0882,
    bedrooms: 2,
    bathrooms: 2,
    area_sq_ft: 1000,
    construction_status: "ready_to_move",
    rera_approved: false,
    rera_number: null,
    status: "draft",
    rejection_reason: null,
    updated_at: "2026-10-24T12:00:00Z",
    properties: { id: PROPERTY_ID, published_revision_id: null },
    property_images: [],
  };
}

describe("PropertyRevisionPage", () => {
  beforeEach(() => {
    harness.selected = "";
    harness.filteredId = "";
    harness.result = { data: revision(), error: null };
    harness.notFound.mockClear();
  });

  it("uses the revision ID and unambiguous owner-property relationship", async () => {
    render(await PropertyRevisionPage({ params: Promise.resolve({ id: REVISION_ID }) }));

    expect(harness.filteredId).toBe(REVISION_ID);
    expect(harness.selected).toContain(
      "properties!property_revisions_property_id_fkey",
    );
    expect(screen.getByText("Draft editor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Property images" })).toBeInTheDocument();
    expect(screen.getByText("Secure image uploader")).toBeInTheDocument();
  });

  it("returns the same 404 for missing, inaccessible, or denied revisions", async () => {
    for (const result of [
      { data: null, error: null },
      { data: null, error: { code: "42501" } },
    ]) {
      harness.result = result;
      await expect(
        PropertyRevisionPage({ params: Promise.resolve({ id: REVISION_ID }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(harness.notFound).toHaveBeenCalledTimes(2);
  });
});
