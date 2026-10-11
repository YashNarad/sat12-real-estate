import { expect, it } from "vitest";
import type { Property } from "@/types/property";
import {
  filterPropertiesByBounds,
  propertyIsWithinBounds,
  sameMapBounds,
} from "./useMapBoundsFilter";

function propertyAt(id: string, latitude: number, longitude: number): Property {
  return {
    id,
    title: `${id} apartment`,
    listingIntent: "Buy",
    propertyType: "Apartment",
    price: 8_500_000,
    locality: "Dharampeth",
    city: "Nagpur",
    latitude,
    longitude,
    image: { src: "/images/properties/dharampeth-apartment.webp", alt: id, license: "SAT12 generated illustrative image" },
    bedrooms: 3,
    bathrooms: 2,
    areaSqFt: 1450,
    status: "Ready to Move",
    reraApproved: true,
  };
}

const bounds = { north: 21.2, south: 21, east: 79.2, west: 79 };
const inside = propertyAt("inside", 21.1, 79.1);
const edge = propertyAt("edge", 21.2, 79.2);
const outside = propertyAt("outside", 20.99, 79.1);
const properties = [inside, edge, outside];

it("includes properties inside and exactly on map bounds", () => {
  expect(propertyIsWithinBounds(inside, bounds)).toBe(true);
  expect(propertyIsWithinBounds(edge, bounds)).toBe(true);
  expect(propertyIsWithinBounds(outside, bounds)).toBe(false);
});

it("filters only when map search and valid bounds are active", () => {
  expect(filterPropertiesByBounds(properties, null, false)).toBe(properties);
  expect(filterPropertiesByBounds(properties, bounds, false)).toBe(properties);
  expect(filterPropertiesByBounds(properties, bounds, true).map(({ id }) => id)).toEqual(["inside", "edge"]);
});

it("compares repeated bounds with a small numeric tolerance", () => {
  expect(sameMapBounds(bounds, { ...bounds })).toBe(true);
  expect(sameMapBounds(bounds, { ...bounds, east: bounds.east + 0.0000005 })).toBe(true);
  expect(sameMapBounds(bounds, { ...bounds, east: bounds.east + 0.001 })).toBe(false);
  expect(sameMapBounds(null, null)).toBe(true);
});

it("defends against invalid or date-line-wrapped bounds", () => {
  expect(propertyIsWithinBounds(inside, { ...bounds, north: 20.9 })).toBe(false);
  expect(propertyIsWithinBounds(inside, { ...bounds, east: 78.9 })).toBe(false);
});
