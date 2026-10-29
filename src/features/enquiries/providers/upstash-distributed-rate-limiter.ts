import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  ENQUIRY_RATE_LIMIT_POLICY,
  type DistributedRateLimiter,
} from "../abuse-protection";

export interface UpstashScriptTransport {
  eval(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<unknown>;
}

type UpstashLimiterConfiguration = Readonly<{
  transport: UpstashScriptTransport;
  timeoutMs: number;
  attemptIdFactory?: () => string;
}>;

export const UPSTASH_ATOMIC_SLIDING_WINDOW_SCRIPT = `
local short_limit = tonumber(ARGV[1])
local long_limit = tonumber(ARGV[2])
local short_window_ms = tonumber(ARGV[3]) * 1000
local long_window_ms = tonumber(ARGV[4]) * 1000
local attempt_nonce = ARGV[5]

if not short_limit or not long_limit or not short_window_ms or not long_window_ms then
  return {-2, 0, 0}
end
if short_limit < 1 or long_limit < 1 or short_window_ms < 1 or long_window_ms < 1 then
  return {-2, 0, 0}
end
if not attempt_nonce or string.len(attempt_nonce) < 1 or string.len(attempt_nonce) > 64 then
  return {-2, 0, 0}
end

local key_type = redis.call('TYPE', KEYS[1])
if type(key_type) == 'table' then key_type = key_type['ok'] end
if key_type ~= 'none' and key_type ~= 'zset' then
  return {-2, 0, 0}
end

local redis_time = redis.call('TIME')
local now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms - long_window_ms)

local short_count = tonumber(redis.call('ZCOUNT', KEYS[1], '(' .. tostring(now_ms - short_window_ms), '+inf'))
local long_count = tonumber(redis.call('ZCARD', KEYS[1]))
if redis.call('ZSCORE', KEYS[1], attempt_nonce) then
  return {-1, short_count, long_count}
end
if short_count >= short_limit or long_count >= long_limit then
  return {0, short_count, long_count}
end

redis.call('ZADD', KEYS[1], now_ms, attempt_nonce)
redis.call('PEXPIRE', KEYS[1], long_window_ms)
return {1, short_count + 1, long_count + 1}
`;

function isApprovedPolicy(policy: typeof ENQUIRY_RATE_LIMIT_POLICY) {
  return (
    policy.version === "stage5c-v1" &&
    policy.windows.length === 2 &&
    policy.windows[0]?.limit === 5 &&
    policy.windows[0]?.windowSeconds === 600 &&
    policy.windows[1]?.limit === 20 &&
    policy.windows[1]?.windowSeconds === 3600
  );
}

function parseResult(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((entry) => Number.isSafeInteger(entry))
  ) {
    return null;
  }
  const [status, shortCount, longCount] = value as [number, number, number];
  if (shortCount < 0 || longCount < 0) return null;
  if (status === 1) {
    if (shortCount < 1 || shortCount > 5 || longCount < 1 || longCount > 20) return null;
    return "allowed" as const;
  }
  if (status === 0) {
    if (shortCount < 5 && longCount < 20) return null;
    return "limited" as const;
  }
  return null;
}

function timeoutAfter(milliseconds: number) {
  return new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error("rate limiter timeout")), milliseconds);
    timer.unref?.();
  });
}

export function createUpstashDistributedRateLimiter(
  configuration: UpstashLimiterConfiguration,
): DistributedRateLimiter {
  const attemptIdFactory = configuration.attemptIdFactory ?? randomUUID;
  const timeoutMs = Number.isSafeInteger(configuration.timeoutMs) && configuration.timeoutMs > 0
    ? configuration.timeoutMs
    : null;

  return {
    async consume(request) {
      if (!timeoutMs || request.mode !== "atomic-all-windows" || !isApprovedPolicy(request.policy)) {
        return { status: "unavailable", reason: "unconfigured" };
      }

      try {
        const attemptId = attemptIdFactory();
        if (!/^[A-Za-z0-9-]{1,64}$/u.test(attemptId)) {
          return { status: "unavailable", reason: "unconfigured" };
        }
        const subjectDigest = createHash("sha256").update(request.subjectKey).digest("hex");
        const result = await Promise.race([
          configuration.transport.eval(
            UPSTASH_ATOMIC_SLIDING_WINDOW_SCRIPT,
            [`sat12:enquiry:{${subjectDigest}}:attempts`],
            [5, 20, 600, 3600, attemptId],
          ),
          timeoutAfter(timeoutMs),
        ]);
        const parsed = parseResult(result);
        if (parsed === "allowed") return { status: "allowed" };
        if (parsed === "limited") return { status: "limited" };
        return { status: "unavailable", reason: "provider-unavailable" };
      } catch {
        return { status: "unavailable", reason: "provider-unavailable" };
      }
    },
  };
}
