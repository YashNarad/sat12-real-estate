import { describe, expect, it } from "vitest";

import { createVercelTrustedClientIpResolver } from "./vercel-trusted-client-ip";

const productionVercel = { VERCEL: "1", VERCEL_ENV: "production" } as const;

describe("Vercel trusted client IP resolver", () => {
  it("accepts only the Vercel-derived public client address", async () => {
    const resolver = createVercelTrustedClientIpResolver(productionVercel);

    await expect(
      resolver.resolve(
        new Headers({
          "x-vercel-forwarded-for": "8.8.8.8",
          "x-forwarded-for": "1.1.1.1",
          "x-real-ip": "9.9.9.9",
          forwarded: "for=4.4.4.4",
        }),
      ),
    ).resolves.toEqual({ status: "trusted", ip: "8.8.8.8" });
  });

  it.each([
    [{}, "8.8.8.8", "unconfigured"],
    [{ VERCEL: "1", VERCEL_ENV: "preview" }, "8.8.8.8", "unconfigured"],
    [productionVercel, "", "untrusted-source"],
    [productionVercel, "8.8.8.8, 1.1.1.1", "invalid-address"],
    [productionVercel, "not-an-ip", "invalid-address"],
    [productionVercel, "127.0.0.1", "invalid-address"],
    [productionVercel, "10.0.0.1", "invalid-address"],
    [productionVercel, "169.254.1.1", "invalid-address"],
    [productionVercel, "203.0.113.10", "invalid-address"],
    [productionVercel, "ff02::1", "invalid-address"],
    [productionVercel, "fe80::1", "invalid-address"],
    [productionVercel, "::1", "invalid-address"],
    [productionVercel, "fe80::1%eth0", "invalid-address"],
  ] as const)("fails closed for runtime/header %#", async (runtime, value, reason) => {
    const resolver = createVercelTrustedClientIpResolver(runtime);

    await expect(
      resolver.resolve(new Headers({ "x-vercel-forwarded-for": value })),
    ).resolves.toEqual({
      status: reason === "unconfigured" ? "unavailable" : "invalid",
      reason,
    });
  });

  it("fails closed when the Vercel header is missing even if generic forwarding headers exist", async () => {
    const resolver = createVercelTrustedClientIpResolver(productionVercel);

    await expect(
      resolver.resolve(
        new Headers({
          forwarded: "for=8.8.8.8",
          "x-forwarded-for": "8.8.8.8",
          "x-real-ip": "8.8.8.8",
        }),
      ),
    ).resolves.toEqual({ status: "invalid", reason: "untrusted-source" });
  });

  it("normalizes public IPv6 and IPv4-mapped IPv6 consistently", async () => {
    const resolver = createVercelTrustedClientIpResolver(productionVercel);

    await expect(
      resolver.resolve(new Headers({ "x-vercel-forwarded-for": "2001:4860:4860:0:0:0:0:8888" })),
    ).resolves.toEqual({ status: "trusted", ip: "2001:4860:4860::8888" });
    await expect(
      resolver.resolve(new Headers({ "x-vercel-forwarded-for": "::ffff:8.8.8.8" })),
    ).resolves.toEqual({ status: "trusted", ip: "8.8.8.8" });
  });

  it("fails closed if header access throws", async () => {
    const resolver = createVercelTrustedClientIpResolver(productionVercel);
    const headers = new Proxy(new Headers(), {
      get() {
        throw new Error("header provider failed");
      },
    });

    await expect(resolver.resolve(headers)).resolves.toEqual({
      status: "unavailable",
      reason: "provider-unavailable",
    });
  });
});
