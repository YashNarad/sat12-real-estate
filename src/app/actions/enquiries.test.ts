import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  rpc: vi.fn(),
  headers: vi.fn(async () => new Headers()),
  resolver: { resolve: vi.fn(async () => ({ status: "trusted" as const, ip: "198.51.100.10" })) },
  keyDeriver: { derive: vi.fn(async () => ({ status: "derived" as const, key: "opaque-key" })) },
  limiter: { consume: vi.fn(async () => ({ status: "allowed" as const })) },
  metrics: { record: vi.fn(async () => undefined) },
  role: "owner_agent",
  aal: "aal1",
  mfaVerifiedAt: null as number | null,
}));

vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => ({ rpc: harness.rpc })) }));
vi.mock("next/headers", () => ({ headers: harness.headers }));
vi.mock("@/features/auth/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireUser: vi.fn(async () => ({ role: harness.role, aal: harness.aal, mfaVerifiedAt: harness.mfaVerifiedAt })),
  hasRecentMfa: vi.fn((principal) => principal.aal === "aal2" && principal.mfaVerifiedAt !== null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import type { EnquiryAbuseDependencies } from "@/features/enquiries/abuse-protection";
import { createEnquiryAction, updateEnquiryStatusAction } from "./enquiries";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({
    propertyId: "11111111-1111-4111-8111-111111111111",
    name: "Dev Buyer",
    email: "dev@example.com",
    phone: "",
    message: "Please arrange a viewing this weekend.",
    website: "",
    ...overrides,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

function testDependencies(): EnquiryAbuseDependencies {
  return {
    resolver: harness.resolver,
    keyDeriver: harness.keyDeriver,
    limiter: harness.limiter,
    metrics: harness.metrics,
  };
}

describe("enquiry actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.role = "owner_agent";
    harness.aal = "aal1";
    harness.mfaVerifiedAt = null;
    process.env.SAT12_ENQUIRIES_ENABLED = "true";
  });

  it("fails closed before Supabase when production abuse protection is unconfigured", async () => {
    // When no override is passed and environment is not configured for Vercel+Upstash production,
    // the action naturally uses unconfiguredDependencies and fails closed safely.
    await expect(
      createEnquiryAction({ ok: false, code: "VALIDATION", message: "" }, form()),
    ).resolves.toMatchObject({
      ok: false,
      code: "BACKEND_UNAVAILABLE",
    });
    expect(harness.headers).toHaveBeenCalledTimes(1);
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("reports the backend disabled without reading headers or persisting buyer information", async () => {
    delete process.env.SAT12_ENQUIRIES_ENABLED;
    await expect(
      createEnquiryAction({ ok: false, code: "VALIDATION", message: "" }, form()),
    ).resolves.toMatchObject({ ok: false, code: "BACKEND_UNAVAILABLE" });
    expect(harness.headers).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("calls the existing RPC once after configured abuse protection allows", async () => {
    harness.rpc.mockResolvedValueOnce({
      data: "33333333-3333-4333-8333-333333333333",
      error: null,
    });

    await expect(
      createEnquiryAction(
        { ok: false, code: "VALIDATION", message: "" },
        form(),
        testDependencies(),
      ),
    ).resolves.toMatchObject({ ok: true, code: "SUCCESS" });
    expect(harness.limiter.consume).toHaveBeenCalledTimes(1);
    expect(harness.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not retry or refund after a downstream RPC failure", async () => {
    harness.rpc.mockResolvedValueOnce({ data: null, error: { message: "provider failure" } });

    await expect(
      createEnquiryAction(
        { ok: false, code: "VALIDATION", message: "" },
        form(),
        testDependencies(),
      ),
    ).resolves.toMatchObject({ ok: false, code: "SUBMISSION_FAILED" });
    expect(harness.limiter.consume).toHaveBeenCalledTimes(1);
    expect(harness.rpc).toHaveBeenCalledTimes(1);
  });

  it("strictly forbids injected test dependencies in production environments", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      await expect(
        createEnquiryAction(
          { ok: false, code: "VALIDATION", message: "" },
          form(),
          testDependencies(),
        ),
      ).rejects.toThrow("SAT12_ENQUIRY_INJECTED_DEPENDENCIES_FORBIDDEN_IN_PRODUCTION");
      expect(harness.rpc).not.toHaveBeenCalled();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  it("requires an owner role again inside the status action", async () => {
    harness.role = "user";
    const data = new FormData();
    data.set("enquiryId", "22222222-2222-4222-8222-222222222222");
    data.set("status", "closed");
    await expect(
      updateEnquiryStatusAction({ ok: false, code: "VALIDATION", message: "" }, data),
    ).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("requires recent AAL2 before an administrator can update status", async () => {
    harness.role = "admin";
    const data = new FormData();
    data.set("enquiryId", "22222222-2222-4222-8222-222222222222");
    data.set("status", "closed");
    await expect(
      updateEnquiryStatusAction({ ok: false, code: "VALIDATION", message: "" }, data),
    ).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("allows an AAL2 administrator to use the audited status RPC", async () => {
    harness.role = "admin";
    harness.aal = "aal2";
    harness.mfaVerifiedAt = Math.floor(Date.now() / 1000);
    harness.rpc.mockResolvedValue({ data: "22222222-2222-4222-8222-222222222222", error: null });
    const data = new FormData();
    data.set("enquiryId", "22222222-2222-4222-8222-222222222222");
    data.set("status", "contacted");
    await expect(
      updateEnquiryStatusAction({ ok: false, code: "VALIDATION", message: "" }, data),
    ).resolves.toMatchObject({ ok: true });
    expect(harness.rpc).toHaveBeenCalledTimes(1);
  });
});
