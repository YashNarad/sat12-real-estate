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

export const initialAdminRoleActionState: AdminRoleActionState = {
  ok: false,
  message: "",
};

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
