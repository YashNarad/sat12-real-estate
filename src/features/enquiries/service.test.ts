import { describe, expect, it, vi } from "vitest";
import { createEnquiryService } from "./service";

const valid = {
  propertyId: "11111111-1111-4111-8111-111111111111", name: "Dev Buyer",
  email: "dev@example.com", phone: "+91 98765 43210",
  message: "Please arrange a viewing this weekend.", website: "",
};

function client(error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: error ? null : "22222222-2222-4222-8222-222222222222", error });
  return { rpc, value: { rpc } };
}

describe("enquiry service", () => {
  it("submits only buyer fields and the stable property ID", async () => {
    const harness = client();
    await expect(createEnquiryService(harness.value, { enabled: true }).submit(valid)).resolves.toMatchObject({ ok: true });
    expect(harness.rpc).toHaveBeenCalledWith("submit_property_enquiry", {
      p_property_id: valid.propertyId, p_name: valid.name, p_email: valid.email,
      p_phone: valid.phone, p_message: valid.message,
    });
    expect(JSON.stringify(harness.rpc.mock.calls)).not.toContain("recipient");
  });

  it("fails closed without calling the database while production submission is disabled", async () => {
    const harness = client();
    await expect(createEnquiryService(harness.value, { enabled: false }).submit(valid)).resolves.toMatchObject({ ok: false, code: "BACKEND_UNAVAILABLE" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["SAT12_ENQUIRY_PROPERTY_UNAVAILABLE", "PROPERTY_UNAVAILABLE"],
    ["SAT12_ENQUIRY_DUPLICATE", "DUPLICATE"],
    ["SAT12_ENQUIRY_RATE_LIMITED", "RATE_LIMITED"],
    ["SAT12_ENQUIRY_BACKEND_UNAVAILABLE", "BACKEND_UNAVAILABLE"],
    ["private SQL and identifiers", "SUBMISSION_FAILED"],
  ])("maps database failure safely", async (message, code) => {
    const harness = client({ message });
    const result = await createEnquiryService(harness.value, { enabled: true }).submit(valid);
    expect(result).toMatchObject({ ok: false, code });
    expect(JSON.stringify(result)).not.toContain("private SQL");
  });

  it("updates only an allowed status through the guarded RPC", async () => {
    const harness = client();
    const result = await createEnquiryService(harness.value, { enabled: true }).updateStatus("22222222-2222-4222-8222-222222222222", "closed");
    expect(result).toMatchObject({ ok: true });
    expect(harness.rpc).toHaveBeenCalledWith("update_enquiry_status", { p_enquiry_id: "22222222-2222-4222-8222-222222222222", p_status: "closed" });
  });

  it("rejects invalid IDs and statuses before the database", async () => {
    const harness = client();
    await expect(createEnquiryService(harness.value, { enabled: true }).updateStatus("bad", "spam")).resolves.toMatchObject({ ok: false, code: "VALIDATION" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});
