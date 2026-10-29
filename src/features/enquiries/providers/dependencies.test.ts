import { beforeEach, describe, expect, it, vi } from "vitest";

const upstash = vi.hoisted(() => ({
  eval: vi.fn(async (
    script: string,
    keys: string[],
    args: Array<string | number>,
  ) => {
    void [script, keys, args];
    return [1, 1, 1];
  }),
  constructor: vi.fn((configuration: unknown) => {
    void configuration;
  }),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class Redis {
    constructor(configuration: unknown) {
      upstash.constructor(configuration);
    }

    eval(script: string, keys: string[], args: Array<string | number>) {
      return upstash.eval(script, keys, args);
    }
  },
}));

import { ENQUIRY_RATE_LIMIT_POLICY } from "../abuse-protection";
import { createEnquiryAbuseDependencies } from "./dependencies";

const completeEnvironment = {
  SAT12_ENQUIRY_ABUSE_PROVIDER: "vercel-upstash",
  SAT12_RATE_LIMIT_HMAC_KEY: Buffer.alloc(32, 9).toString("base64"),
  SAT12_RATE_LIMIT_HMAC_KEY_VERSION: "v1",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "placeholder-token-without-real-credentials",
  VERCEL: "1",
  VERCEL_ENV: "production",
} as const;

describe("enquiry abuse dependency factory", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["missing provider", { ...completeEnvironment, SAT12_ENQUIRY_ABUSE_PROVIDER: undefined }],
    ["wrong provider", { ...completeEnvironment, SAT12_ENQUIRY_ABUSE_PROVIDER: "other" }],
    ["preview runtime", { ...completeEnvironment, VERCEL_ENV: "preview" }],
    ["missing Redis URL", { ...completeEnvironment, UPSTASH_REDIS_REST_URL: undefined }],
    ["non-HTTPS Redis URL", { ...completeEnvironment, UPSTASH_REDIS_REST_URL: "http://example.upstash.io" }],
    ["unexpected Redis host", { ...completeEnvironment, UPSTASH_REDIS_REST_URL: "https://example.com" }],
    ["missing Redis token", { ...completeEnvironment, UPSTASH_REDIS_REST_TOKEN: undefined }],
    ["missing HMAC key", { ...completeEnvironment, SAT12_RATE_LIMIT_HMAC_KEY: undefined }],
    ["invalid HMAC version", { ...completeEnvironment, SAT12_RATE_LIMIT_HMAC_KEY_VERSION: "INVALID VERSION" }],
  ])("keeps providers fail closed for %s", async (_name, environment) => {
    const dependencies = createEnquiryAbuseDependencies(environment);

    await expect(dependencies.resolver.resolve(new Headers({
      "x-vercel-forwarded-for": "8.8.8.8",
    }))).resolves.toMatchObject({ status: "unavailable" });
    await expect(dependencies.keyDeriver.derive("8.8.8.8")).resolves.toMatchObject({
      status: "unavailable",
    });
    expect(upstash.constructor).not.toHaveBeenCalled();
  });

  it("constructs configured adapters without exposing secret values", async () => {
    const dependencies = createEnquiryAbuseDependencies(completeEnvironment);

    await expect(dependencies.resolver.resolve(new Headers({
      "x-vercel-forwarded-for": "8.8.8.8",
    }))).resolves.toEqual({ status: "trusted", ip: "8.8.8.8" });
    await expect(dependencies.keyDeriver.derive("8.8.8.8")).resolves.toMatchObject({
      status: "derived",
      key: expect.not.stringContaining("8.8.8.8"),
    });
    await expect(dependencies.limiter.consume({
      mode: "atomic-all-windows",
      subjectKey: "opaque",
      policy: ENQUIRY_RATE_LIMIT_POLICY,
    })).resolves.toEqual({ status: "allowed" });
    expect(upstash.constructor).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(dependencies)).not.toContain(completeEnvironment.UPSTASH_REDIS_REST_TOKEN);
    expect(JSON.stringify(dependencies)).not.toContain(completeEnvironment.SAT12_RATE_LIMIT_HMAC_KEY);
  });
});
