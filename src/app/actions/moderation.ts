"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AuthorizationError,
  requireAal2Admin,
} from "@/features/auth/authorization";
import { createServerClient } from "@/lib/supabase/server";

const ownerAgentApprovalSchema = z.object({
  targetProfileId: z.string().uuid("Select a valid account."),
  reason: z
    .string()
    .trim()
    .min(3, "Explain why owner/agent access is being approved.")
    .max(1000, "Keep the audit reason under 1,000 characters."),
});

export type AdminRoleActionState = {
  ok: boolean;
  message: string;
  code?:
    | "AUTH_REQUIRED"
    | "MFA_REQUIRED"
    | "FORBIDDEN"
    | "VALIDATION"
    | "TARGET_UNAVAILABLE"
    | "STALE_TARGET"
    | "RETRYABLE";
  fieldErrors?: Partial<Record<"targetProfileId" | "reason", string[]>>;
};

export type ListingModerationActionState = {
  ok: boolean;
  message: string;
  code?: "AUTH_REQUIRED" | "MFA_REQUIRED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "RETRYABLE";
  fieldErrors?: Partial<Record<"revisionId" | "propertyId" | "notes" | "badge" | "reason", string[]>>;
};

const listingModerationSchema = z.object({
  intent: z.enum(["approve", "reject", "publish", "archive", "badge"]),
  revisionId: z.string().uuid("Select a valid listing revision."),
  propertyId: z.string().uuid("Select a valid property."),
  notes: z.string().trim().max(2000, "Keep review notes under 2,000 characters.").default(""),
  badge: z.enum(["featured", "new"]).optional(),
  reason: z.string().trim().max(1000, "Keep the audit reason under 1,000 characters.").default(""),
}).superRefine((value, context) => {
  if (value.intent === "reject" && value.notes.length < 3) context.addIssue({ code: "custom", path: ["notes"], message: "Explain why the listing is being rejected." });
  if (value.intent === "badge" && !value.badge) context.addIssue({ code: "custom", path: ["badge"], message: "Select an approved badge." });
  if (value.intent === "badge" && value.reason.length < 3) context.addIssue({ code: "custom", path: ["reason"], message: "Explain why the badge is changing." });
});

function authorizationFailure(error: AuthorizationError): AdminRoleActionState {
  if (error.code === "AUTH_REQUIRED") {
    return { ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." };
  }
  if (error.code === "MFA_REQUIRED") {
    return {
      ok: false,
      code: "MFA_REQUIRED",
      message: "Verify your administrator MFA session before changing roles.",
    };
  }
  return {
    ok: false,
    code: "FORBIDDEN",
    message: "Administrator access is required.",
  };
}

export async function approveOwnerAgent(
  _state: AdminRoleActionState,
  formData: FormData,
): Promise<AdminRoleActionState> {
  try {
    const client = await createServerClient();
    const principal = await requireAal2Admin({ client });
    const parsed = ownerAgentApprovalSchema.safeParse({
      targetProfileId: formData.get("targetProfileId"),
      reason: formData.get("reason"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Check the target account and audit reason.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    if (parsed.data.targetProfileId === principal.id) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Administrators cannot change their own role.",
      };
    }

    const target = await client
      .from("profiles")
      .select("id, role")
      .eq("id", parsed.data.targetProfileId)
      .single();

    if (target.error || !target.data) {
      return {
        ok: false,
        code: "TARGET_UNAVAILABLE",
        message: "The selected account is unavailable.",
      };
    }
    if (target.data.role !== "user") {
      return {
        ok: false,
        code: "STALE_TARGET",
        message: "This account is no longer awaiting owner/agent approval.",
      };
    }

    const result = await client.rpc("set_user_role", {
      p_target_id: parsed.data.targetProfileId,
      p_role: "owner_agent",
      p_reason: parsed.data.reason,
    });
    if (result.error) {
      return result.error.code === "42501"
        ? {
            ok: false,
            code: "FORBIDDEN",
            message: "The role change was not authorized.",
          }
        : {
            ok: false,
            code: "RETRYABLE",
            message: "The role change could not be completed.",
          };
    }

    revalidatePath("/admin/users");
    return { ok: true, message: "Owner/agent access approved." };
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationFailure(error);
    return {
      ok: false,
      code: "RETRYABLE",
      message: "The role change could not be completed.",
    };
  }
}

function listingAuthorizationFailure(error: AuthorizationError): ListingModerationActionState {
  if (error.code === "AUTH_REQUIRED") return { ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." };
  if (error.code === "MFA_REQUIRED") return { ok: false, code: "MFA_REQUIRED", message: "Verify your administrator MFA session before moderating listings." };
  return { ok: false, code: "FORBIDDEN", message: "Administrator access is required." };
}

export async function moderateListing(
  _state: ListingModerationActionState,
  formData: FormData,
): Promise<ListingModerationActionState> {
  try {
    const client = await createServerClient();
    await requireAal2Admin({ client });
    const parsed = listingModerationSchema.safeParse({
      intent: formData.get("intent"), revisionId: formData.get("revisionId"), propertyId: formData.get("propertyId"),
      notes: formData.get("notes") ?? "", badge: formData.get("badge") || undefined, reason: formData.get("reason") ?? "",
    });
    if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the moderation details.", fieldErrors: parsed.error.flatten().fieldErrors };

    const value = parsed.data;
    const operation = value.intent === "approve"
      ? { name: "approve_listing" as const, args: { p_revision_id: value.revisionId, p_notes: value.notes || null }, message: "Listing approved." }
      : value.intent === "reject"
        ? { name: "reject_listing" as const, args: { p_revision_id: value.revisionId, p_notes: value.notes }, message: "Listing rejected with an audit note." }
        : value.intent === "publish"
          ? { name: "publish_listing" as const, args: { p_revision_id: value.revisionId }, message: "Listing published." }
          : value.intent === "archive"
            ? { name: "archive_listing" as const, args: { p_property_id: value.propertyId }, message: "Property archived." }
            : { name: "set_listing_badge" as const, args: { p_revision_id: value.revisionId, p_badge: value.badge!, p_reason: value.reason }, message: "Listing badge updated." };
    const result = await client.rpc(operation.name, operation.args);
    if (result.error) {
      if (result.error.code === "42501") return { ok: false, code: "FORBIDDEN", message: "This moderation action was not authorized." };
      if (result.error.code === "P0001" || result.error.code === "P0002") return { ok: false, code: "CONFLICT", message: "The listing state changed. Refresh before deciding again." };
      if (result.error.code === "23514") return { ok: false, code: "VALIDATION", message: "The moderation details do not meet the required rules." };
      return { ok: false, code: "RETRYABLE", message: "The moderation action could not be completed." };
    }
    revalidatePath("/admin/listings");
    revalidatePath(`/admin/listings/${value.revisionId}`);
    if (value.intent === "publish" || value.intent === "archive" || value.intent === "badge") revalidatePath("/");
    return { ok: true, message: operation.message };
  } catch (error) {
    if (error instanceof AuthorizationError) return listingAuthorizationFailure(error);
    return { ok: false, code: "RETRYABLE", message: "The moderation action could not be completed." };
  }
}
