import "server-only";

export type TrustedClientIpResult =
  | { status: "trusted"; ip: string }
  | { status: "unavailable"; reason: "unconfigured" | "provider-unavailable" }
  | { status: "invalid"; reason: "untrusted-source" | "invalid-address" };

export interface TrustedClientIpResolver {
  resolve(headers: Headers): Promise<TrustedClientIpResult>;
}

export type RateLimitKeyResult =
  | { status: "derived"; key: string }
  | { status: "unavailable"; reason: "unconfigured" | "provider-unavailable" };

export interface RateLimitKeyDeriver {
  derive(trustedIp: string): Promise<RateLimitKeyResult>;
}

export const ENQUIRY_RATE_LIMIT_POLICY = Object.freeze({
  version: "stage5c-v1",
  windows: Object.freeze([
    Object.freeze({ limit: 5, windowSeconds: 600 }),
    Object.freeze({ limit: 20, windowSeconds: 3600 }),
  ]),
});

export type AtomicRateLimitRequest = {
  mode: "atomic-all-windows";
  subjectKey: string;
  policy: typeof ENQUIRY_RATE_LIMIT_POLICY;
};

export type DistributedRateLimitResult =
  | { status: "allowed" }
  | { status: "limited" }
  | { status: "unavailable"; reason: "unconfigured" | "provider-unavailable" };

export interface DistributedRateLimiter {
  consume(request: AtomicRateLimitRequest): Promise<DistributedRateLimitResult>;
}

export type EnquiryAbuseMetric = {
  event: "sat12.enquiry_abuse";
  version: 1;
  route: "public-property-enquiry";
  policyVersion: typeof ENQUIRY_RATE_LIMIT_POLICY.version;
  outcome: "allowed" | "limited" | "unavailable" | "invalid_identity" | "disabled";
  reason:
    | "allowed"
    | "application_disabled"
    | "identity_unavailable"
    | "identity_invalid"
    | "key_unavailable"
    | "limiter_unavailable"
    | "limiter_ambiguous"
    | "limit_exhausted";
};

export interface EnquiryAbuseMetrics {
  record(event: EnquiryAbuseMetric): Promise<void> | void;
}

export type EnquiryAbuseDependencies = {
  resolver: TrustedClientIpResolver;
  keyDeriver: RateLimitKeyDeriver;
  limiter: DistributedRateLimiter;
  metrics: EnquiryAbuseMetrics;
};

export type EnquiryAbuseDecision =
  | { allowed: true }
  | { allowed: false; code: "RATE_LIMITED" | "BACKEND_UNAVAILABLE" };

export async function recordEnquiryAbuseMetric(
  metrics: EnquiryAbuseMetrics,
  outcome: EnquiryAbuseMetric["outcome"],
  reason: EnquiryAbuseMetric["reason"],
) {
  try {
    await metrics.record({
      event: "sat12.enquiry_abuse",
      version: 1,
      route: "public-property-enquiry",
      policyVersion: ENQUIRY_RATE_LIMIT_POLICY.version,
      outcome,
      reason,
    });
  } catch {
    // Telemetry is observational. It cannot alter the security decision.
  }
}

export async function enforceEnquiryAbuseProtection(
  headers: Headers,
  dependencies: EnquiryAbuseDependencies,
): Promise<EnquiryAbuseDecision> {
  let identity: TrustedClientIpResult;
  try {
    identity = await dependencies.resolver.resolve(headers);
  } catch {
    identity = { status: "unavailable", reason: "provider-unavailable" };
  }
  if (identity.status !== "trusted") {
    const reason = identity.status === "invalid" ? "identity_invalid" : "identity_unavailable";
    await recordEnquiryAbuseMetric(
      dependencies.metrics,
      identity.status === "invalid" ? "invalid_identity" : "unavailable",
      reason,
    );
    return { allowed: false, code: "BACKEND_UNAVAILABLE" };
  }

  let derived: RateLimitKeyResult;
  try {
    derived = await dependencies.keyDeriver.derive(identity.ip);
  } catch {
    derived = { status: "unavailable", reason: "provider-unavailable" };
  }
  if (derived.status !== "derived") {
    await recordEnquiryAbuseMetric(dependencies.metrics, "unavailable", "key_unavailable");
    return { allowed: false, code: "BACKEND_UNAVAILABLE" };
  }

  let result: DistributedRateLimitResult | { status: string };
  try {
    result = await dependencies.limiter.consume({
      mode: "atomic-all-windows",
      subjectKey: derived.key,
      policy: ENQUIRY_RATE_LIMIT_POLICY,
    });
  } catch {
    result = { status: "unavailable" };
  }

  if (result.status === "allowed") {
    await recordEnquiryAbuseMetric(dependencies.metrics, "allowed", "allowed");
    return { allowed: true };
  }
  if (result.status === "limited") {
    await recordEnquiryAbuseMetric(dependencies.metrics, "limited", "limit_exhausted");
    return { allowed: false, code: "RATE_LIMITED" };
  }
  const reason = result.status === "unavailable" ? "limiter_unavailable" : "limiter_ambiguous";
  await recordEnquiryAbuseMetric(dependencies.metrics, "unavailable", reason);
  return { allowed: false, code: "BACKEND_UNAVAILABLE" };
}

export const unconfiguredTrustedClientIpResolver: TrustedClientIpResolver = {
  async resolve() {
    return { status: "unavailable", reason: "unconfigured" };
  },
};

export const unconfiguredRateLimitKeyDeriver: RateLimitKeyDeriver = {
  async derive() {
    return { status: "unavailable", reason: "unconfigured" };
  },
};

export const unconfiguredDistributedRateLimiter: DistributedRateLimiter = {
  async consume() {
    return { status: "unavailable", reason: "unconfigured" };
  },
};

export const noOpEnquiryAbuseMetrics: EnquiryAbuseMetrics = {
  record() {},
};
