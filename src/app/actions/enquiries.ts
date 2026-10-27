"use server";

import { revalidatePath } from "next/cache";
import {
  AuthorizationError,
  hasRecentMfa,
  requireUser,
} from "@/features/auth/authorization";
import { enquiryFromFormData } from "@/features/enquiries/schema";
import { createEnquiryService, type EnquiryResult } from "@/features/enquiries/service";
import { createServerClient } from "@/lib/supabase/server";

export async function createEnquiryAction(_state: EnquiryResult, formData: FormData): Promise<EnquiryResult> {
  const parsed = enquiryFromFormData(formData);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const client = await createServerClient();
  return createEnquiryService(client as never, { enabled: process.env.SAT12_ENQUIRIES_ENABLED === "true" }).submit(parsed.data);
}

export async function updateEnquiryStatusAction(_state: EnquiryResult, formData: FormData): Promise<EnquiryResult> {
  try {
    const principal = await requireUser();
    const isAuthorized =
      principal.role === "owner_agent" ||
      (principal.role === "admin" && hasRecentMfa(principal));
    if (!isAuthorized) throw new AuthorizationError("ROLE_REQUIRED");
    const client = await createServerClient();
    const result = await createEnquiryService(client as never, { enabled: true }).updateStatus(String(formData.get("enquiryId") ?? ""), formData.get("status"));
    if (result.ok) revalidatePath("/dashboard/enquiries");
    return result;
  } catch {
    return { ok: false, code: "FORBIDDEN", message: "You cannot update this enquiry." };
  }
}
