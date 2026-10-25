import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => { harness.calls.push("connection"); }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), usePathname: () => "/account" }));
vi.mock("@/app/actions/auth", () => ({
  enrollMfaAction: vi.fn(), logoutAction: vi.fn(), verifyMfaAction: vi.fn(),
}));
vi.mock("@/components/auth/MfaForm", () => ({
  MfaEnrollmentForm: () => <span>MFA enrollment</span>,
  TotpChallengeForm: () => <span>MFA challenge</span>,
}));
vi.mock("@/features/auth/authorization", async () => {
  class AuthorizationError extends Error {}
  return {
    AuthorizationError,
    requireUser: vi.fn(async () => {
      harness.calls.push("requireUser");
      return { aal: "aal1", email: "dev@example.test", fullName: "Dev", role: "user" };
    }),
    safeReturnPath: vi.fn(() => "/account"),
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { mfa: { listFactors: vi.fn(async () => ({ data: { totp: [] }, error: null })) } },
  })),
}));

import AccountPage from "@/app/account/page";
import MfaPage from "@/app/auth/mfa/page";

describe("authenticated account pages", () => {
  beforeEach(() => { harness.calls.length = 0; });

  it("enters request time before checking the account session", async () => {
    render(await AccountPage());
    expect(screen.getByRole("heading", { name: "Your SAT12 account" })).toBeInTheDocument();
    expect(harness.calls).toEqual(["connection", "requireUser"]);
  });

  it("enters request time before checking the MFA session", async () => {
    render(await MfaPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Secure your account" })).toBeInTheDocument();
    expect(harness.calls).toEqual(["connection", "requireUser"]);
  });
});
