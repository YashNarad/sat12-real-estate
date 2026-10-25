import { describe, expect, it, vi } from "vitest";

import { PROPERTY_IMAGE_CACHE_SECONDS, PROPERTY_IMAGE_SIGNED_URL_SECONDS } from "@/features/property-images/storage";
import { createSupabasePropertyRepository, PUBLIC_PROPERTY_IMAGE_SELECT, PUBLIC_PROPERTY_SELECT } from "./supabase-repository";
import type { PublishedPropertyRow } from "./mapper";

const projectUrl = "https://mveicefdvdgeyxalgnue.supabase.co";

function publishedRow(overrides: Partial<PublishedPropertyRow> = {}): PublishedPropertyRow {
  const id = overrides.id ?? "11111111-1111-4111-8111-111111111111";
  const revisionId = "22222222-2222-4222-8222-222222222222";
  return {
    id,
    created_at: "2026-10-18T10:00:00.000Z",
    archived_at: null,
    published_revision_id: revisionId,
    published_revision: {
      id: revisionId,
      property_id: id,
      title: "Published home",
      listing_intent: "buy",
      property_type: "apartment",
      price_inr: 8_000_000,
      locality: "Dharampeth",
      city: "Nagpur",
      latitude: 21.14,
      longitude: 79.05,
      bedrooms: 3,
      bathrooms: 2,
      area_sq_ft: 1400,
      construction_status: "ready_to_move",
      rera_approved: true,
      badge: null,
      status: "published",
      published_at: "2026-10-18T11:00:00.000Z",
      property_images: [
        { id: "55555555-5555-4555-8555-555555555555", storage_path: "later.webp", alt_text: "Later", position: 1, source_kind: "owner_uploaded" },
        { id: "33333333-3333-4333-8333-333333333333", storage_path: "primary.webp", alt_text: "Primary", position: 0, source_kind: "owner_uploaded" },
      ],
    },
    ...overrides,
  };
}

function clientResult(data: PublishedPropertyRow[] | null, error: unknown = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  const not = vi.fn(() => ({ order }));
  const is = vi.fn(() => ({ not }));
  const select = vi.fn(() => ({ is }));
  const publishedImages = data?.[0]?.published_revision?.property_images.toSorted((a, b) => a.position - b.position) ?? [];
  const imageOrder = vi.fn().mockResolvedValue({ data: publishedImages, error: null });
  const imageEq = vi.fn(() => ({ order: imageOrder }));
  const imageSelect = vi.fn(() => ({ eq: imageEq }));
  const createSignedUrl = vi.fn(async (path: string, expiresIn: number) => ({
    data: { signedUrl: `https://mveicefdvdgeyxalgnue.supabase.co/storage/v1/object/sign/property-images/${path}?expires=${expiresIn}` },
    error: null,
  }));
  return {
    client: { from: vi.fn((table: string) => table === "properties" ? { select } : { select: imageSelect }), storage: { from: vi.fn(() => ({ createSignedUrl })) } },
    calls: { select, is, not, order, imageSelect, imageEq, imageOrder, createSignedUrl },
  };
}

describe("Supabase property repository", () => {
  it("queries only active stable properties and their current published revision using explicit columns", async () => {
    const harness = clientResult([publishedRow()]);
    const result = await createSupabasePropertyRepository(harness.client, projectUrl).listPublished();
    expect(result).toHaveLength(1);
    expect(harness.calls.select).toHaveBeenCalledWith(PUBLIC_PROPERTY_SELECT);
    expect(harness.calls.is).toHaveBeenCalledWith("archived_at", null);
    expect(harness.calls.not).toHaveBeenCalledWith("published_revision_id", "is", null);
    expect(harness.calls.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(PUBLIC_PROPERTY_SELECT).not.toContain("*");
    expect(PUBLIC_PROPERTY_SELECT).not.toContain("property_images");
    expect(harness.calls.imageSelect).toHaveBeenCalledWith(PUBLIC_PROPERTY_IMAGE_SELECT);
    expect(harness.calls.imageEq).toHaveBeenCalledWith("revision_id", publishedRow().published_revision!.id);
    expect(harness.calls.imageOrder).toHaveBeenCalledWith("position", { ascending: true });
  });

  it("signs every ordered published image for ten minutes and returns newest rows first", async () => {
    const older = publishedRow({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", created_at: "2026-10-17T10:00:00.000Z" });
    const newer = publishedRow({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", created_at: "2026-10-19T10:00:00.000Z" });
    const harness = clientResult([older, newer]);
    const result = await createSupabasePropertyRepository(harness.client, projectUrl).listPublished();
    expect(result.map(({ id }) => id)).toEqual([newer.id, older.id]);
    expect(harness.calls.createSignedUrl).toHaveBeenCalledWith("primary.webp", PROPERTY_IMAGE_SIGNED_URL_SECONDS);
    expect(harness.calls.createSignedUrl).toHaveBeenCalledWith("later.webp", PROPERTY_IMAGE_SIGNED_URL_SECONDS);
    expect(result[0].images?.map(({ alt }) => alt)).toEqual(["Primary", "Later"]);
    expect(PROPERTY_IMAGE_CACHE_SECONDS).toBeLessThanOrEqual(5 * 60);
  });

  it("returns an empty immutable inventory without falling back to mocks", async () => {
    const harness = clientResult([]);
    const result = await createSupabasePropertyRepository(harness.client, projectUrl).listPublished();
    expect(result).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("propagates database failures without exposing database details", async () => {
    const harness = clientResult(null, { message: "private table path and SQL details" });
    await expect(createSupabasePropertyRepository(harness.client, projectUrl).listPublished()).rejects.toThrow("SAT12_PROPERTIES_LOAD_FAILED");
    await expect(createSupabasePropertyRepository(harness.client, projectUrl).listPublished()).rejects.not.toThrow("private table path");
  });

  it("uses a placeholder when one signed URL fails without leaking its object path", async () => {
    const harness = clientResult([publishedRow()]);
    harness.calls.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "primary.webp" } } as never);
    const [property] = await createSupabasePropertyRepository(harness.client, projectUrl).listPublished();
    expect(property.image.src).toBe("/images/properties/property-placeholder.svg");
    expect(JSON.stringify(property)).not.toContain("primary.webp");
  });

  it("keeps public inventory available when image metadata access fails", async () => {
    const harness = clientResult([publishedRow()]);
    harness.calls.imageOrder.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    const [property] = await createSupabasePropertyRepository(harness.client, projectUrl).listPublished();
    expect(property.image.src).toBe("/images/properties/property-placeholder.svg");
    expect(property.title).toBe("Published home");
  });

  it("defensively excludes archived, pointer-mismatched, and non-published rows", async () => {
    const active = publishedRow();
    const harness = clientResult([
      { ...publishedRow(), archived_at: "2026-10-19T00:00:00.000Z" },
      { ...publishedRow(), published_revision_id: "99999999-9999-4999-8999-999999999999" },
      { ...publishedRow(), published_revision: { ...publishedRow().published_revision!, status: "draft" } },
      active,
    ]);
    expect(await createSupabasePropertyRepository(harness.client, projectUrl).listPublished()).toHaveLength(1);
    expect(harness.calls.imageEq).toHaveBeenCalledTimes(1);
    expect(harness.calls.imageEq).toHaveBeenCalledWith("revision_id", active.published_revision!.id);
  });
});
