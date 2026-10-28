"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  AuthorizationError,
  hasRecentMfa,
  requireUser,
} from "@/features/auth/authorization";
import {
  noOpEnquiryAbuseMetrics,
  unconfiguredDistributedRateLimiter,
  unconfiguredRateLimitKeyDeriver,
  unconfiguredTrustedClientIpResolver,
} from "@/features/enquiries/abuse-protection";
import { createEnquiryService, type EnquiryResult } from "@/features/enquiries/service";
import { submitPublicEnquiry } from "@/features/enquiries/submission";
import { createServerClient } from "@/lib/supabase/server";

export async function createEnquiryAction(_state: EnquiryResult, formData: FormData): Promise<EnquiryResult> {
  const enabled = process.env.SAT12_ENQUIRIES_ENABLED === "true";
  const requestHeaders = enabled ? await headers() : new Headers();
  return submitPublicEnquiry({
    enabled,
    headers: requestHeaders,
    formData,
    dependencies: {
      resolver: unconfiguredTrustedClientIpResolver,
      keyDeriver: unconfiguredRateLimitKeyDeriver,
      limiter: unconfiguredDistributedRateLimiter,
      metrics: noOpEnquiryAbuseMetrics,
    },
    submit: async (input) => {
      const client = await createServerClient();
      return createEnquiryService(client as never, { enabled: true }).submit(input);
    },
  });
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
