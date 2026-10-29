import { describe, expect, it, vi } from "vitest";

import { ENQUIRY_RATE_LIMIT_POLICY } from "../abuse-protection";
import {
  createUpstashDistributedRateLimiter,
  UPSTASH_ATOMIC_SLIDING_WINDOW_SCRIPT,
  type UpstashScriptTransport,
} from "./upstash-distributed-rate-limiter";

type ScriptResult = [number, number, number];

class SlidingWindowFake implements UpstashScriptTransport {
  nowMs = 1_800_000_000_000;
  readonly calls: Array<{ keys: string[]; args: Array<string | number> }> = [];
  readonly attempts = new Map<string, Map<string, number>>();
  #queue = Promise.resolve();

  eval<Result>(_script: string, keys: string[], args: Array<string | number>) {
    const operation = this.#queue.then(() => {
      this.calls.push({ keys, args });
      const [shortLimit, longLimit, shortSeconds, longSeconds, attemptId] = args;
      const values = this.attempts.get(keys[0]!) ?? new Map<string, number>();
      this.attempts.set(keys[0]!, values);
      for (const [member, timestamp] of values) {
        if (timestamp <= this.nowMs - Number(longSeconds) * 1000) values.delete(member);
      }
      const shortCount = [...values.values()].filter(
        (timestamp) => timestamp > this.nowMs - Number(shortSeconds) * 1000,
      ).length;
      const longCount = values.size;
      if (values.has(String(attemptId))) return [-1, shortCount, longCount] as ScriptResult;
      if (shortCount >= Number(shortLimit) || longCount >= Number(longLimit)) {
        return [0, shortCount, longCount] as ScriptResult;
      }
      values.set(String(attemptId), this.nowMs);
      return [1, shortCount + 1, longCount + 1] as ScriptResult;
    });
    this.#queue = operation.then(() => undefined, () => undefined);
    return operation as Promise<Result>;
  }
}

function limiter(
  transport: UpstashScriptTransport,
  options: { timeoutMs?: number; attemptIdFactory?: () => string } = {},
) {
  return createUpstashDistributedRateLimiter({
    transport,
    timeoutMs: options.timeoutMs ?? 100,
    attemptIdFactory: options.attemptIdFactory ?? (() => crypto.randomUUID()),
  });
}

function request(subjectKey = "opaque-subject") {
  return {
    mode: "atomic-all-windows" as const,
    subjectKey,
    policy: ENQUIRY_RATE_LIMIT_POLICY,
  };
}

