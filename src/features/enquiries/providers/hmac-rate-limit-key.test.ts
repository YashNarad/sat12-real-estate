import { describe, expect, it } from "vitest";

import { createHmacRateLimitKeyDeriver } from "./hmac-rate-limit-key";

const secret = Buffer.alloc(32, 7).toString("base64");

describe("HMAC rate-limit key derivation", () => {
  it("derives deterministic purpose- and version-scoped opaque keys", async () => {
    const deriver = createHmacRateLimitKeyDeriver({ secret, keyVersion: "v1" });

    const first = await deriver.derive("8.8.8.8");
    const second = await deriver.derive("8.8.8.8");

    expect(first).toEqual(second);
    expect(first).toEqual({
      status: "derived",
      key: expect.stringMatching(/^sat12:enquiry-ip:v1:[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(first)).not.toContain("8.8.8.8");
    expect(JSON.stringify(first)).not.toContain(secret);
  });

  it("separates different identities and key versions", async () => {
    const v1 = createHmacRateLimitKeyDeriver({ secret, keyVersion: "v1" });
    const v2 = createHmacRateLimitKeyDeriver({ secret, keyVersion: "v2" });

    const firstIp = await v1.derive("8.8.8.8");
    const secondIp = await v1.derive("1.1.1.1");
    const nextVersion = await v2.derive("8.8.8.8");

    expect(firstIp).not.toEqual(secondIp);
    expect(firstIp).not.toEqual(nextVersion);
  });

  it.each([
    { secret: "", keyVersion: "v1" },
    { secret: Buffer.alloc(16).toString("base64"), keyVersion: "v1" },
    { secret: "not-base64!", keyVersion: "v1" },
    { secret, keyVersion: "" },
    { secret, keyVersion: "INVALID VERSION" },
    { secret, keyVersion: "way-too-long-version" },
  ])("fails closed for invalid key configuration %#", async (configuration) => {
    const deriver = createHmacRateLimitKeyDeriver(configuration);

    await expect(deriver.derive("8.8.8.8")).resolves.toEqual({
      status: "unavailable",
      reason: "unconfigured",
    });
  });
});
