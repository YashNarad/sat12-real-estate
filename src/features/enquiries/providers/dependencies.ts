import "server-only";

import { Redis } from "@upstash/redis";

import {
  noOpEnquiryAbuseMetrics,
  type EnquiryAbuseDependencies,
  unconfiguredDistributedRateLimiter,
  unconfiguredRateLimitKeyDeriver,
  unconfiguredTrustedClientIpResolver,
} from "../abuse-protection";
import { createHmacRateLimitKeyDeriver } from "./hmac-rate-limit-key";
import { createUpstashDistributedRateLimiter } from "./upstash-distributed-rate-limiter";
import { createVercelTrustedClientIpResolver } from "./vercel-trusted-client-ip";

export const unconfiguredDependencies: EnquiryAbuseDependencies = {
  resolver: unconfiguredTrustedClientIpResolver,
  keyDeriver: unconfiguredRateLimitKeyDeriver,
  limiter: unconfiguredDistributedRateLimiter,
  metrics: noOpEnquiryAbuseMetrics,
};

type ProviderEnvironment = Readonly<Record<string, string | undefined>>;

export type EnquiryAbuseDependenciesOptions = {
  readonly injected?: EnquiryAbuseDependencies;
};

function validConfiguration(environment: ProviderEnvironment) {
  if (
    environment.SAT12_ENQUIRY_ABUSE_PROVIDER !== "vercel-upstash" ||
    environment.VERCEL !== "1" ||
    environment.VERCEL_ENV !== "production" ||
    !environment.UPSTASH_REDIS_REST_URL ||
    !environment.UPSTASH_REDIS_REST_TOKEN ||
    !environment.SAT12_RATE_LIMIT_HMAC_KEY ||
    !environment.SAT12_RATE_LIMIT_HMAC_KEY_VERSION
  ) {
    return false;
  }

  try {
    const url = new URL(environment.UPSTASH_REDIS_REST_URL);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".upstash.io")) return false;
    const secret = environment.SAT12_RATE_LIMIT_HMAC_KEY;
    if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(secret) || secret.length % 4 !== 0) return false;
    if (Buffer.from(secret, "base64").length !== 32) return false;
    return /^[a-z0-9-]{1,16}$/u.test(environment.SAT12_RATE_LIMIT_HMAC_KEY_VERSION);
  } catch {
    return false;
  }
}

export function createEnquiryAbuseDependencies(
  environment: ProviderEnvironment = process.env,
  options?: EnquiryAbuseDependenciesOptions,
): EnquiryAbuseDependencies {
  if (options?.injected) {
    if (
      environment.NODE_ENV === "production" ||
      environment.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production"
    ) {
      throw new Error(
        "SAT12_ENQUIRY_INJECTED_DEPENDENCIES_FORBIDDEN_IN_PRODUCTION",
      );
    }
    return options.injected;
  }

  if (!validConfiguration(environment)) return unconfiguredDependencies;

  const redis = new Redis({
    url: environment.UPSTASH_REDIS_REST_URL!,
    token: environment.UPSTASH_REDIS_REST_TOKEN!,
  });

  return {
    resolver: createVercelTrustedClientIpResolver(environment),
    keyDeriver: createHmacRateLimitKeyDeriver({
      secret: environment.SAT12_RATE_LIMIT_HMAC_KEY!,
      keyVersion: environment.SAT12_RATE_LIMIT_HMAC_KEY_VERSION!,
    }),
    limiter: createUpstashDistributedRateLimiter({
      transport: redis,
      timeoutMs: 750,
    }),
    metrics: noOpEnquiryAbuseMetrics,
  };
}
