import { describe, expect, it } from "vitest";

import { imageInputSchema, propertyDraftSchema } from "./schemas";

const valid = {
  title: "  3 BHK Apartment  ", description: "  Bright family home in central Nagpur.  ",
  listingIntent: "buy", propertyType: "apartment", priceInr: 8_500_000,
  locality: "  Dharampeth  ", city: "Nagpur", state: "Maharashtra", postalCode: "440010",
  latitude: 21.1458, longitude: 79.0882, bedrooms: 3, bathrooms: 2,
  areaSqFt: 1450, constructionStatus: "ready_to_move", reraApproved: true,
  reraNumber: "P50500000001", updatedAt: "2026-10-21T10:00:00.000Z",
};

describe("property draft validation", () => {
  it("normalizes owner-editable fields", () => {
    const parsed = propertyDraftSchema.parse(valid);
    expect(parsed).toMatchObject({ title: "3 BHK Apartment", locality: "Dharampeth" });
  });

  it("accepts Supabase timestamps with an explicit UTC offset", () => {
    expect(propertyDraftSchema.safeParse({ ...valid, updatedAt: "2026-10-25T10:30:00+00:00" }).success).toBe(true);
  });

  it.each([
    [{ priceInr: 0 }, "priceInr"], [{ areaSqFt: -1 }, "areaSqFt"],
    [{ latitude: 19 }, "latitude"], [{ longitude: 82 }, "longitude"],
    [{ propertyType: "plot", bedrooms: 1 }, "bedrooms"],
    [{ reraApproved: true, reraNumber: "" }, "reraNumber"],
  ])("rejects invalid listing input", (change, field) => {
    const result = propertyDraftSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    if (!result.success) expect((result.error.flatten().fieldErrors as Record<string, string[] | undefined>)[field]).toBeDefined();
  });

  it.each([
    [{ title: "Tiny".slice(0, 4) }, "title", "at least 5"],
    [{ description: "Too short" }, "description", "at least 10"],
    [{ priceInr: 0 }, "priceInr", "greater than zero"],
    [{ areaSqFt: 0 }, "areaSqFt", "greater than zero"],
    [{ postalCode: "123456" }, "postalCode", "Nagpur PIN"],
    [{ reraApproved: true, reraNumber: "" }, "reraNumber", "RERA number"],
  ])("returns a useful message for %s", (change, field, message) => {
    const result = propertyDraftSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    if (!result.success) expect((result.error.flatten().fieldErrors as Record<string, string[] | undefined>)[field]?.[0]).toContain(message);
  });
});

describe("image input validation", () => {
  it("accepts a safe image and trims alt text", () => {
    expect(imageInputSchema.parse({ name: "home.webp", type: "image/webp", size: 1000, altText: "  Living room  ", position: 0 }))
      .toMatchObject({ altText: "Living room" });
  });

  it.each([
    [{ name: "../home.webp" }, "name"], [{ type: "image/gif" }, "type"],
    [{ size: 5 * 1024 * 1024 + 1 }, "size"], [{ altText: "" }, "altText"],
    [{ position: 12 }, "position"],
  ])("rejects unsafe image metadata", (change, field) => {
    const result = imageInputSchema.safeParse({ name: "home.webp", type: "image/webp", size: 1000, altText: "Home", position: 0, ...change });
    expect(result.success).toBe(false);
    if (!result.success) expect((result.error.flatten().fieldErrors as Record<string, string[] | undefined>)[field]).toBeDefined();
  });
});