describe("Upstash atomic sliding-window limiter", () => {
  it("uses one EVAL call and one privacy-safe sorted-set key for both windows", async () => {
    const transport = { eval: vi.fn(async () => [1, 1, 1]) };

    await expect(
      limiter(transport, { attemptIdFactory: () => "attempt-1" }).consume(request()),
    ).resolves.toEqual({ status: "allowed" });

    expect(transport.eval).toHaveBeenCalledTimes(1);
    expect(transport.eval).toHaveBeenCalledWith(
      UPSTASH_ATOMIC_SLIDING_WINDOW_SCRIPT,
      [expect.stringMatching(/^sat12:enquiry:\{[a-f0-9]{64}\}:attempts$/u)],
      [5, 20, 600, 3600, "attempt-1"],
    );
    expect(JSON.stringify(transport.eval.mock.calls)).not.toContain("opaque-subject");
  });

  it("validates before the sole counter insertion and keeps cleanup safe", () => {
    const script = UPSTASH_ATOMIC_SLIDING_WINDOW_SCRIPT;
    expect(script).toContain("redis.call('TYPE', KEYS[1])");
    expect(script).toContain("redis.call('ZSCORE', KEYS[1], attempt_nonce)");
    expect(script).toContain("redis.call('ZCOUNT', KEYS[1]");
    expect(script).toContain("redis.call('ZCARD', KEYS[1])");
    expect(script).toContain("redis.call('ZADD', KEYS[1]");
    expect(script).toContain("redis.call('PEXPIRE', KEYS[1]");
    expect(script.indexOf("redis.call('TYPE'")).toBeLessThan(script.indexOf("redis.call('ZADD'"));
    expect(script.indexOf("redis.call('ZSCORE'")).toBeLessThan(script.indexOf("redis.call('ZADD'"));
    expect(script).not.toContain("KEYS[2]");
  });

  it("enforces both windows under concurrent attempts without partial consumption", async () => {
    const transport = new SlidingWindowFake();
    let sequence = 0;
    const rateLimiter = limiter(transport, { attemptIdFactory: () => `attempt-${sequence++}` });

    const firstBurst = await Promise.all(
      Array.from({ length: 25 }, () => rateLimiter.consume(request())),
    );
    expect(firstBurst.filter((result) => result.status === "allowed")).toHaveLength(5);
    expect(transport.attempts.values().next().value).toHaveLength(5);

    for (let batch = 1; batch < 4; batch += 1) {
      transport.nowMs += 600_001;
      const results = await Promise.all(
        Array.from({ length: 5 }, () => rateLimiter.consume(request())),
      );
      expect(results.every((result) => result.status === "allowed")).toBe(true);
    }
    expect(transport.attempts.values().next().value).toHaveLength(20);

    transport.nowMs += 600_001;
    await expect(rateLimiter.consume(request())).resolves.toEqual({ status: "limited" });
    expect(transport.attempts.values().next().value).toHaveLength(20);
  });

  it("isolates subjects", async () => {
    const transport = new SlidingWindowFake();
    let sequence = 0;
    const rateLimiter = limiter(transport, { attemptIdFactory: () => `attempt-${sequence++}` });

    await Promise.all(Array.from({ length: 5 }, () => rateLimiter.consume(request("subject-a"))));
    await expect(rateLimiter.consume(request("subject-b"))).resolves.toEqual({ status: "allowed" });
    expect(transport.attempts).toHaveLength(2);
  });

  it("fails closed for duplicate attempt identifiers without changing counters", async () => {
    const transport = new SlidingWindowFake();
    const rateLimiter = limiter(transport, { attemptIdFactory: () => "same-attempt" });

    await expect(rateLimiter.consume(request())).resolves.toEqual({ status: "allowed" });
    await expect(rateLimiter.consume(request())).resolves.toEqual({
      status: "unavailable",
      reason: "provider-unavailable",
    });
    expect(transport.attempts.values().next().value).toHaveLength(1);
  });

  it.each([
    [[0, 5, 5], { status: "limited" }],
    [[-1, 1, 1], { status: "unavailable", reason: "provider-unavailable" }],
    [[-2, 0, 0], { status: "unavailable", reason: "provider-unavailable" }],
    [[], { status: "unavailable", reason: "provider-unavailable" }],
    [[1, -1, 1], { status: "unavailable", reason: "provider-unavailable" }],
    [[1, "1", 1], { status: "unavailable", reason: "provider-unavailable" }],
    [[2, 1, 1], { status: "unavailable", reason: "provider-unavailable" }],
  ] as const)("maps script result %# safely", async (scriptResult, expected) => {
    const transport = { eval: vi.fn(async () => scriptResult) };
    await expect(limiter(transport).consume(request())).resolves.toEqual(expected);
    expect(transport.eval).toHaveBeenCalledTimes(1);
  });

  it("fails closed on transport and Lua runtime errors without retrying", async () => {
    const transport = { eval: vi.fn(async () => { throw new Error("ERR lua runtime failure"); }) };

    await expect(limiter(transport).consume(request())).resolves.toEqual({
      status: "unavailable",
      reason: "provider-unavailable",
    });
    expect(transport.eval).toHaveBeenCalledTimes(1);
  });

  it("does not assume a Lua runtime error rolled back an earlier write", async () => {
    const storedAttempts = new Set<string>();
    const transport: UpstashScriptTransport = {
      async eval(_script, _keys, args) {
        storedAttempts.add(String(args[4]));
        throw new Error("runtime error after write");
      },
    };

    await expect(
      limiter(transport, { attemptIdFactory: () => "partially-written" }).consume(request()),
    ).resolves.toEqual({ status: "unavailable", reason: "provider-unavailable" });
    expect(storedAttempts).toEqual(new Set(["partially-written"]));
  });

  it("times out fail closed and never retries an ambiguous operation", async () => {
    const transport = { eval: vi.fn(() => new Promise<ScriptResult>(() => undefined)) };

    await expect(limiter(transport, { timeoutMs: 5 }).consume(request())).resolves.toEqual({
      status: "unavailable",
      reason: "provider-unavailable",
    });
    expect(transport.eval).toHaveBeenCalledTimes(1);
  });

  it("rejects unexpected policies before invoking Redis", async () => {
    const transport = { eval: vi.fn(async () => [1, 1, 1]) };
    const invalidRequest = {
      ...request(),
      policy: { version: "unexpected", windows: [{ limit: 1, windowSeconds: 1 }] },
    } as never;

    await expect(limiter(transport).consume(invalidRequest)).resolves.toEqual({
      status: "unavailable",
      reason: "unconfigured",
    });
    expect(transport.eval).not.toHaveBeenCalled();
  });
});
