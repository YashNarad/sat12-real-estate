import { describe, expect, it, vi } from "vitest";

import {
  ENQUIRY_RATE_LIMIT_POLICY,
  type AtomicRateLimitRequest,
} from "./abuse-protection";
import type { EnquiryInput } from "./schema";
import type { EnquiryResult } from "./service";
import { submitPublicEnquiry } from "./submission";

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

function harness() {
  const resolver = { resolve: vi.fn(async () => ({ status: "trusted" as const, ip: "198.51.100.10" })) };
  const keyDeriver = { derive: vi.fn(async () => ({ status: "derived" as const, key: "opaque-key" })) };
  const limiter = { consume: vi.fn(async (request: AtomicRateLimitRequest) => {
    void request;
    return { status: "allowed" as const };
  }) };
  const metrics = { record: vi.fn(async () => undefined) };
  const submit = vi.fn<(input: EnquiryInput) => Promise<EnquiryResult>>(async () => ({
    ok: true,
    code: "SUCCESS",
    message: "Sent.",
  }));
  return { resolver, keyDeriver, limiter, metrics, submit };
}

describe("public enquiry submission boundary", () => {
  it("stops at the disabled application gate without reading request identity", async () => {
    const deps = harness();

    await expect(submitPublicEnquiry({
      enabled: false,
      headers: new Headers({ "x-forwarded-for": "198.51.100.10" }),
      formData: form(),
      dependencies: deps,
      submit: deps.submit,
    })).resolves.toMatchObject({ ok: false, code: "BACKEND_UNAVAILABLE" });
    expect(deps.resolver.resolve).not.toHaveBeenCalled();
    expect(deps.limiter.consume).not.toHaveBeenCalled();
    expect(deps.submit).not.toHaveBeenCalled();
    expect(deps.metrics.record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "disabled",
      reason: "application_disabled",
    }));
  });

  it("consumes an attempt before rejecting invalid or honeypot input", async () => {
    const deps = harness();

    await expect(submitPublicEnquiry({
      enabled: true,
      headers: new Headers(),
      formData: form({ website: "bot.example" }),
      dependencies: deps,
      submit: deps.submit,
    })).resolves.toMatchObject({ ok: false, code: "VALIDATION" });
    expect(deps.limiter.consume).toHaveBeenCalledTimes(1);
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "limited" }, "RATE_LIMITED"],
    [{ status: "unavailable", reason: "provider-unavailable" }, "BACKEND_UNAVAILABLE"],
  ] as const)("never reaches persistence after abuse denial", async (result, code) => {
    const deps = harness();
    deps.limiter.consume.mockResolvedValueOnce(result as never);

    await expect(submitPublicEnquiry({
      enabled: true,
      headers: new Headers(),
      formData: form(),
      dependencies: deps,
      submit: deps.submit,
    })).resolves.toMatchObject({ ok: false, code });
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["DUPLICATE", "This enquiry was already received recently."],
    ["SUBMISSION_FAILED", "We could not process the enquiry. No success was assumed."],
  ] as const)("does not refund a consumed attempt after downstream %s", async (code, message) => {
    const deps = harness();
    deps.submit.mockResolvedValueOnce({
      ok: false,
      code,
      message,
    });

    await expect(submitPublicEnquiry({
      enabled: true,
      headers: new Headers(),
      formData: form(),
      dependencies: deps,
      submit: deps.submit,
    })).resolves.toMatchObject({ ok: false, code });
    expect(deps.limiter.consume).toHaveBeenCalledTimes(1);
    expect(deps.submit).toHaveBeenCalledTimes(1);
  });

  it("passes normalized validated data only after abuse protection allows", async () => {
    const deps = harness();
    const data = form({ email: " DEV@EXAMPLE.COM " });
    data.set("recipientId", "attacker-controlled");

    await expect(submitPublicEnquiry({
      enabled: true,
      headers: new Headers(),
      formData: data,
      dependencies: deps,
      submit: deps.submit,
    })).resolves.toMatchObject({ ok: true });
    expect(deps.submit).toHaveBeenCalledWith(expect.objectContaining({ email: "dev@example.com" }));
    expect(JSON.stringify(deps.submit.mock.calls)).not.toContain("attacker-controlled");
  });

  it("requires one atomic all-window operation per concurrent attempt", async () => {
    const deps = harness();

    await Promise.all([
      submitPublicEnquiry({ enabled: true, headers: new Headers(), formData: form(), dependencies: deps, submit: deps.submit }),
      submitPublicEnquiry({ enabled: true, headers: new Headers(), formData: form(), dependencies: deps, submit: deps.submit }),
    ]);

    expect(deps.limiter.consume).toHaveBeenCalledTimes(2);
    for (const [request] of deps.limiter.consume.mock.calls) {
      expect(request).toEqual({
        mode: "atomic-all-windows",
        subjectKey: "opaque-key",
        policy: ENQUIRY_RATE_LIMIT_POLICY,
      });
    }
  });
});
