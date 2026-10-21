import { z } from "zod";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const nagpurLatitude = z.coerce.number().min(20.8).max(21.5);
const nagpurLongitude = z.coerce.number().min(78.7).max(79.5);

export const propertyDraftSchema = z.object({
  title: trimmed(5, 120),
  description: z.string().trim().max(5000),
  listingIntent: z.enum(["buy", "rent"]),
  propertyType: z.enum(["apartment", "villa", "independent_house", "plot"]),
  priceInr: z.coerce.number().int().positive().max(10_000_000_000),
  locality: trimmed(2, 100), city: z.literal("Nagpur"), state: z.literal("Maharashtra"),
  postalCode: z.string().trim().regex(/^44\d{4}$/).or(z.literal("")),
  latitude: nagpurLatitude, longitude: nagpurLongitude,
  bedrooms: z.coerce.number().int().min(0).max(20), bathrooms: z.coerce.number().int().min(0).max(20),
  areaSqFt: z.coerce.number().int().positive().max(1_000_000),
  constructionStatus: z.enum(["ready_to_move", "under_construction"]),
  reraApproved: z.coerce.boolean(), reraNumber: z.string().trim().max(80),
  updatedAt: z.string().datetime().optional(),
}).superRefine((value, context) => {
  if (value.propertyType === "plot" && value.bedrooms !== 0)
    context.addIssue({ code: "custom", path: ["bedrooms"], message: "Plots cannot have bedrooms." });
  if (value.propertyType === "plot" && value.bathrooms !== 0)
    context.addIssue({ code: "custom", path: ["bathrooms"], message: "Plots cannot have bathrooms." });
  if (value.reraApproved && !value.reraNumber)
    context.addIssue({ code: "custom", path: ["reraNumber"], message: "Enter the RERA number." });
});

export const imageInputSchema = z.object({
  name: z.string().min(1).max(255).refine((name) => !/[\\/\0]/u.test(name) && name !== "." && name !== ".."),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.coerce.number().int().positive().max(5 * 1024 * 1024),
  altText: trimmed(3, 180), position: z.coerce.number().int().min(0).max(11),
});

export type PropertyDraftInput = z.infer<typeof propertyDraftSchema>;
export type PropertyImageInput = z.infer<typeof imageInputSchema>;

export function propertyDraftFromFormData(formData: FormData) {
  return propertyDraftSchema.safeParse({
    title: formData.get("title"), description: formData.get("description"),
    listingIntent: formData.get("listingIntent"), propertyType: formData.get("propertyType"),
    priceInr: formData.get("priceInr"), locality: formData.get("locality"), city: "Nagpur", state: "Maharashtra",
    postalCode: formData.get("postalCode") ?? "", latitude: formData.get("latitude"), longitude: formData.get("longitude"),
    bedrooms: formData.get("bedrooms"), bathrooms: formData.get("bathrooms"), areaSqFt: formData.get("areaSqFt"),
    constructionStatus: formData.get("constructionStatus"), reraApproved: formData.get("reraApproved") === "on",
    reraNumber: formData.get("reraNumber") ?? "", updatedAt: formData.get("updatedAt") || undefined,
  });
}
