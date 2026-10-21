import { describe, expect, it, vi } from "vitest";

import {
  classifyMfaEnrollmentFailure,
  enrollTotp,
  loginWithPassword,
  requestPasswordRecovery,
  signUpWithPassword,
  updatePassword,
  verifyTotp,
} from "./operations";

describe("authentication operations", () => {
  it("validates signup before contacting Supabase and fixes the default role", async () => {
    const signUp = vi.fn();
    await expect(
      signUpWithPassword({ signUp }, { email: "bad", password: "short", fullName: "A" }, "https://sat12.test"),
    ).resolves.toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
    expect(signUp).not.toHaveBeenCalled();

    signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    await expect(
      signUpWithPassword(
        { signUp },
        { email: "new@example.test", password: "StrongPass1!", fullName: "New User" },
        "https://sat12.test",
      ),
    ).resolves.toMatchObject({ ok: true, message: expect.stringMatching(/email/i) });
    expect(signUp).toHaveBeenCalledWith({
      email: "new@example.test",
      password: "StrongPass1!",
      options: {
        emailRedirectTo: "https://sat12.test/auth/callback?next=%2F",
        data: { full_name: "New User" },
      },
    });
  });

  it("returns generic login and recovery errors without leaking account existence", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("invalid credentials"),
    });
    await expect(
      loginWithPassword({ signInWithPassword }, { email: "user@example.test", password: "WrongPass1!" }),
    ).resolves.toEqual({ ok: false, message: "Email or password is incorrect." });

    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: new Error("missing") });
    await expect(
      requestPasswordRecovery(
        { resetPasswordForEmail },
        { email: "unknown@example.test" },
        "https://sat12.test",
      ),
    ).resolves.toMatchObject({ ok: true, message: expect.stringMatching(/if an account exists/i) });
  });

  it("challenges and verifies a TOTP factor without accepting a client-supplied role", async () => {
    const challenge = vi.fn().mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    const verify = vi.fn().mockResolvedValue({ data: {}, error: null });
    await expect(
      verifyTotp({ challenge, verify }, { factorId: "factor-1", code: "123456" }),
    ).resolves.toEqual({ ok: true, message: "Multi-factor authentication verified." });
    expect(verify).toHaveBeenCalledWith({
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("removes an old factor only after its replacement is verified", async () => {
    const calls: string[] = [];
    const challenge = vi.fn(async () => {
      calls.push("challenge");
      return { data: { id: "challenge-2" }, error: null };
    });
    const verify = vi.fn(async () => {
      calls.push("verify");
      return { data: {}, error: null };
    });
    const unenroll = vi.fn(async () => {
      calls.push("unenroll");
      return { data: {}, error: null };
    });

    await expect(
      verifyTotp(
        { challenge, verify, unenroll },
        { factorId: "new-factor", replaceFactorId: "old-factor", code: "123456" },
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual(["challenge", "verify", "unenroll"]);
    expect(unenroll).toHaveBeenCalledWith({ factorId: "old-factor" });
  });

  it("keeps the old factor when replacement verification or removal fails", async () => {
    const unenroll = vi.fn();
    await expect(
      verifyTotp(
        {
          challenge: vi.fn().mockResolvedValue({ data: { id: "challenge" }, error: null }),
          verify: vi.fn().mockResolvedValue({ data: null, error: new Error("invalid code") }),
          unenroll,
        },
        { factorId: "new-factor", replaceFactorId: "old-factor", code: "123456" },
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(unenroll).not.toHaveBeenCalled();

    await expect(
      verifyTotp(
        {
          challenge: vi.fn().mockResolvedValue({ data: { id: "challenge" }, error: null }),
          verify: vi.fn().mockResolvedValue({ data: {}, error: null }),
          unenroll: vi.fn().mockResolvedValue({ data: null, error: new Error("provider failure") }),
        },
        { factorId: "new-factor", replaceFactorId: "old-factor", code: "123456" },
      ),
    ).resolves.toEqual({
      ok: false,
      message: "The replacement is active, but the old authenticator could not be removed.",
    });
  });

  it("validates a replacement password and returns a generic provider error", async () => {
    const updateUser = vi.fn();
    await expect(updatePassword({ updateUser }, { password: "weak" })).resolves.toMatchObject({
      ok: false,
      fieldErrors: expect.any(Object),
    });
    expect(updateUser).not.toHaveBeenCalled();

    updateUser.mockResolvedValue({ data: {}, error: new Error("provider unavailable") });
    await expect(
      updatePassword({ updateUser }, { password: "Replacement1!" }),
    ).resolves.toEqual({ ok: false, message: "Unable to update your password." });
  });

  it("returns only the TOTP enrollment material required by the verification form", async () => {
    const enroll = vi.fn().mockResolvedValue({
      data: {
        id: "factor-1",
        type: "totp",
        totp: { qr_code: "data:image/svg+xml;base64,abc", secret: "SECRET" },
      },
      error: null,
    });
    await expect(enrollTotp({ enroll })).resolves.toEqual({
      ok: true,
      message: "Scan the code, then enter the six-digit number.",
      data: {
        factorId: "factor-1",
        qrCode: "data:image/svg+xml;base64,abc",
        secret: "SECRET",
      },
    });
  });

  it.each([
    ["mfa_factor_name_conflict", "factor_conflict"],
    ["too_many_enrolled_mfa_factors", "factor_conflict"],
    ["mfa_verified_factor_exists", "factor_conflict"],
    ["mfa_totp_enroll_not_enabled", "enrollment_unavailable"],
    ["session_expired", "authentication_required"],
    ["bad_jwt", "authentication_required"],
    ["unexpected_failure", "provider_error"],
  ])("classifies MFA provider code %s without using provider messages", (code, expected) => {
    expect(classifyMfaEnrollmentFailure({
      code,
      message: "sensitive provider detail that must not be surfaced",
    })).toBe(expected);
  });

  it("classifies missing TOTP enrollment material separately", async () => {
    const diagnostics: string[] = [];
    await expect(enrollTotp({
      enroll: vi.fn().mockResolvedValue({ data: { id: "factor-1" }, error: null }),
    }, {
      reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    })).resolves.toEqual({
      ok: false,
      message: "Unable to start MFA enrollment.",
    });
    expect(diagnostics).toEqual(["malformed_enrollment_response"]);
  });

  it("reports only a sanitized MFA diagnostic classification", async () => {
    const diagnostics: string[] = [];
    await expect(enrollTotp({
      enroll: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "mfa_factor_name_conflict",
          message: "factor secret and provider detail",
        },
      }),
    }, {
      reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    })).resolves.toEqual({
      ok: false,
      message: "An authenticator is already enrolled or awaiting verification.",
    });
    expect(diagnostics).toEqual(["factor_conflict"]);
  });
});
