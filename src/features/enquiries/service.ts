import "server-only";
import { z } from "zod";
import { enquiryInputSchema, enquiryStatusSchema, type EnquiryInput } from "./schema";

export type EnquiryResult = {
  ok: boolean;
  code: "SUCCESS" | "VALIDATION" | "PROPERTY_UNAVAILABLE" | "DUPLICATE" | "RATE_LIMITED" | "BACKEND_UNAVAILABLE" | "FORBIDDEN" | "SUBMISSION_FAILED";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

interface EnquiryClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }>;
}

const messages: Record<EnquiryResult["code"], string> = {
  SUCCESS: "Your enquiry was sent securely.",
  VALIDATION: "Check the highlighted fields.",
  PROPERTY_UNAVAILABLE: "This property is no longer accepting enquiries.",
  DUPLICATE: "This enquiry was already received recently.",
  RATE_LIMITED: "Too many enquiries were sent recently. Please try again later.",
  BACKEND_UNAVAILABLE: "Enquiries are not available yet. No information was stored.",
  FORBIDDEN: "You cannot update this enquiry.",
  SUBMISSION_FAILED: "We could not process the enquiry. No success was assumed.",
};

function failure(code: EnquiryResult["code"], fieldErrors?: Record<string, string[]>): EnquiryResult {
  return { ok: false, code, message: messages[code], ...(fieldErrors ? { fieldErrors } : {}) };
}

function classify(error: { message?: string } | null): EnquiryResult {
  const value = error?.message ?? "";
  if (value.includes("SAT12_ENQUIRY_PROPERTY_UNAVAILABLE")) return failure("PROPERTY_UNAVAILABLE");
  if (value.includes("SAT12_ENQUIRY_DUPLICATE")) return failure("DUPLICATE");
  if (value.includes("SAT12_ENQUIRY_RATE_LIMITED")) return failure("RATE_LIMITED");
  if (value.includes("SAT12_ENQUIRY_BACKEND_UNAVAILABLE")) return failure("BACKEND_UNAVAILABLE");
  if (value.includes("SAT12_ENQUIRY_FORBIDDEN") || value.includes("SAT12_AUTH_REQUIRED")) return failure("FORBIDDEN");
  return failure("SUBMISSION_FAILED");
}

export function createEnquiryService(client: EnquiryClient, options: { enabled: boolean }) {
  return {
    async submit(input: EnquiryInput): Promise<EnquiryResult> {
      const parsed = enquiryInputSchema.safeParse(input);
      if (!parsed.success) return failure("VALIDATION", parsed.error.flatten().fieldErrors as Record<string, string[]>);
      if (!options.enabled) return failure("BACKEND_UNAVAILABLE");
      const { propertyId, name, email, phone, message } = parsed.data;
      const { data, error } = await client.rpc("submit_property_enquiry", {
        p_property_id: propertyId, p_name: name, p_email: email, p_phone: phone, p_message: message,
      });
      if (error || typeof data !== "string" || !z.string().uuid().safeParse(data).success) return classify(error);
      return { ok: true, code: "SUCCESS", message: messages.SUCCESS };
    },
    async updateStatus(enquiryId: string, status: unknown): Promise<EnquiryResult> {
      const parsed = z.object({ enquiryId: z.string().uuid(), status: enquiryStatusSchema }).safeParse({ enquiryId, status });
      if (!parsed.success) return failure("VALIDATION");
      const { error } = await client.rpc("update_enquiry_status", { p_enquiry_id: parsed.data.enquiryId, p_status: parsed.data.status });
      if (error) return classify(error);
      return { ok: true, code: "SUCCESS", message: "Enquiry status updated." };
    },
  };
}
