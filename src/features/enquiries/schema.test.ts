import { describe, expect, it } from "vitest";
import { enquiryInputSchema, enquiryStatusSchema } from "./schema";

const valid = {
  propertyId: "11111111-1111-4111-8111-111111111111",
  name: " Dev Buyer ", email: " DEV@example.com ", phone: "+91 98765 43210",
  message: "I would like to arrange a viewing this weekend.", website: "",
};

describe("enquiry validation", () => {
  it("normalizes minimal buyer data", () => {
    expect(enquiryInputSchema.parse(valid)).toEqual({
      ...valid, name: "Dev Buyer", email: "dev@example.com", phone: "+91 98765 43210",
    });
  });

  it.each([
    [{ propertyId: "not-a-uuid" }, "propertyId"],
    [{ name: "D" }, "name"],
    [{ email: "invalid" }, "email"],
    [{ phone: "12" }, "phone"],
    [{ message: "Too short" }, "message"],
    [{ message: "x".repeat(2001) }, "message"],
    [{ website: "bot.example" }, "website"],
  ])("rejects unsafe input affecting %s", (change, field) => {
    const result = enquiryInputSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors[field as keyof typeof valid]).toBeDefined();
  });

  it("accepts only owner-manageable statuses", () => {
    expect(enquiryStatusSchema.safeParse("contacted").success).toBe(true);
    expect(enquiryStatusSchema.safeParse("spam").success).toBe(false);
  });
});
