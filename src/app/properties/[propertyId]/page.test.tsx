import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Property } from "@/types/property";

const PROPERTY_ID = "11111111-1111-4111-8111-111111111111";
const harness = vi.hoisted(() => ({
  property: null as Property | null,
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: harness.notFound }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/features/properties/supabase-repository", () => ({
  getPublishedProperty: vi.fn(async () => harness.property),
}));
vi.mock("@/components/layout/HeaderAccount", () => ({
  HeaderAccount: () => <span>Account menu</span>,
  HeaderAccountFallback: () => <span>Loading account</span>,
}));
vi.mock("@/components/properties/PropertyLocationMap", () => ({
  PropertyLocationMap: ({ property }: { property: Property }) => <div aria-label={`Map showing ${property.title}`} />,
}));

import { generateMetadata, PropertyDetailsContent } from "./page";

const publishedProperty: Property = {
  id: PROPERTY_ID,
  title: "2 BHK Apartment for Sale in Nagpur",
  description: "A bright, well-connected apartment with generous living space.",
  listingIntent: "Buy",
  propertyType: "Apartment",
  price: 7_500_000,
  locality: "Dharampeth",
  city: "Nagpur",
  state: "Maharashtra",
  postalCode: "440010",
  latitude: 21.1458,
  longitude: 79.0882,
  image: { src: "/front.webp", alt: "Front elevation", kind: "listing" },
  images: [
    { src: "/front.webp", alt: "Front elevation", kind: "listing" },
    { src: "/living.webp", alt: "Living room", kind: "listing" },
  ],
  bedrooms: 2,
  bathrooms: 2,
  areaSqFt: 1200,
  status: "Ready to Move",
  reraApproved: true,
  reraNumber: "P50500001234",
  badge: "Featured",
};

describe("public property details", () => {
  it("renders only the resolved published property with gallery, facts, map, and safe enquiry state", async () => {
    harness.property = publishedProperty;
    render(await PropertyDetailsContent({ propertyId: PROPERTY_ID }));

    expect(screen.getByRole("heading", { name: publishedProperty.title })).toBeInTheDocument();
    expect(screen.getByText(publishedProperty.description!)).toBeInTheDocument();
    expect(screen.getByText("P50500001234")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByLabelText(`Map showing ${publishedProperty.title}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interested in this property?" })).toBeInTheDocument();
    expect(screen.getByText(/secure enquiries are coming soon/i)).toBeInTheDocument();
    expect(screen.queryByText(/owner email|owner phone/i)).not.toBeInTheDocument();
  });

  it("returns the same 404 for unavailable and malformed public IDs", async () => {
    harness.property = null;
    await expect(PropertyDetailsContent({ propertyId: PROPERTY_ID })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(PropertyDetailsContent({ propertyId: "not-a-uuid" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("builds useful metadata without publishing expiring signed image URLs", async () => {
    harness.property = publishedProperty;
    const metadata = await generateMetadata({ params: Promise.resolve({ propertyId: PROPERTY_ID }) });

    expect(metadata.title).toBe(`${publishedProperty.title} | SAT12`);
    expect(metadata.alternates).toEqual({ canonical: `/properties/${PROPERTY_ID}` });
    expect(JSON.stringify(metadata)).not.toContain("/storage/v1/object/sign/");
  });
});
