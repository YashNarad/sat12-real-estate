import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { enrollMfaAction, logoutAction, verifyMfaAction } from "@/app/actions/auth";
import { MfaEnrollmentForm, TotpChallengeForm } from "@/components/auth/MfaForm";
import { ManagementPortalShell } from "@/components/management/ManagementPortalShell";
import { AuthorizationError, requireUser, safeReturnPath } from "@/features/auth/authorization";
import { createServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const client = await createServerClient();
  const next = safeReturnPath((await searchParams).next, "/account");
  let principal;
  try {
    principal = await requireUser({ client });
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(`/auth/login?next=${encodeURIComponent("/auth/mfa")}`);
    throw error;
  }
  const factors = await client.auth.mfa.listFactors();
  const verified = factors.data?.totp.find((factor) => factor.status === "verified");

  const displayName = principal.fullName?.trim() || principal.email || "SAT12 account";
  return <ManagementPortalShell account={{ aal: principal.aal, displayName, role: principal.role }} logoutAction={logoutAction}>
    <main className="grid min-h-[70vh] place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--sat-border)] bg-white p-6 shadow-[0_18px_60px_rgba(24,24,27,0.08)] sm:p-8">
        <Link className="text-sm font-semibold text-[var(--sat-red)]" href="/dashboard">← Back to Dashboard</Link>
        <h1 className="mt-7 text-2xl font-bold text-[var(--sat-charcoal)]">Secure your account</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Administrators must verify a TOTP authenticator before accessing protected operations.</p>
        <div className="mt-7">
          {verified ? (
            <>
              <TotpChallengeForm action={verifyMfaAction.bind(null, { ok: false, message: "" })} factorId={verified.id} next={next} />
              <div className="mt-7 border-t border-[var(--sat-border)] pt-5">
                <p className="mb-3 text-sm leading-6 text-zinc-600">A replacement is verified before the current authenticator is removed, preventing accidental lockout.</p>
                <MfaEnrollmentForm enrollAction={enrollMfaAction} next={next} replaceFactorId={verified.id} verifyAction={verifyMfaAction} />
              </div>
            </>
          ) : (
            <MfaEnrollmentForm enrollAction={enrollMfaAction} next={next} verifyAction={verifyMfaAction} />
          )}
        </div>
      </section>
    </main>
  </ManagementPortalShell>;
}
