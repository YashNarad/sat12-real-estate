import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const REVISION_ID = "10000000-0000-4000-8000-000000000001";
const harness = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, filteredId: "", notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));

vi.mock("next/navigation", () => ({ notFound: harness.notFound }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/features/auth/authorization", () => ({ requireAal2Admin: vi.fn(async () => ({ role: "admin", aal: "aal2" })) }));
vi.mock("@/lib/supabase/config", () => ({ getPublicSupabaseEnvironment: () => ({ url: "https://mveicefdvdgeyxalgnue.supabase.co" }) }));
vi.mock("@/features/property-images/storage", () => ({ PROPERTY_IMAGE_BUCKET: "property-images", createPropertyImageSignedUrl: vi.fn(async () => "https://mveicefdvdgeyxalgnue.supabase.co/signed/image") }));
vi.mock("@/components/admin/ListingModerationPanel", () => ({ ListingModerationPanel: () => <div>Moderation controls</div> }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({ select: () => ({ eq: (_field: string, id: string) => { harness.filteredId = id; return { maybeSingle: async () => harness.result }; } }) }),
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  })),
}));

import AdminListingReviewPage from "./page";

const revision = {
  id: REVISION_ID, property_id: "20000000-0000-4000-8000-000000000001", revision_number: 1,
  title: "Submitted Nagpur home", description: "A complete property description.", listing_intent: "buy", property_type: "apartment",
  price_inr: 5000000, locality: "Dharampeth", city: "Nagpur", state: "Maharashtra", postal_code: "440010",
  latitude: 21.1458, longitude: 79.0882, bedrooms: 2, bathrooms: 2, area_sq_ft: 1000,
  construction_status: "ready_to_move", rera_approved: false, rera_number: null, badge: null, status: "submitted",
  submitted_at: "2026-10-25T00:00:00Z", approved_at: null, published_at: null,
  properties: { id: "20000000-0000-4000-8000-000000000001", slug: "submitted-home", archived_at: null, published_revision_id: null },
  property_images: [{ id: "30000000-0000-4000-8000-000000000001", storage_path: "owner/property/revision/image.webp", alt_text: "Front elevation", position: 0 }],
  listing_approvals: [], listing_badge_audit_log: [],
};

describe("AdminListingReviewPage", () => {
  it("loads the exact AAL2-visible revision with details, private images, history, and controls", async () => {
    harness.result = { data: revision, error: null };
    render(await AdminListingReviewPage({ params: Promise.resolve({ id: REVISION_ID }) }));
    expect(harness.filteredId).toBe(REVISION_ID);
    expect(screen.getByRole("heading", { name: "Submitted Nagpur home" })).toBeInTheDocument();
    expect(screen.getByAltText("Front elevation")).toBeInTheDocument();
    expect(screen.getByText("Moderation controls")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Moderation history" })).toBeInTheDocument();
  });

  it("returns the same 404 for missing or inaccessible revisions", async () => {
    harness.result = { data: null, error: { code: "42501" } };
    await expect(AdminListingReviewPage({ params: Promise.resolve({ id: REVISION_ID }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
