"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError, requireRole } from "@/features/auth/authorization";
import { authorizePropertyImageUpload, deletePropertyImage as deleteImageWorkflow, PROPERTY_IMAGE_BUCKET, uploadPropertyImage } from "@/features/property-images/storage";
import { createPropertyManagementService } from "@/features/properties/management";
import { createManagementClient } from "@/features/properties/management-supabase";
import { imageInputSchema, propertyDraftFromFormData } from "@/features/properties/schemas";
import type { ActionState } from "@/types/managed-property";

function authFailure(error: unknown): ActionState {
  return error instanceof AuthorizationError
    ? { ok: false, code: error.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "FORBIDDEN", message: error.code === "AUTH_REQUIRED" ? "Sign in to continue." : "Approved owner access is required." }
    : { ok: false, code: "RETRYABLE", message: "The request could not be completed." };
}

async function context() {
  const client = await createManagementClient();
  const principal = await requireRole(["owner_agent", "admin"], { client: client.raw });
  return { client, principal, service: createPropertyManagementService(client, { id: principal.id, role: principal.role as "owner_agent" | "admin" }) };
}

export async function createDraft(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = propertyDraftFromFormData(formData);
    if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    const { service } = await context();
    const result = await service.createDraft(parsed.data);
    if (result.ok) revalidatePath("/dashboard/properties");
    return result;
  } catch (error) { return authFailure(error); }
}

export async function updateDraft(revisionId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = propertyDraftFromFormData(formData);
    if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    const { service } = await context();
    const result = await service.updateDraft(revisionId, parsed.data);
    if (result.ok) { revalidatePath("/dashboard/properties"); revalidatePath(`/dashboard/properties/${revisionId}`); }
    return result;
  } catch (error) { return authFailure(error); }
}

export async function createRevision(propertyId: string): Promise<ActionState> {
  try { const { service } = await context(); const result = await service.createRevision(propertyId); if (result.ok) revalidatePath("/dashboard/properties"); return result; }
  catch (error) { return authFailure(error); }
}

export async function deleteDraft(revisionId: string): Promise<ActionState> {
  try { const { service } = await context(); const result = await service.deleteDraft(revisionId); if (result.ok) revalidatePath("/dashboard/properties"); return result; }
  catch (error) { return authFailure(error); }
}

export async function submitListing(revisionId: string): Promise<ActionState> {
  try { const { service } = await context(); const result = await service.submitListing(revisionId); if (result.ok) revalidatePath("/dashboard/properties"); return result; }
  catch (error) { return authFailure(error); }
}

export async function recordPropertyImage(revisionId: string, propertyId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { client, principal } = await context();
    const file = formData.get("image");
    if (!(file instanceof File)) return { ok: false, code: "VALIDATION", message: "Choose an image." };
    const parsed = imageInputSchema.safeParse({ name: file.name, type: file.type, size: file.size, altText: formData.get("altText"), position: formData.get("position") ?? 0 });
    if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the image and description.", fieldErrors: parsed.error.flatten().fieldErrors };
    const revision = await client.getRevision(revisionId);
    const row = revision.data as { property_id?: string; status?: string; properties?: { owner_id?: string } } | null;
    if (revision.error || !row || row.property_id !== propertyId || row.properties?.owner_id !== principal.id || typeof row.status !== "string") return { ok: false, code: "FORBIDDEN", message: "You cannot add images to this revision." };
    const imageId = crypto.randomUUID();
    const authorization = authorizePropertyImageUpload({ userId: principal.id, propertyOwnerId: row.properties.owner_id, propertyId, revisionId, revisionPropertyId: row.property_id, revisionStatus: row.status, imageId, file });
    await uploadPropertyImage({
      authorization, file, storage: client.raw.storage.from(PROPERTY_IMAGE_BUCKET) as unknown as Parameters<typeof uploadPropertyImage>[0]["storage"],
      recordMetadata: async () => {
        const result = await client.insertImage({ id: imageId, revision_id: revisionId, storage_path: authorization.path, alt_text: parsed.data.altText, position: parsed.data.position, width: Number(formData.get("width") || 1), height: Number(formData.get("height") || 1), size_bytes: authorization.sizeBytes, mime_type: authorization.mimeType, source_kind: "owner_uploaded", created_by: principal.id });
        if (result.error) throw result.error;
        return result.data;
      },
    });
    revalidatePath(`/dashboard/properties/${revisionId}`);
    return { ok: true, message: "Image uploaded." };
  } catch { return { ok: false, code: "RETRYABLE", message: "Image upload failed. No listing changes were lost." }; }
}

export async function deletePropertyImage(imageId: string, path: string, revisionId: string): Promise<ActionState> {
  try {
    const { client } = await context();
    const image = await client.getImage(imageId, revisionId, path);
    if (image.error || !image.data) return { ok: false, code: "FORBIDDEN", message: "You cannot delete that image." };
    await deleteImageWorkflow({ path, deleteMetadata: async () => { const result = await client.deleteImage(imageId); if (result.error) throw result.error; }, storage: client.raw.storage.from(PROPERTY_IMAGE_BUCKET) });
    revalidatePath(`/dashboard/properties/${revisionId}`);
    return { ok: true, message: "Image deleted." };
  } catch { return { ok: false, code: "RETRYABLE", message: "Image deletion needs attention. Please retry." }; }
}
