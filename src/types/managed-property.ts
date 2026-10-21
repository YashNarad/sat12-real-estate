import type { Database } from "./database.generated";

export type RevisionStatus = Database["public"]["Enums"]["revision_status"];
export type ManagedRevision = Pick<Database["public"]["Tables"]["property_revisions"]["Row"],
  "id" | "property_id" | "revision_number" | "title" | "description" | "listing_intent" |
  "property_type" | "price_inr" | "locality" | "city" | "state" | "postal_code" |
  "latitude" | "longitude" | "bedrooms" | "bathrooms" | "area_sq_ft" |
  "construction_status" | "rera_approved" | "rera_number" | "status" |
  "rejection_reason" | "updated_at"
>;

export interface ManagedProperty {
  id: string;
  slug: string;
  ownerId: string;
  publishedRevisionId: string | null;
  archivedAt: string | null;
  revisions: readonly ManagedRevision[];
}

export type ActionState<T = unknown> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; code: "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "NOT_FOUND" | "RETRYABLE"; fieldErrors?: Record<string, string[]> };
