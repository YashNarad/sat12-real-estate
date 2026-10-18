"use server";

import { redirect } from "next/navigation";

import { AuthorizationError, hasRecentMfa, requireUser, safeReturnPath } from "@/features/auth/authorization";
import {
  type AuthActionState,
  enrollTotp,
  loginWithPassword,
  requestPasswordRecovery,
  signUpWithPassword,
  updatePassword,
  verifyTotp,
} from "@/features/auth/operations";
import { createServerClient } from "@/lib/supabase/server";
import { getTrustedSiteOrigin } from "@/lib/supabase/config";

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function signupAction(_state: AuthActionState, formData: FormData) {
  const client = await createServerClient();
  return signUpWithPassword(client.auth, values(formData), getTrustedSiteOrigin());
}

export async function loginAction(_state: AuthActionState, formData: FormData) {
  const client = await createServerClient();
  const result = await loginWithPassword(client.auth, values(formData));
  if (!result.ok) return result;

  let principal;
  try {
    principal = await requireUser({ client });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: "Your account profile is not ready. Please try again." };
    }
    throw error;
  }
  const next = safeReturnPath(formData.get("next")?.toString());
  redirect(
    principal.role === "admin" && !hasRecentMfa(principal)
      ? `/auth/mfa?next=${encodeURIComponent(next)}`
      : next,
  );
}

export async function recoverAction(_state: AuthActionState, formData: FormData) {
  const client = await createServerClient();
  return requestPasswordRecovery(client.auth, values(formData), getTrustedSiteOrigin());
}

export async function updatePasswordAction(_state: AuthActionState, formData: FormData) {
  const client = await createServerClient();
  try {
    await requireUser({ client });
  } catch {
    return { ok: false, message: "Open a fresh password-reset link and try again." };
  }
  return updatePassword(client.auth, values(formData));
}

export async function logoutAction() {
  const client = await createServerClient();
  await client.auth.signOut();
  redirect("/auth/login");
}

export async function enrollMfaAction(_state: AuthActionState) {
  void _state;
  const client = await createServerClient();
  try {
    await requireUser({ client });
  } catch {
    return { ok: false, message: "Sign in again before enrolling MFA." };
  }
  return enrollTotp(client.auth.mfa);
}

export async function verifyMfaAction(_state: AuthActionState, formData: FormData) {
  const client = await createServerClient();
  try {
    await requireUser({ client });
  } catch {
    return { ok: false, message: "Sign in again before verifying MFA." };
  }
  const result = await verifyTotp(client.auth.mfa, values(formData));
  if (!result.ok) return result;
  redirect(safeReturnPath(formData.get("next")?.toString(), "/account"));
}
