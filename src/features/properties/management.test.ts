import { describe, expect, it, vi } from "vitest";

import { createPropertyManagementService } from "./management";

const principal = { id: "10000000-0000-4000-8000-000000000001", role: "owner_agent" as const };
const draft = {
  title: "3 BHK Apartment", description: "Bright family home in central Nagpur.", listingIntent: "buy",
  propertyType: "apartment", priceInr: 8_500_000, locality: "Dharampeth", city: "Nagpur",
  state: "Maharashtra", postalCode: "440010", latitude: 21.1458, longitude: 79.0882,
  bedrooms: 3, bathrooms: 2, areaSqFt: 1450, constructionStatus: "ready_to_move",
  reraApproved: true, reraNumber: "P50500000001", updatedAt: "2026-10-21T10:00:00.000Z",
};

function client(overrides: Record<string, unknown> = {}) {
  return {
    rpc: vi.fn(async () => ({ data: { id: "revision-1", property_id: "property-1" }, error: null })),
    updateRevision: vi.fn(async () => ({ data: { id: "revision-1" }, error: null })),
    getRevision: vi.fn(async () => ({ data: { id: "revision-1", property_id: "property-1", status: "draft", updated_at: draft.updatedAt, properties: { owner_id: principal.id, published_revision_id: null } }, error: null })),
    deleteRevision: vi.fn(async () => ({ error: null })),
    insertImage: vi.fn(async () => ({ data: { id: "image-1" }, error: null })),
    deleteImage: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
}

describe("owner property management service", () => {
  it("creates drafts through the lifecycle RPC with server-derived data", async () => {
    const db = client();
    const service = createPropertyManagementService(db, principal);
    const result = await service.createDraft(draft);
    expect(result.ok).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("create_draft_listing", expect.objectContaining({ p_listing: expect.objectContaining({ listing_intent: "buy" }) }));
  });

  it("rejects stale, cross-owner, and immutable revision edits", async () => {
    for (const row of [
      { status: "draft", updated_at: "older", properties: { owner_id: principal.id } },
      { status: "draft", updated_at: draft.updatedAt, properties: { owner_id: "other" } },
      { status: "published", updated_at: draft.updatedAt, properties: { owner_id: principal.id } },
    ]) {
      const service = createPropertyManagementService(client({ getRevision: vi.fn(async () => ({ data: row, error: null })) }), principal);
      await expect(service.updateDraft("revision-1", draft)).resolves.toMatchObject({ ok: false });
    }
  });

  it("creates published edits only through create_listing_revision", async () => {
    const db = client();
    const service = createPropertyManagementService(db, principal);
    await service.createRevision("property-1");
    expect(db.rpc).toHaveBeenCalledWith("create_listing_revision", { p_property_id: "property-1" });
  });

  it("submits through the lifecycle RPC and maps RLS failures safely", async () => {
    const db = client({ rpc: vi.fn(async () => ({ data: null, error: { code: "42501" } })) });
    await expect(createPropertyManagementService(db, principal).submitListing("revision-1"))
      .resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("fails closed instead of orphaning a stable property when deleting revision one", async () => {
    const db = client();
    const result = await createPropertyManagementService(db, principal).deleteDraft("revision-1");
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(db.deleteRevision).not.toHaveBeenCalled();
  });
});
