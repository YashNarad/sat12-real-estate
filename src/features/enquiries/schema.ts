import { z } from "zod";

const trimmed = (minimum: number, maximum: number, label: string) => z.string().trim()
  .min(minimum, `${label} must be at least ${minimum} characters.`)
  .max(maximum, `${label} must be at most ${maximum} characters.`);

export const enquiryInputSchema = z.object({
  propertyId: z.string().uuid("Choose a valid property."),
  name: trimmed(2, 100, "Full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(320),
  phone: z.string().trim().max(20, "Phone number must be at most 20 characters.")
    .refine((value) => value === "" || /^[+()\-\s0-9]{7,20}$/u.test(value), "Enter a valid phone number."),
  message: trimmed(10, 2000, "Message"),
  website: z.string().max(0, "Submission could not be accepted."),
}).strict();

export const enquiryStatusSchema = z.enum(["new", "contacted", "closed"]);
export type EnquiryInput = z.infer<typeof enquiryInputSchema>;
export type EnquiryStatus = z.infer<typeof enquiryStatusSchema>;

export function enquiryFromFormData(formData: FormData) {
  return enquiryInputSchema.safeParse({
    propertyId: formData.get("propertyId"), name: formData.get("name"),
    email: formData.get("email"), phone: formData.get("phone") ?? "",
    message: formData.get("message"), website: formData.get("website") ?? "",
  });
}
