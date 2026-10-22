import { describe, expect, it, vi } from "vitest";

import {
  buildMfaCleanupConfiguration,
  createMfaCleanupRoleReader,
  runMfaFactorCleanup,
} from "./cleanup-mfa-factor.mjs";

const PROJECT_REF = "abcdefghijklmnopqrst";
const USER_ID = "10000000-0000-4000-8000-000000000001";
const FACTOR_ID = "20000000-0000-4000-8000-000000000002";

function environment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    SUPABASE_PROJECT_REF: PROJECT_REF,
    SAT12_APPROVED_PROJECT_REF: PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
    SAT12_DEVELOPMENT_DATA_CONFIRMED: "true",
    SAT12_REMOTE_OPERATION_APPROVED: `mfa-factor-cleanup:${PROJECT_REF}`,
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-placeholder",
    SUPABASE_DB_URL: `postgresql://postgres.${PROJECT_REF}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    SAT12_MFA_CLEANUP_EMAIL: "selected@example.test",
    ...overrides,
  };
}

function user(overrides: Record<string, unknown> = {}) {
  return { id: USER_ID, email: "selected@example.test", email_confirmed_at: "2026-10-22T00:00:00.000Z", ...overrides };
}

function factor(overrides: Record<string, unknown> = {}) {
  return { id: FACTOR_ID, factor_type: "totp", status: "unverified", ...overrides };
}

function operator(overrides: Record<string, unknown> = {}) {
  return {
    listUsers: vi.fn(async () => [user()]),
    getRoleState: vi.fn(async () => ({ role: "user", adminCount: 0 })),
    listFactors: vi.fn().mockResolvedValueOnce([factor()]).mockResolvedValueOnce([]),
    deleteFactor: vi.fn(async () => ({ id: FACTOR_ID })),
    ...overrides,
  };
}

function execute(input: { env?: NodeJS.ProcessEnv; operator?: ReturnType<typeof operator> } = {}) {
  const env = input.env ?? environment();
  const messages: string[] = [];
  const activeOperator = input.operator ?? operator();
  const result = runMfaFactorCleanup(env, { operator: activeOperator, write: (message: string) => messages.push(message) });
  return { activeOperator, env, messages, result };
}

describe("guarded stale MFA cleanup", () => {
  it("requires exact project-bound approval and local operator inputs", () => {
    expect(buildMfaCleanupConfiguration(environment())).toEqual({
      projectRef: PROJECT_REF,
      projectUrl: `https://${PROJECT_REF}.supabase.co`,
      serviceRoleKey: "test-service-role-placeholder",
      databaseUrl: `postgresql://postgres.${PROJECT_REF}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      certificatePath: expect.stringMatching(/supabase-root-2021-ca\.crt$/u),
      email: "selected@example.test",
    });
    expect(() => buildMfaCleanupConfiguration(environment({ SAT12_REMOTE_OPERATION_APPROVED: "" }))).toThrow(/mfa-factor-cleanup/);
    expect(() => buildMfaCleanupConfiguration(environment({ SAT12_APPROVED_PROJECT_REF: "wrongwrongwrongwrongwr" }))).toThrow(/approved/i);
  });

  it("reads authoritative role state through a read-only database transaction", async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ role: "user", admin_count: 0 }], rowCount: 1 })
        .mockResolvedValueOnce({}),
    };
    const reader = createMfaCleanupRoleReader(database);

    await expect(reader.getRoleState(USER_ID)).resolves.toEqual({ role: "user", adminCount: 0 });
    expect(database.query).toHaveBeenNthCalledWith(1, "begin read only");
    expect(database.query).toHaveBeenNthCalledWith(2, expect.stringContaining("public.profiles"), [USER_ID]);
    expect(database.query).toHaveBeenNthCalledWith(3, "commit");
  });

  it.each([
    ["query failure", new Error("permission denied")],
    ["missing profile", { rows: [{ role: null, admin_count: 0 }], rowCount: 1 }],
    ["malformed count", { rows: [{ role: "user", admin_count: null }], rowCount: 1 }],
    ["unexpected response", { rows: [], rowCount: 0 }],
  ])("fails closed on %s and rolls back", async (_label, response) => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({})
        .mockImplementationOnce(async () => {
          if (response instanceof Error) throw response;
          return response;
        })
        .mockResolvedValueOnce({}),
    };
    const reader = createMfaCleanupRoleReader(database);

    await expect(reader.getRoleState(USER_ID)).rejects.toThrow("SAT12_MFA_CLEANUP_ROLE_LOOKUP_FAILED");
    expect(database.query).toHaveBeenLastCalledWith("rollback");
  });

  it.each([
    ["missing", []],
    ["ambiguous", [user(), user({ id: "30000000-0000-4000-8000-000000000003" })]],
    ["unconfirmed", [user({ email_confirmed_at: null })]],
  ])("refuses a %s target user before deletion", async (_label, users) => {
    const activeOperator = operator({ listUsers: vi.fn(async () => users) });
    const { result, env } = execute({ operator: activeOperator });
    await expect(result).rejects.toThrow(/SAT12_MFA_CLEANUP_USER/);
    expect(activeOperator.deleteFactor).not.toHaveBeenCalled();
    expect(env.SAT12_REMOTE_OPERATION_APPROVED).toBeUndefined();
  });

  it.each([
    ["wrong role", { role: "owner_agent", adminCount: 0 }],
    ["existing administrator", { role: "user", adminCount: 1 }],
  ])("refuses %s before factor inspection", async (_label, state) => {
    const activeOperator = operator({ getRoleState: vi.fn(async () => state) });
    const { result } = execute({ operator: activeOperator });
    await expect(result).rejects.toThrow(/SAT12_MFA_CLEANUP_(ROLE|ADMIN)/);
    expect(activeOperator.deleteFactor).not.toHaveBeenCalled();
  });

  it.each([
    ["no factor", []],
    ["multiple factors", [factor(), factor({ id: "30000000-0000-4000-8000-000000000003" })]],
    ["verified factor", [factor({ status: "verified" })]],
    ["unexpected type", [factor({ factor_type: "phone" })]],
  ])("refuses %s without deletion", async (_label, factors) => {
    const activeOperator = operator({ listFactors: vi.fn(async () => factors) });
    const { result } = execute({ operator: activeOperator });
    await expect(result).rejects.toThrow(/SAT12_MFA_CLEANUP_FACTOR/);
    expect(activeOperator.deleteFactor).not.toHaveBeenCalled();
  });

  it("deletes the exact resolved factor once and verifies zero residue", async () => {
    const { activeOperator, messages, result, env } = execute();
    await expect(result).resolves.toBeUndefined();
    expect(activeOperator.deleteFactor).toHaveBeenCalledTimes(1);
    expect(activeOperator.deleteFactor).toHaveBeenCalledWith(USER_ID, FACTOR_ID);
    expect(activeOperator.getRoleState).toHaveBeenCalledTimes(2);
    expect(messages).toEqual(["SAT12 stale unverified TOTP factor removed and verified.\n"]);
    expect(env.SAT12_REMOTE_OPERATION_APPROVED).toBeUndefined();
  });

  it("fails closed when deletion fails and never retries", async () => {
    const activeOperator = operator({ deleteFactor: vi.fn(async () => { throw new Error("provider detail selected@example.test"); }) });
    const { result, env } = execute({ operator: activeOperator });
    await expect(result).rejects.toThrow("SAT12_MFA_CLEANUP_DELETE_FAILED");
    expect(activeOperator.deleteFactor).toHaveBeenCalledTimes(1);
    expect(env.SAT12_REMOTE_OPERATION_APPROVED).toBeUndefined();
  });

  it("fails when post-deletion factors or authorization state differ", async () => {
    const stillPresent = operator({ listFactors: vi.fn().mockResolvedValueOnce([factor()]).mockResolvedValueOnce([factor()]) });
    await expect(execute({ operator: stillPresent }).result).rejects.toThrow("SAT12_MFA_CLEANUP_POSTCHECK_FAILED");
    const roleChanged = operator({
      getRoleState: vi.fn().mockResolvedValueOnce({ role: "user", adminCount: 0 }).mockResolvedValueOnce({ role: "admin", adminCount: 1 }),
    });
    await expect(execute({ operator: roleChanged }).result).rejects.toThrow("SAT12_MFA_CLEANUP_POSTCHECK_FAILED");
  });

  it("never includes sensitive identifiers in output or errors", async () => {
    const activeOperator = operator({ deleteFactor: vi.fn(async () => { throw new Error(`secret ${USER_ID} ${FACTOR_ID}`); }) });
    const { result, messages } = execute({ operator: activeOperator });
    let reported = "";
    try { await result; } catch (error) { reported = String(error); }
    expect(`${reported}${messages.join("")}`).not.toContain(USER_ID);
    expect(`${reported}${messages.join("")}`).not.toContain(FACTOR_ID);
    expect(`${reported}${messages.join("")}`).not.toContain("selected@example.test");
  });
});
