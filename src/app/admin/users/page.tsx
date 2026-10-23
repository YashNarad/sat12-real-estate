import { connection } from "next/server";

import { OwnerAgentApprovalForm } from "@/components/admin/OwnerAgentApprovalForm";
import { requireAal2Admin } from "@/features/auth/authorization";
import { createServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminUsersPage() {
  await connection();
  const client = await createServerClient();
  const principal = await requireAal2Admin({ client });
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, role, agency_name, created_at")
    .neq("id", principal.id)
    .in("role", ["user", "owner_agent"])
    .order("created_at", { ascending: true });

  const pending = data?.filter((profile) => profile.role === "user") ?? [];
  const approved = data?.filter((profile) => profile.role === "owner_agent") ?? [];

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-sm font-semibold text-[var(--sat-red)]">ADMIN</p>
      <h1 className="mt-1 text-3xl font-bold text-[var(--sat-charcoal)]">
        Owner and agent approvals
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
        Every approval requires your recent MFA session, the exact target profile, and an audit reason.
      </p>

      {error ? (
        <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-bold text-red-900">Accounts unavailable</h2>
          <p className="mt-1 text-sm text-red-800">The account list could not be loaded safely.</p>
        </section>
      ) : null}

      {!error && pending.length === 0 ? (
        <section className="mt-8 rounded-xl border border-[var(--sat-border)] bg-white p-6">
          <h2 className="font-bold">No accounts awaiting approval</h2>
          <p className="mt-1 text-sm text-zinc-600">New verified accounts remain Users until an administrator approves them.</p>
        </section>
      ) : null}

      {!error && pending.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Awaiting approval</h2>
          <div className="mt-4 grid gap-4">
            {pending.map((profile) => (
              <OwnerAgentApprovalForm
                key={profile.id}
                profile={{ id: profile.id, fullName: profile.full_name }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!error && approved.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Approved owner/agents</h2>
          <div className="mt-4 grid gap-3">
            {approved.map((profile) => (
              <article className="rounded-xl border border-[var(--sat-border)] bg-white p-5" key={profile.id}>
                <h3 className="font-bold">{profile.full_name ?? "Unnamed SAT12 account"}</h3>
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">{profile.id}</p>
                <p className="mt-2 text-sm text-emerald-700">Owner/agent access approved</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
