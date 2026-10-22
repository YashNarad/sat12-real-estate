import { describe, expect, it, vi } from "vitest";

import {
  buildBootstrapConfiguration,
  findConfirmedUserByEmail,
  runBootstrap,
} from "./bootstrap-admin.mjs";

const PROJECT_REF = "abcdefghijklmnopqrst";
const USER_ID = "10000000-0000-4000-8000-000000000001";

function approvedEnvironment() {
  return {
    NODE_ENV: "test" as const,
    SUPABASE_PROJECT_REF: PROJECT_REF,
    SAT12_APPROVED_PROJECT_REF: PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
    SAT12_DEVELOPMENT_DATA_CONFIRMED: "true",
    SAT12_REMOTE_OPERATION_APPROVED: `bootstrap:${PROJECT_REF}`,
    SUPABASE_SERVICE_ROLE_KEY: "test-only-placeholder",
    SUPABASE_DB_URL: `postgresql://postgres.${PROJECT_REF}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    SAT12_BOOTSTRAP_ADMIN_EMAIL: "admin@example.test",
    SAT12_BOOTSTRAP_REASON: "Initial SAT12 development administrator",
  };
}

describe("first-admin bootstrap guard", () => {
  it("requires exact project approval and process-only inputs", () => {
    expect(buildBootstrapConfiguration(approvedEnvironment())).toEqual({
      projectRef: PROJECT_REF,
      projectUrl: `https://${PROJECT_REF}.supabase.co`,
      serviceRoleKey: "test-only-placeholder",
      databaseUrl: `postgresql://postgres.${PROJECT_REF}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      certificatePath: expect.stringMatching(/supabase-root-2021-ca\.crt$/u),
      email: "admin@example.test",
      reason: "Initial SAT12 development administrator",
    });
    expect(() =>
      buildBootstrapConfiguration({
        ...approvedEnvironment(),
        SAT12_REMOTE_OPERATION_APPROVED: "",
      }),
    ).toThrow(/bootstrap/);
  });

  it("preflights the authoritative state, invokes only bootstrap once, and verifies its audit", async () => {
    const env = approvedEnvironment();
    const operator = {
      listUsers: vi.fn(async () => [{
        id: USER_ID,
        email: "admin@example.test",
        email_confirmed_at: "2026-10-15T00:00:00.000Z",
      }]),
      getState: vi.fn()
        .mockResolvedValueOnce({ role: "user", adminCount: 0 })
        .mockResolvedValueOnce({ role: "admin", adminCount: 1, matchingAuditCount: 1 }),
      bootstrap: vi.fn(async () => undefined),
    };
    const messages: string[] = [];

    await expect(runBootstrap(env, { operator, write: (message: string) => messages.push(message) }))
      .resolves.toBeUndefined();
    expect(operator.bootstrap).toHaveBeenCalledTimes(1);
    expect(operator.bootstrap).toHaveBeenCalledWith(
      USER_ID,
      "Initial SAT12 development administrator",
    );
    expect(operator.getState).toHaveBeenCalledTimes(2);
    expect(messages).toEqual(["First SAT12 administrator assigned and audit verified; TOTP enrollment is still required.\n"]);
    expect(env.SAT12_REMOTE_OPERATION_APPROVED).toBeUndefined();
  });

  it.each([
    ["wrong target role", { role: "owner_agent", adminCount: 0 }],
    ["existing administrator", { role: "user", adminCount: 1 }],
  ])("refuses %s before invoking bootstrap", async (_label, state) => {
    const operator = {
      listUsers: vi.fn(async () => [{
        id: USER_ID,
        email: "admin@example.test",
        email_confirmed_at: "2026-10-15T00:00:00.000Z",
      }]),
      getState: vi.fn(async () => state),
      bootstrap: vi.fn(),
    };

    await expect(runBootstrap(approvedEnvironment(), { operator })).rejects.toThrow(/SAT12_BOOTSTRAP/);
    expect(operator.bootstrap).not.toHaveBeenCalled();
  });

  it("sanitizes RPC failure, never retries, and clears approval", async () => {
    const env = approvedEnvironment();
    const operator = {
      listUsers: vi.fn(async () => [{
        id: USER_ID,
        email: "admin@example.test",
        email_confirmed_at: "2026-10-15T00:00:00.000Z",
      }]),
      getState: vi.fn(async () => ({ role: "user", adminCount: 0 })),
      bootstrap: vi.fn(async () => { throw new Error("provider detail admin@example.test"); }),
    };

    await expect(runBootstrap(env, { operator })).rejects.toThrow("SAT12_BOOTSTRAP_FAILED");
    expect(operator.bootstrap).toHaveBeenCalledTimes(1);
    expect(env.SAT12_REMOTE_OPERATION_APPROVED).toBeUndefined();
  });

  it("reports an uncertain outcome when post-bootstrap verification fails", async () => {
    const operator = {
      listUsers: vi.fn(async () => [{
        id: USER_ID,
        email: "admin@example.test",
        email_confirmed_at: "2026-10-15T00:00:00.000Z",
      }]),
      getState: vi.fn()
        .mockResolvedValueOnce({ role: "user", adminCount: 0 })
        .mockResolvedValueOnce({ role: "admin", adminCount: 1, matchingAuditCount: 0 }),
      bootstrap: vi.fn(async () => undefined),
    };

    await expect(runBootstrap(approvedEnvironment(), { operator }))
      .rejects.toThrow("SAT12_BOOTSTRAP_OUTCOME_UNCERTAIN");
    expect(operator.bootstrap).toHaveBeenCalledTimes(1);
  });

  it("resolves one exact email-confirmed user and rejects ambiguity", () => {
    const confirmed = {
      id: "10000000-0000-4000-8000-000000000001",
      email: "admin@example.test",
      email_confirmed_at: "2026-10-15T00:00:00.000Z",
    };
    expect(findConfirmedUserByEmail([confirmed], "ADMIN@example.test")).toEqual(confirmed);
    expect(() =>
      findConfirmedUserByEmail(
        [confirmed, { ...confirmed, id: "20000000-0000-4000-8000-000000000002" }],
        "admin@example.test",
      ),
    ).toThrow(/exactly one/);
    expect(() =>
      findConfirmedUserByEmail(
        [{ ...confirmed, email_confirmed_at: null }],
        "admin@example.test",
      ),
    ).toThrow(/confirmed/);
  });
});
