import type { ActionState } from "@/types/managed-property";
import { propertyDraftSchema, type PropertyDraftInput } from "./schemas";

type Principal = { id: string; role: "owner_agent" | "admin" };
type Result<T = unknown> = { data: T | null; error: null | { code?: string; message?: string } };
interface ManagementClient {
  rpc(name: string, args: Record<string, unknown>): Promise<Result>;
  getRevision(id: string): Promise<Result<{
    id?: string; property_id?: string; status?: string; updated_at?: string;
    properties?: { owner_id?: string; published_revision_id?: string | null };
  }>>;
  updateRevision(id: string, fields: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Result>;
  deleteRevision(id: string): Promise<{ error: unknown }>;
  insertImage(fields: Record<string, unknown>): Promise<Result>;
  deleteImage(id: string): Promise<{ error: unknown }>;
}

function failure(error: unknown): ActionState {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (code === "42501") return { ok: false, code: "FORBIDDEN", message: "You do not have permission to make that change." };
  if (code === "NOT_FOUND") return { ok: false, code: "NOT_FOUND", message: "The listing could not be found." };
  if (code === "23514" || message.includes("SAT12_LISTING_INCOMPLETE")) return { ok: false, code: "VALIDATION", message: "Add a description of at least 10 characters and at least one image before submitting." };
  if (code === "23505" || code === "SAT12_STALE_REVISION_STATE" || message.includes("SAT12_STALE_REVISION_STATE")) return { ok: false, code: "CONFLICT", message: "This listing changed. Refresh and try again." };
  return { ok: false, code: "RETRYABLE", message: "We could not save the listing. Please try again." };
}

function rpcPayload(input: PropertyDraftInput) {
  return {
    title: input.title, description: input.description, listing_intent: input.listingIntent,
    property_type: input.propertyType, price_inr: input.priceInr, locality: input.locality,
    city: input.city, state: input.state, postal_code: input.postalCode,
    latitude: input.latitude, longitude: input.longitude, bedrooms: input.bedrooms,
    bathrooms: input.bathrooms, area_sq_ft: input.areaSqFt,
    construction_status: input.constructionStatus, rera_approved: input.reraApproved,
    rera_number: input.reraNumber || null,
  };
}

export function createPropertyManagementService(client: ManagementClient, principal: Principal) {
  async function editable(id: string, updatedAt?: string) {
    const result = await client.getRevision(id);
    if (result.error || !result.data) return { error: { code: "NOT_FOUND" } } as const;
    const row = result.data;
    if (row.properties?.owner_id !== principal.id) return { error: { code: "42501" } } as const;
    if (typeof row.status !== "string" || !(["draft", "rejected"] as string[]).includes(row.status)) return { error: { code: "SAT12_STALE_REVISION_STATE" } } as const;
    if (updatedAt && row.updated_at !== updatedAt) return { error: { code: "23505" } } as const;
    return { row } as const;
  }
  return {
    async createDraft(input: unknown): Promise<ActionState> {
      const parsed = propertyDraftSchema.safeParse(input);
      if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
      const slug = `${parsed.data.locality.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
      const result = await client.rpc("create_draft_listing", { p_listing: { ...rpcPayload(parsed.data), slug } });
      return result.error ? failure(result.error) : { ok: true, message: "Draft created.", data: result.data };
    },
    async createRevision(propertyId: string): Promise<ActionState> {
      const result = await client.rpc("create_listing_revision", { p_property_id: propertyId });
      return result.error ? failure(result.error) : { ok: true, message: "Private revision created.", data: result.data };
    },
    async updateDraft(revisionId: string, input: unknown): Promise<ActionState> {
      const parsed = propertyDraftSchema.safeParse(input);
      if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
      const access = await editable(revisionId, parsed.data.updatedAt);
      if ("error" in access) return failure(access.error);
      const result = await client.updateRevision(revisionId, rpcPayload(parsed.data), parsed.data.updatedAt);
      return result.error ? failure(result.error) : { ok: true, message: "Draft saved.", data: result.data };
    },
    async deleteDraft(revisionId: string): Promise<ActionState> {
      const access = await editable(revisionId);
      if ("error" in access) return failure(access.error);
      if (!access.row.properties?.published_revision_id) {
        return { ok: false, code: "CONFLICT", message: "This first draft cannot be deleted safely yet." };
      }
      const result = await client.deleteRevision(revisionId);
      return result.error ? failure(result.error) : { ok: true, message: "Draft deleted." };
    },
    async submitListing(revisionId: string): Promise<ActionState> {
      const result = await client.rpc("submit_listing", { p_revision_id: revisionId });
      return result.error ? failure(result.error) : { ok: true, message: "Listing submitted for review.", data: result.data };
    },
  };
}
