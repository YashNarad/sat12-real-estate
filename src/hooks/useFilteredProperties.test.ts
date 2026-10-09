import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterProperties } from "./useFilteredProperties";
import type { Property } from "@/types/property";

const properties: Property[] = [
  {
    id: "p1", title: "3 BHK Apartment", listingIntent: "Buy", propertyType: "Apartment",
    price: 8_500_000, locality: "Dharampeth", city: "Nagpur", latitude: 21.1435,
    longitude: 79.0566, image: { src: "/images/properties/property-01.svg", alt: "Apartment", license: "SAT12 placeholder" },
    bedrooms: 3, bathrooms: 2, areaSqFt: 1450, status: "Ready to Move", reraApproved: true,
  },
  {
    id: "p2", title: "4 BHK Villa", listingIntent: "Buy", propertyType: "Villa",
    price: 18_000_000, locality: "Manish Nagar", city: "Nagpur", latitude: 21.091,
    longitude: 79.078, image: { src: "/images/properties/property-02.svg", alt: "Villa", license: "SAT12 placeholder" },
    bedrooms: 4, bathrooms: 4, areaSqFt: 2800, status: "Under Construction", reraApproved: true,
  },
  {
    id: "p3", title: "2 BHK Rental Apartment", listingIntent: "Rent", propertyType: "Apartment",
    price: 32_000, locality: "Civil Lines", city: "Nagpur", latitude: 21.154,
    longitude: 79.073, image: { src: "/images/properties/property-03.svg", alt: "Rental apartment", license: "SAT12 placeholder" },
    bedrooms: 2, bathrooms: 2, areaSqFt: 1100, status: "Ready to Move", reraApproved: false,
  },
  {
    id: "p4", title: "5 BHK Villa", listingIntent: "Buy", propertyType: "Villa",
    price: 30_000_000, locality: "Besa", city: "Nagpur", latitude: 21.087,
    longitude: 79.115, image: { src: "/images/properties/property-04.svg", alt: "Five bedroom villa", license: "SAT12 placeholder" },
    bedrooms: 5, bathrooms: 5, areaSqFt: 4200, status: "Ready to Move", reraApproved: true,
  },
];

describe("filterProperties", () => {
  it("treats a whitespace-only query as no query", () => {
    expect(filterProperties(properties, { ...DEFAULT_FILTERS, query: "  " })).toHaveLength(3);
  });

  it("matches locality text without case sensitivity", () => {
    expect(filterProperties(properties, { ...DEFAULT_FILTERS, query: "manish nagar" }).map((property) => property.id)).toEqual(["p2"]);
  });

  it("includes a property on the exact budget boundary", () => {
    expect(filterProperties(properties, { ...DEFAULT_FILTERS, maxPrice: 8_500_000 }).map((property) => property.id)).toEqual(["p1"]);
  });

  it("combines property type and bedroom filters with AND semantics", () => {
    expect(filterProperties(properties, { ...DEFAULT_FILTERS, propertyType: "Villa", bedrooms: 4 }).map((property) => property.id)).toEqual(["p2", "p4"]);
  });

  it("filters by real listing intent", () => {
    expect(filterProperties(properties, { ...DEFAULT_FILTERS, intent: "Rent" }).map((property) => property.id)).toEqual(["p3"]);
  });
});
