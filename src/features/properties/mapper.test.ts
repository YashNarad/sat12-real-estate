import { describe, expect, it } from "vitest";

import { mapPublishedProperty, type PublishedPropertyRow } from "./mapper";

const row: PublishedPropertyRow = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-10-18T10:00:00.000Z",
  archived_at: null,
  published_revision_id: "22222222-2222-4222-8222-222222222222",
  published_revision: {
    id: "22222222-2222-4222-8222-222222222222",
    property_id: "11111111-1111-4111-8111-111111111111",
    title: "Modern Nagpur apartment",
    listing_intent: "buy",
    property_type: "apartment",
    price_inr: 8_500_000,
    locality: "Dharampeth",
    city: "Nagpur",
    latitude: 21.1429,
    longitude: 79.0558,
    bedrooms: 3,
    bathrooms: 2,
    area_sq_ft: 1450,
    construction_status: "ready_to_move",
    rera_approved: true,
    badge: "featured",
    status: "published",
    published_at: "2026-10-18T11:00:00.000Z",
    property_images: [{
      id: "33333333-3333-4333-8333-333333333333",
      storage_path: "owner/property/revision/image.webp",
      alt_text: "Sunlit apartment living room",
      position: 0,
      source_kind: "owner_uploaded",
    }],
  },
};
const revision = row.published_revision!;

describe("mapPublishedProperty", () => {
  it("maps every database enum and preserves stable identity and coordinate order", () => {
    expect(mapPublishedProperty(row, ["https://project.supabase.co/signed/image"])).toEqual({
      id: row.id,
      title: "Modern Nagpur apartment",
      listingIntent: "Buy",
      propertyType: "Apartment",
      price: 8_500_000,
      locality: "Dharampeth",
      city: "Nagpur",
      latitude: 21.1429,
      longitude: 79.0558,
      image: {
        src: "https://project.supabase.co/signed/image",
        alt: "Sunlit apartment living room",
        kind: "listing",
      },
      images: [{
        src: "https://project.supabase.co/signed/image",
        alt: "Sunlit apartment living room",
        kind: "listing",
      }],
      bedrooms: 3,
      bathrooms: 2,
      areaSqFt: 1450,
      status: "Ready to Move",
      reraApproved: true,
      badge: "Featured",
    });
  });

  it.each([
    ["rent", "Rent"],
    ["buy", "Buy"],
  ] as const)("maps %s price semantics", (listing_intent, expected) => {
    expect(mapPublishedProperty({ ...row, published_revision: { ...revision, listing_intent } }).listingIntent).toBe(expected);
  });

  it.each([
    ["villa", "Villa"],
    ["independent_house", "Independent House"],
    ["plot", "Plot"],
  ] as const)("maps the %s property type", (property_type, expected) => {
    const typedRevision = { ...revision, property_type };
    if (property_type === "plot") Object.assign(typedRevision, { bedrooms: 0, bathrooms: 0 });
    expect(mapPublishedProperty({ ...row, published_revision: typedRevision }).propertyType).toBe(expected);
  });

  it("maps under-construction and new badge values", () => {
    const property = mapPublishedProperty({
      ...row,
      published_revision: { ...revision, construction_status: "under_construction", badge: "new" },
    });
    expect(property.status).toBe("Under Construction");
    expect(property.badge).toBe("New");
  });

  it("uses a safe placeholder when no primary image can be signed", () => {
    expect(mapPublishedProperty(row).image).toEqual({
      src: "/images/properties/property-placeholder.svg",
      alt: "Image unavailable for Modern Nagpur apartment",
      kind: "listing",
    });
  });

  it("labels seeded illustrative imagery truthfully", () => {
    const illustrative = {
      ...row,
      published_revision: {
        ...revision,
        property_images: [{ ...revision.property_images[0], source_kind: "sat12_illustrative" }],
      },
    };
    expect(mapPublishedProperty(illustrative, ["https://project.supabase.co/signed/image"]).image.kind).toBe("illustrative");
  });

  it("maps every signed published image in position order while preserving the first as cover", () => {
    const second = { ...revision.property_images[0], id: "44444444-4444-4444-8444-444444444444", alt_text: "Bedroom", position: 1 };
    const property = mapPublishedProperty(
      { ...row, published_revision: { ...revision, property_images: [second, revision.property_images[0]] } },
      ["https://project.supabase.co/signed/primary", "https://project.supabase.co/signed/second"],
    );
    expect(property.images?.map(({ alt }) => alt)).toEqual(["Sunlit apartment living room", "Bedroom"]);
    expect(property.image).toEqual(property.images?.[0]);
  });

  it.each([
    { ...row, archived_at: "2026-10-19T00:00:00.000Z" },
    { ...row, published_revision_id: "44444444-4444-4444-8444-444444444444" },
    { ...row, published_revision: { ...revision, status: "draft" as const } },
    { ...row, published_revision: { ...revision, status: "submitted" as const } },
    { ...row, published_revision: { ...revision, status: "rejected" as const } },
    { ...row, published_revision: { ...revision, status: "superseded" as const } },
    { ...row, published_revision: { ...revision, city: "Pune" } },
    { ...row, published_revision: { ...revision, price_inr: -1 } },
  ])("rejects malformed or non-public rows", (invalid) => {
    expect(() => mapPublishedProperty(invalid as PublishedPropertyRow)).toThrow("SAT12_PROPERTY_ROW_INVALID");
  });
});
