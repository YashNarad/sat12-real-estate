import { z } from "zod";

import type { Database } from "@/types/database.generated";
import type { Property } from "@/types/property";

type Revision = Database["public"]["Tables"]["property_revisions"]["Row"];

export interface PublishedPropertyImageRow {
  id: string;
  storage_path: string;
  alt_text: string;
  position: number;
  source_kind: string;
}

export interface PublishedRevisionRow extends Pick<Revision,
  | "id" | "property_id" | "title" | "listing_intent" | "property_type"
  | "price_inr" | "locality" | "city" | "latitude" | "longitude"
  | "bedrooms" | "bathrooms" | "area_sq_ft" | "construction_status"
  | "rera_approved" | "badge" | "status" | "published_at"
> {
  property_images: PublishedPropertyImageRow[];
}

export interface PublishedPropertyRow {
  id: string;
  created_at: string;
  archived_at: string | null;
  published_revision_id: string | null;
  published_revision: PublishedRevisionRow | null;
}

const imageSchema = z.object({
  id: z.string().uuid(), storage_path: z.string().min(1), alt_text: z.string().min(1),
  position: z.number().int().min(0), source_kind: z.string().min(1),
});
const rowSchema = z.object({
  id: z.string().uuid(), created_at: z.string().min(1), archived_at: z.null(),
  published_revision_id: z.string().uuid(),
  published_revision: z.object({
    id: z.string().uuid(), property_id: z.string().uuid(), title: z.string().min(1),
    listing_intent: z.enum(["buy", "rent"]),
    property_type: z.enum(["apartment", "villa", "independent_house", "plot"]),
    price_inr: z.number().int().positive(), locality: z.string().min(1), city: z.literal("Nagpur"),
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
    bedrooms: z.number().int().nonnegative(), bathrooms: z.number().int().nonnegative(),
    area_sq_ft: z.number().int().positive(),
    construction_status: z.enum(["ready_to_move", "under_construction"]),
    rera_approved: z.boolean(), badge: z.enum(["featured", "new"]).nullable(),
    status: z.literal("published"), published_at: z.string().min(1),
    property_images: z.array(imageSchema),
  }),
}).superRefine((value, context) => {
  if (value.published_revision_id !== value.published_revision.id || value.id !== value.published_revision.property_id) {
    context.addIssue({ code: "custom", message: "published pointer mismatch" });
  }
  if (value.published_revision.property_type === "plot" &&
      (value.published_revision.bedrooms !== 0 || value.published_revision.bathrooms !== 0)) {
    context.addIssue({ code: "custom", message: "plot room counts must be zero" });
  }
});

export const PROPERTY_IMAGE_PLACEHOLDER = "/images/properties/property-placeholder.svg";

export function mapPublishedProperty(input: PublishedPropertyRow, primaryImageUrl?: string): Property {
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) throw new Error("SAT12_PROPERTY_ROW_INVALID");
  const revision = parsed.data.published_revision;
  const primary = [...revision.property_images].sort((a, b) => a.position - b.position)[0];
  const image = primary && primaryImageUrl
    ? { src: primaryImageUrl, alt: primary.alt_text, kind: primary.source_kind === "sat12_illustrative" ? "illustrative" as const : "listing" as const }
    : { src: PROPERTY_IMAGE_PLACEHOLDER, alt: `Image unavailable for ${revision.title}`, kind: "listing" as const };

  return {
    id: parsed.data.id,
    title: revision.title,
    listingIntent: revision.listing_intent === "buy" ? "Buy" : "Rent",
    propertyType: ({ apartment: "Apartment", villa: "Villa", independent_house: "Independent House", plot: "Plot" } as const)[revision.property_type],
    price: revision.price_inr,
    locality: revision.locality,
    city: "Nagpur",
    latitude: revision.latitude,
    longitude: revision.longitude,
    image,
    bedrooms: revision.bedrooms,
    bathrooms: revision.bathrooms,
    areaSqFt: revision.area_sq_ft,
    status: revision.construction_status === "ready_to_move" ? "Ready to Move" : "Under Construction",
    reraApproved: revision.rera_approved,
    ...(revision.badge ? { badge: revision.badge === "featured" ? "Featured" as const : "New" as const } : {}),
  };
}
