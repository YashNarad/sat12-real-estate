import { z } from "zod";

export interface AuthActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  data?: Record<string, string>;
}

const emailSchema = z.email("Enter a valid email address.").trim().toLowerCase();
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[A-Z]/u, "Add an uppercase letter.")
  .regex(/[a-z]/u, "Add a lowercase letter.")
  .regex(/[0-9]/u, "Add a number.")
  .regex(/[^A-Za-z0-9]/u, "Add a symbol.");

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, "Enter your full name.").max(100),
});
export const recoverySchema = z.object({ email: emailSchema });
export const updatePasswordSchema = z.object({ password: passwordSchema });
export const totpSchema = z.object({
  factorId: z.string().min(1),
  replaceFactorId: z.string().min(1).optional(),
  code: z.string().regex(/^\d{6}$/u, "Enter the six-digit code."),
}).refine((value) => value.factorId !== value.replaceFactorId, {
  message: "The replacement factor must be different.",
  path: ["factorId"],
});

function invalid(error: z.ZodError): AuthActionState {
  return { ok: false, message: "Check the highlighted fields.", fieldErrors: error.flatten().fieldErrors };
}

interface SignupApi {
  signUp(input: {
    email: string;
    password: string;
    options: { emailRedirectTo: string; data: { full_name: string } };
  }): Promise<{ data: { user: unknown; session: unknown }; error: unknown }>;
}

export async function signUpWithPassword(
  auth: SignupApi,
  input: unknown,
  origin: string,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=%2F`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (result.error || !result.data.user) {
    return { ok: false, message: "We could not create your account. Try again shortly." };
  }
  return { ok: true, message: "Check your email to verify your SAT12 account." };
}

interface LoginApi {
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<{ data: { user: unknown; session: unknown }; error: unknown }>;
}

export async function loginWithPassword(auth: LoginApi, input: unknown): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await auth.signInWithPassword(parsed.data);
  if (result.error || !result.data.session) {
    return { ok: false, message: "Email or password is incorrect." };
  }
  return { ok: true, message: "Signed in successfully." };
}

interface RecoveryApi {
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<unknown>;
}

export async function requestPasswordRecovery(
  auth: RecoveryApi,
  input: unknown,
  origin: string,
): Promise<AuthActionState> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=%2Fauth%2Frecover%3Fmode%3Dreset`,
  });
  return {
    ok: true,
    message: "If an account exists, a password reset link has been sent.",
  };
}

interface TotpApi {
  challenge(input: { factorId: string }): Promise<{ data: { id: string } | null; error: unknown }>;
  verify(input: {
    factorId: string;
    challengeId: string;
    code: string;
  }): Promise<{ data: unknown; error: unknown }>;
  unenroll?(input: { factorId: string }): Promise<{ data: unknown; error: unknown }>;
}

export async function verifyTotp(auth: TotpApi, input: unknown): Promise<AuthActionState> {
  const parsed = totpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const challenged = await auth.challenge({ factorId: parsed.data.factorId });
  if (challenged.error || !challenged.data?.id) {
    return { ok: false, message: "Unable to start MFA verification." };
  }
  const verified = await auth.verify({
    factorId: parsed.data.factorId,
    challengeId: challenged.data.id,
    code: parsed.data.code,
  });
  if (verified.error) return { ok: false, message: "The authentication code is invalid." };
  if (parsed.data.replaceFactorId) {
    if (!auth.unenroll) {
      return { ok: false, message: "The old authenticator could not be removed." };
    }
    const removed = await auth.unenroll({ factorId: parsed.data.replaceFactorId });
    if (removed.error) {
      return {
        ok: false,
        message: "The replacement is active, but the old authenticator could not be removed.",
      };
    }
  }
  return { ok: true, message: "Multi-factor authentication verified." };
}

interface PasswordUpdateApi {
  updateUser(input: { password: string }): Promise<{ data: unknown; error: unknown }>;
}

export async function updatePassword(
  auth: PasswordUpdateApi,
  input: unknown,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await auth.updateUser({ password: parsed.data.password });
  if (result.error) return { ok: false, message: "Unable to update your password." };
  return { ok: true, message: "Your password has been updated." };
}

interface TotpEnrollmentApi {
  enroll(input: { factorType: "totp"; friendlyName: string }): Promise<{
    data: { id: string; totp?: { qr_code: string; secret: string } } | null;
    error: unknown;
  }>;
}

export type MfaEnrollmentDiagnostic =
  | "factor_conflict"
  | "enrollment_unavailable"
  | "authentication_required"
  | "provider_error"
  | "malformed_enrollment_response";

type ProviderErrorShape = { code?: unknown; status?: unknown };

export function classifyMfaEnrollmentFailure(error: unknown): Exclude<MfaEnrollmentDiagnostic, "malformed_enrollment_response"> {
  const providerError = error && typeof error === "object" ? error as ProviderErrorShape : {};
  const code = typeof providerError.code === "string" ? providerError.code : "";
  if ([
    "mfa_factor_name_conflict",
    "too_many_enrolled_mfa_factors",
    "mfa_verified_factor_exists",
    "conflict",
  ].includes(code)) return "factor_conflict";
  if (["mfa_totp_enroll_not_enabled", "provider_disabled"].includes(code)) {
    return "enrollment_unavailable";
  }
  if ([
    "bad_jwt",
    "no_authorization",
    "session_not_found",
    "session_expired",
    "refresh_token_not_found",
    "refresh_token_already_used",
    "user_banned",
    "invalid_credentials",
  ].includes(code) || providerError.status === 401) return "authentication_required";
  return "provider_error";
}

function enrollmentFailureMessage(diagnostic: MfaEnrollmentDiagnostic) {
  if (diagnostic === "factor_conflict") {
    return "An authenticator is already enrolled or awaiting verification.";
  }
  if (diagnostic === "enrollment_unavailable") {
    return "Authenticator enrollment is currently unavailable.";
  }
  if (diagnostic === "authentication_required") {
    return "Sign in again before enrolling MFA.";
  }
  return "Unable to start MFA enrollment.";
}

export async function enrollTotp(
  auth: TotpEnrollmentApi,
  options: { reportDiagnostic?: (diagnostic: MfaEnrollmentDiagnostic) => void } = {},
): Promise<AuthActionState> {
  const result = await auth.enroll({ factorType: "totp", friendlyName: "SAT12 Authenticator" });
  if (result.error) {
    const diagnostic = classifyMfaEnrollmentFailure(result.error);
    options.reportDiagnostic?.(diagnostic);
    return { ok: false, message: enrollmentFailureMessage(diagnostic) };
  }
  if (
    !result.data?.id
    || !result.data.totp?.qr_code
    || !result.data.totp.secret
  ) {
    options.reportDiagnostic?.("malformed_enrollment_response");
    return { ok: false, message: enrollmentFailureMessage("malformed_enrollment_response") };
  }
  return {
    ok: true,
    message: "Scan the code, then enter the six-digit number.",
    data: {
      factorId: result.data.id,
      qrCode: result.data.totp.qr_code,
      secret: result.data.totp.secret,
    },
  };
}
