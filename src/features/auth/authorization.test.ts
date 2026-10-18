import { describe, expect, it, vi } from "vitest";

import {
  AuthorizationError,
  requireAal2Admin,
  requireRole,
  requireUser,
  safeReturnPath,
} from "./authorization";

type Role = "user" | "owner_agent" | "admin";

function client(input?: {
  claims?: Record<string, unknown>;
  claimsError?: Error;
  userError?: Error;
  userId?: string;
  role?: Role;
  profileError?: Error;
}) {
  const defaultUserId = "10000000-0000-4000-8000-000000000001";
  const single = vi.fn(async () => ({
    data: input?.profileError ? null : { role: input?.role ?? "user", full_name: "Test User" },
    error: input?.profileError ?? null,
  }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: input?.claimsError
          ? null
          : {
              claims: input?.claims ?? {
                sub: "10000000-0000-4000-8000-000000000001",
                email: "user@example.test",
                aal: "aal1",
                exp: Math.floor(Date.now() / 1000) + 3600,
              },
            },
        error: input?.claimsError ?? null,
      })),
      getUser: vi.fn(async () => ({
        data: input?.userError
          ? { user: null }
          : {
              user: {
                id: input?.userId ?? defaultUserId,
                email: "user@example.test",
              },
            },
        error: input?.userError ?? null,
      })),
    },
    from: vi.fn(() => ({ select })),
  };
}

describe("verified authorization", () => {
  it("returns a verified regular user and owner/agent", async () => {
    await expect(requireUser({ client: client({ role: "user" }) })).resolves.toMatchObject({
      role: "user",
      aal: "aal1",
    });
    await expect(
      requireRole(["owner_agent"], { client: client({ role: "owner_agent" }) }),
    ).resolves.toMatchObject({ role: "owner_agent" });
  });

  it("does not trust session-shaped data when verified claims are absent", async () => {
    await expect(
      requireUser({
        client: client({ claims: {} }),
        session: { user: { id: "spoofed" }, role: "admin" },
      }),
    ).rejects.toEqual(new AuthorizationError("AUTH_REQUIRED"));
  });

  it.each([
    ["expired", { exp: Math.floor(Date.now() / 1000) - 1 }],
    ["missing subject", { exp: Math.floor(Date.now() / 1000) + 3600 }],
  ])("rejects %s claims", async (_label, claims) => {
    await expect(requireUser({ client: client({ claims }) })).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("rejects invalid Auth identities when claim verification fails", async () => {
    await expect(
      requireUser({ client: client({ claimsError: new Error("User banned") }) }),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("rejects a disabled or banned identity even when cached claims remain valid", async () => {
    await expect(
      requireUser({ client: client({ userError: new Error("User banned") }) }),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("rejects an Auth user whose server-verified identity differs from the claims subject", async () => {
    await expect(
      requireUser({ client: client({ userId: "20000000-0000-4000-8000-000000000002" }) }),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("rejects a missing authoritative profile", async () => {
    await expect(
      requireUser({ client: client({ profileError: new Error("not found") }) }),
    ).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
  });

  it("requires both the admin role and AAL2", async () => {
    await expect(requireAal2Admin({ client: client({ role: "admin" }) })).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
    await expect(
      requireAal2Admin({
        client: client({
          role: "admin",
          claims: {
            sub: "10000000-0000-4000-8000-000000000001",
            aal: "aal2",
            amr: [{ method: "mfa/totp", timestamp: Math.floor(Date.now() / 1000) - 30 }],
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
        }),
      }),
    ).resolves.toMatchObject({ role: "admin", aal: "aal2" });
    await expect(
      requireAal2Admin({
        client: client({
          role: "owner_agent",
          claims: {
            sub: "10000000-0000-4000-8000-000000000001",
            aal: "aal2",
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "ROLE_REQUIRED" });
  });

  it("requires a recent server-verified TOTP event for an administrator", async () => {
    await expect(
      requireAal2Admin({
        client: client({
          role: "admin",
          claims: {
            sub: "10000000-0000-4000-8000-000000000001",
            aal: "aal2",
            amr: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) - 16 * 60 }],
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "MFA_REQUIRED" });
  });
});

describe("safe return paths", () => {
  it.each(["https://evil.example", "//evil.example", "javascript:alert(1)", "/\\evil"])(
    "rejects external or malformed return path %s",
    (value) => expect(safeReturnPath(value)).toBe("/"),
  );

  it("keeps a relative SAT12 return path", () => {
    expect(safeReturnPath("/dashboard/properties?status=draft")).toBe(
      "/dashboard/properties?status=draft",
    );
  });
});
