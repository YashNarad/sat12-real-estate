import { describe, expect, it, vi } from "vitest";

import {
  ENQUIRY_RATE_LIMIT_POLICY,
  enforceEnquiryAbuseProtection,
  type EnquiryAbuseMetric,
  unconfiguredDistributedRateLimiter,
  unconfiguredRateLimitKeyDeriver,
  unconfiguredTrustedClientIpResolver,
} from "./abuse-protection";

describe("enquiry abuse-protection contracts", () => {
  it("does not trust forwarding headers without a hosting adapter", async () => {
    const headers = new Headers({
      forwarded: "for=198.51.100.10",
      "x-forwarded-for": "198.51.100.10",
      "x-real-ip": "198.51.100.10",
    });

    await expect(unconfiguredTrustedClientIpResolver.resolve(headers)).resolves.toEqual({
      status: "unavailable",
      reason: "unconfigured",
    });
  });

  it("does not inspect any header accessor while unconfigured", async () => {
    const headers = new Proxy(new Headers(), {
      get() {
        throw new Error("headers must remain unread");
      },
    });

    await expect(unconfiguredTrustedClientIpResolver.resolve(headers)).resolves.toEqual({
      status: "unavailable",
      reason: "unconfigured",
    });
  });

  it("keeps key derivation and distributed enforcement unavailable by default", async () => {
    await expect(unconfiguredRateLimitKeyDeriver.derive("198.51.100.10")).resolves.toEqual({
      status: "unavailable",
      reason: "unconfigured",
    });
    await expect(
      unconfiguredDistributedRateLimiter.consume({
        mode: "atomic-all-windows",
        subjectKey: "opaque",
        policy: ENQUIRY_RATE_LIMIT_POLICY,
      }),
    ).resolves.toEqual({ status: "unavailable", reason: "unconfigured" });
  });

  it("defines both approved windows as one immutable atomic policy", () => {
    expect(ENQUIRY_RATE_LIMIT_POLICY).toEqual({
      version: "stage5c-v1",
      windows: [
        { limit: 5, windowSeconds: 600 },
        { limit: 20, windowSeconds: 3600 },
      ],
    });
    expect(Object.isFrozen(ENQUIRY_RATE_LIMIT_POLICY)).toBe(true);
    expect(Object.isFrozen(ENQUIRY_RATE_LIMIT_POLICY.windows)).toBe(true);
  });
});

function dependencies(overrides: Record<string, unknown> = {}) {
  const resolver = { resolve: vi.fn(async () => ({ status: "trusted" as const, ip: "198.51.100.10" })) };
  const keyDeriver = { derive: vi.fn(async () => ({ status: "derived" as const, key: "opaque-key" })) };
  const limiter = { consume: vi.fn(async () => ({ status: "allowed" as const })) };
  const metrics = { record: vi.fn(async (event: EnquiryAbuseMetric) => { void event; }) };
  return { resolver, keyDeriver, limiter, metrics, ...overrides };
}

