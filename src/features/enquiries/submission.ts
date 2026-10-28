import "server-only";

import {
  enforceEnquiryAbuseProtection,
  recordEnquiryAbuseMetric,
  type EnquiryAbuseDependencies,
} from "./abuse-protection";
import { enquiryFromFormData, type EnquiryInput } from "./schema";
import type { EnquiryResult } from "./service";

const backendUnavailable = (): EnquiryResult => ({
  ok: false,
  code: "BACKEND_UNAVAILABLE",
  message: "Enquiries are temporarily unavailable. No information was stored.",
});

const rateLimited = (): EnquiryResult => ({
  ok: false,
  code: "RATE_LIMITED",
  message: "Too many enquiries were sent recently. Please try again later.",
});

type PublicEnquirySubmission = {
  enabled: boolean;
  headers: Headers;
  formData: FormData;
  dependencies: EnquiryAbuseDependencies;
  submit(input: EnquiryInput): Promise<EnquiryResult>;
};

export async function submitPublicEnquiry(input: PublicEnquirySubmission): Promise<EnquiryResult> {
  if (!input.enabled) {
    await recordEnquiryAbuseMetric(input.dependencies.metrics, "disabled", "application_disabled");
    return backendUnavailable();
  }

  const decision = await enforceEnquiryAbuseProtection(input.headers, input.dependencies);
  if (!decision.allowed) {
    return decision.code === "RATE_LIMITED" ? rateLimited() : backendUnavailable();
  }

  const parsed = enquiryFromFormData(input.formData);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  return input.submit(parsed.data);
}
