import { describe, expect, it, vi } from "vitest";

import { getHomepageAccount } from "./homepage-account";

function client(input?: {
  claimsError?: Error;
  fullName?: string | null;
  email?: string | null;
}) {
  const id = "10000000-0000-4000-8000-000000000001";
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: input?.claimsError
          ? null
          : { claims: { sub: id, exp: Math.floor(Date.now() / 1000) + 3600 } },
        error: input?.claimsError ?? null,
      })),
      getUser: vi.fn(async () => ({
        data: { user: { id, email: input?.email ?? "dev@example.test" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { role: "user", full_name: input?.fullName ?? "Dev" },
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe("getHomepageAccount", () => {
  it("returns the authoritative saved profile name", async () => {
    await expect(getHomepageAccount({ client: client() })).resolves.toEqual({
      displayName: "Dev",
      initial: "D",
    });
  });

  it("uses the server-verified email when the profile name is blank", async () => {
    await expect(
      getHomepageAccount({ client: client({ fullName: "  ", email: "dev@example.test" }) }),
    ).resolves.toEqual({ displayName: "dev@example.test", initial: "D" });
  });

  it("returns logged-out state for an invalid or missing Auth identity", async () => {
    await expect(
      getHomepageAccount({ client: client({ claimsError: new Error("no session") }) }),
    ).resolves.toBeNull();
  });
});
