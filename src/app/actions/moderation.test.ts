import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { AuthorizationError } from "@/features/auth/authorization";

const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const TARGET_ID = "10000000-0000-4000-8000-000000000002";

const harness = vi.hoisted(() => ({
  authError: null as Error | null,
  profile: { id: "10000000-0000-4000-8000-000000000002", role: "user" } as {
    id: string;
    role: string;
  } | null,
  profileError: null as unknown,
  rpcError: null as unknown,
  rpcCalls: [] as Array<{ p_target_id: string; p_role: string; p_reason: string }>,
  revalidated: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string) => harness.revalidated.push(path)),
}));

vi.mock("@/features/auth/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/authorization")>();
  return {
    ...actual,
    requireAal2Admin: vi.fn(async () => {
      if (harness.authError) throw harness.authError;
      return { id: ADMIN_ID, role: "admin", aal: "aal2" };
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: harness.profile, error: harness.profileError }),
        }),
      }),
    }),
    rpc: async (_name: string, args: { p_target_id: string; p_role: string; p_reason: string }) => {
      harness.rpcCalls.push(args);
      return { data: null, error: harness.rpcError };
    },
  })),
}));

import { approveOwnerAgent } from "./moderation";

function form(target = TARGET_ID, reason = "Approved Nagpur property agent") {
  const data = new FormData();
  data.set("targetProfileId", target);
  data.set("reason", reason);
  return data;
}

describe("owner/agent approval action", () => {
  beforeEach(() => {
    harness.authError = null;
    harness.profile = { id: TARGET_ID, role: "user" };
    harness.profileError = null;
    harness.rpcError = null;
    harness.rpcCalls.length = 0;
    harness.revalidated.length = 0;
  });

  it("rejects unauthenticated, non-admin, and AAL1 requests before the RPC", async () => {
    for (const code of ["AUTH_REQUIRED", "ROLE_REQUIRED", "MFA_REQUIRED"] as const) {
      harness.authError = new AuthorizationError(code);
      const result = await approveOwnerAgent({ ok: false, message: "" }, form());
      expect(result.ok).toBe(false);
      expect(result.code).toBe(code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : code === "MFA_REQUIRED" ? "MFA_REQUIRED" : "FORBIDDEN");
      expect(harness.rpcCalls).toHaveLength(0);
    }
  });

  it("rejects malformed targets and missing audit reasons", async () => {
    const invalidTarget = await approveOwnerAgent({ ok: false, message: "" }, form("not-a-uuid"));
    expect(invalidTarget).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(invalidTarget.fieldErrors?.targetProfileId).toBeDefined();

    const missingReason = await approveOwnerAgent({ ok: false, message: "" }, form(TARGET_ID, " "));
    expect(missingReason).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(missingReason.fieldErrors?.reason).toBeDefined();
    expect(harness.rpcCalls).toHaveLength(0);
  });

  it("rejects self-targeting before profile mutation", async () => {
    const result = await approveOwnerAgent({ ok: false, message: "" }, form(ADMIN_ID));
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(harness.rpcCalls).toHaveLength(0);
  });

  it("fails closed for missing, inaccessible, or non-user targets", async () => {
    harness.profile = null;
    harness.profileError = new Error("not found");
    await expect(approveOwnerAgent({ ok: false, message: "" }, form())).resolves.toMatchObject({ ok: false, code: "TARGET_UNAVAILABLE" });

    harness.profile = { id: TARGET_ID, role: "owner_agent" };
    harness.profileError = null;
    await expect(approveOwnerAgent({ ok: false, message: "" }, form())).resolves.toMatchObject({ ok: false, code: "STALE_TARGET" });
    expect(harness.rpcCalls).toHaveLength(0);
  });

  it("calls only the audited RPC with the exact target, role, and trimmed reason", async () => {
    const result = await approveOwnerAgent(
      { ok: false, message: "" },
      form(TARGET_ID, "  Approved Nagpur property agent  "),
    );

    expect(result).toEqual({ ok: true, message: "Owner/agent access approved." });
    expect(harness.rpcCalls).toEqual([{ p_target_id: TARGET_ID, p_role: "owner_agent", p_reason: "Approved Nagpur property agent" }]);
    expect(harness.revalidated).toEqual(["/admin/users"]);
  });

  it("returns a sanitized failure when the authoritative RPC refuses the change", async () => {
    harness.rpcError = { code: "42501", message: "private database detail" };
    const result = await approveOwnerAgent({ ok: false, message: "" }, form());
    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "The role change was not authorized." });
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });

  it("keeps every module-level export in the use-server file callable", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/actions/moderation.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/export\s+const\s+(?!approveOwnerAgent)/);
  });
});