describe("enquiry abuse-protection enforcement", () => {
  it.each([
    [{ status: "unavailable", reason: "unconfigured" }, "identity_unavailable"],
    [{ status: "invalid", reason: "untrusted-source" }, "identity_invalid"],
  ] as const)("fails closed for an unusable client identity", async (identity, reason) => {
    const deps = dependencies({ resolver: { resolve: vi.fn(async () => identity) } });

    await expect(enforceEnquiryAbuseProtection(new Headers(), deps)).resolves.toEqual({
      allowed: false,
      code: "BACKEND_UNAVAILABLE",
    });
    expect(deps.keyDeriver.derive).not.toHaveBeenCalled();
    expect(deps.limiter.consume).not.toHaveBeenCalled();
    expect(deps.metrics.record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: identity.status === "invalid" ? "invalid_identity" : "unavailable",
      reason,
    }));
  });

  it("fails closed when privacy-safe key derivation is unavailable", async () => {
    const deps = dependencies({
      keyDeriver: { derive: vi.fn(async () => ({ status: "unavailable" as const, reason: "provider-unavailable" as const })) },
    });

    await expect(enforceEnquiryAbuseProtection(new Headers(), deps)).resolves.toEqual({
      allowed: false,
      code: "BACKEND_UNAVAILABLE",
    });
    expect(deps.limiter.consume).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "limited" }, "RATE_LIMITED", "limit_exhausted"],
    [{ status: "unavailable", reason: "provider-unavailable" }, "BACKEND_UNAVAILABLE", "limiter_unavailable"],
    [{ status: "unknown" }, "BACKEND_UNAVAILABLE", "limiter_ambiguous"],
  ] as const)("maps limiter outcomes without exposing internals", async (limiterResult, code, reason) => {
    const deps = dependencies({ limiter: { consume: vi.fn(async () => limiterResult) } });

    await expect(enforceEnquiryAbuseProtection(new Headers(), deps)).resolves.toEqual({ allowed: false, code });
    expect(deps.limiter.consume).toHaveBeenCalledTimes(1);
    expect(deps.limiter.consume).toHaveBeenCalledWith({
      mode: "atomic-all-windows",
      subjectKey: "opaque-key",
      policy: ENQUIRY_RATE_LIMIT_POLICY,
    });
    expect(deps.metrics.record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: limiterResult.status === "limited" ? "limited" : "unavailable",
      reason,
    }));
  });

  it.each(["resolver", "keyDeriver", "limiter"] as const)("fails closed when the %s throws", async (dependency) => {
    const deps = dependencies({
      [dependency]: dependency === "resolver"
        ? { resolve: vi.fn(async () => { throw new Error("provider offline"); }) }
        : dependency === "keyDeriver"
          ? { derive: vi.fn(async () => { throw new Error("provider offline"); }) }
          : { consume: vi.fn(async () => { throw new Error("provider offline"); }) },
    });

    await expect(enforceEnquiryAbuseProtection(new Headers(), deps)).resolves.toEqual({
      allowed: false,
      code: "BACKEND_UNAVAILABLE",
    });
    expect(deps.metrics.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "unavailable" }));
  });

  it("allows only after one atomic multi-window consumption", async () => {
    const deps = dependencies();

    await expect(enforceEnquiryAbuseProtection(new Headers(), deps)).resolves.toEqual({ allowed: true });
    expect(deps.limiter.consume).toHaveBeenCalledTimes(1);
    expect(deps.limiter.consume).toHaveBeenCalledWith(expect.objectContaining({
      mode: "atomic-all-windows",
      policy: ENQUIRY_RATE_LIMIT_POLICY,
    }));
  });

  it("emits only the strict allowlisted metric shape", async () => {
    const deps = dependencies();

    await enforceEnquiryAbuseProtection(new Headers(), deps);

    const event = deps.metrics.record.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(event).sort()).toEqual([
      "event",
      "outcome",
      "policyVersion",
      "reason",
      "route",
      "version",
    ]);
    expect(JSON.stringify(event)).not.toMatch(/198\.51\.100\.10|opaque-key|buyer@example|buyer message|propertyId/iu);
  });

  it("does not let metrics failure change an allowed or denied security decision", async () => {
    const brokenMetrics = { record: vi.fn(async () => { throw new Error("metrics offline"); }) };
    const allowed = dependencies({ metrics: brokenMetrics });
    const denied = dependencies({
      metrics: brokenMetrics,
      limiter: { consume: vi.fn(async () => ({ status: "limited" as const })) },
    });

    await expect(enforceEnquiryAbuseProtection(new Headers(), allowed)).resolves.toEqual({ allowed: true });
    await expect(enforceEnquiryAbuseProtection(new Headers(), denied)).resolves.toEqual({
      allowed: false,
      code: "RATE_LIMITED",
    });
  });
});
