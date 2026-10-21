import { redirect } from "next/navigation";
import { connection } from "next/server";

import { logoutAction } from "@/app/actions/auth";
import { AuthorizationError, requireUser } from "@/features/auth/authorization";

export const instant = false;

export default async function AccountPage() {
  await connection();
  let principal;
  try {
    principal = await requireUser();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/auth/login?next=%2Faccount");
    throw error;
  }
  return (
    <main className="min-h-screen bg-[var(--sat-page)] px-5 py-12">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--sat-border)] bg-white p-8">
        <h1 className="text-2xl font-bold text-[var(--sat-charcoal)]">Your SAT12 account</h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-zinc-500">Name</dt><dd className="mt-1 font-medium text-zinc-900">{principal.fullName ?? "Not provided"}</dd></div>
          <div><dt className="text-zinc-500">Email</dt><dd className="mt-1 font-medium text-zinc-900">{principal.email ?? "Unavailable"}</dd></div>
          <div><dt className="text-zinc-500">Account role</dt><dd className="mt-1 font-medium capitalize text-zinc-900">{principal.role.replace("_", " / ")}</dd></div>
          <div><dt className="text-zinc-500">Security level</dt><dd className="mt-1 font-medium uppercase text-zinc-900">{principal.aal}</dd></div>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <a className="rounded-lg border border-[var(--sat-border)] px-5 py-3 text-sm font-semibold text-zinc-800" href="/auth/mfa">Manage authenticator</a>
          <form action={logoutAction}><button className="rounded-lg bg-[var(--sat-red)] px-5 py-3 text-sm font-semibold text-white" type="submit">Sign out</button></form>
        </div>
      </section>
    </main>
  );
}
