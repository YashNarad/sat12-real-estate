import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ rpc: vi.fn(), role: "owner_agent", aal: "aal1", mfaVerifiedAt: null as number | null }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => ({ rpc: harness.rpc })) }));
vi.mock("@/features/auth/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireUser: vi.fn(async () => ({ role: harness.role, aal: harness.aal, mfaVerifiedAt: harness.mfaVerifiedAt })),
  hasRecentMfa: vi.fn((principal) => principal.aal === "aal2" && principal.mfaVerifiedAt !== null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createEnquiryAction, updateEnquiryStatusAction } from "./enquiries";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ propertyId: "11111111-1111-4111-8111-111111111111", name: "Dev Buyer", email: "dev@example.com", phone: "", message: "Please arrange a viewing this weekend.", website: "", ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("enquiry actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.role = "owner_agent";
    harness.aal = "aal1";
    harness.mfaVerifiedAt = null;
    process.env.SAT12_ENQUIRIES_ENABLED = "true";
  });

  it("validates and sends a public enquiry without accepting recipient fields", async () => {
    harness.rpc.mockResolvedValue({ data: "22222222-2222-4222-8222-222222222222", error: null });
    const data = form({ recipientId: "attacker" });
    await expect(createEnquiryAction({ ok: false, code: "VALIDATION", message: "" }, data)).resolves.toMatchObject({ ok: true });
    expect(JSON.stringify(harness.rpc.mock.calls)).not.toContain("attacker");
  });

  it("rejects honeypot and oversized invalid input without an RPC", async () => {
    await expect(createEnquiryAction({ ok: false, code: "VALIDATION", message: "" }, form({ website: "bot.example" }))).resolves.toMatchObject({ ok: false, code: "VALIDATION" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("reports the backend disabled without persisting buyer information", async () => {
    delete process.env.SAT12_ENQUIRIES_ENABLED;
    await expect(createEnquiryAction({ ok: false, code: "VALIDATION", message: "" }, form())).resolves.toMatchObject({ ok: false, code: "BACKEND_UNAVAILABLE" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("requires an owner role again inside the status action", async () => {
    harness.role = "user";
    const data = new FormData(); data.set("enquiryId", "22222222-2222-4222-8222-222222222222"); data.set("status", "closed");
    await expect(updateEnquiryStatusAction({ ok: false, code: "VALIDATION", message: "" }, data)).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("requires recent AAL2 before an administrator can update status", async () => {
    harness.role = "admin";
    const data = new FormData(); data.set("enquiryId", "22222222-2222-4222-8222-222222222222"); data.set("status", "closed");
    await expect(updateEnquiryStatusAction({ ok: false, code: "VALIDATION", message: "" }, data)).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("allows an AAL2 administrator to use the audited status RPC", async () => {
    harness.role = "admin";
    harness.aal = "aal2";
    harness.mfaVerifiedAt = Math.floor(Date.now() / 1000);
    harness.rpc.mockResolvedValue({ data: "22222222-2222-4222-8222-222222222222", error: null });
    const data = new FormData(); data.set("enquiryId", "22222222-2222-4222-8222-222222222222"); data.set("status", "contacted");
    await expect(updateEnquiryStatusAction({ ok: false, code: "VALIDATION", message: "" }, data)).resolves.toMatchObject({ ok: true });
    expect(harness.rpc).toHaveBeenCalledTimes(1);
  });
});
