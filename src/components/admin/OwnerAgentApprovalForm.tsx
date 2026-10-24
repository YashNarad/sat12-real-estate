"use client";

import { useActionState } from "react";

import {
  approveOwnerAgent,
  type AdminRoleActionState,
} from "@/app/actions/moderation";

const initialAdminRoleActionState: AdminRoleActionState = {
  ok: false,
  message: "",
};

export function OwnerAgentApprovalForm({
  profile,
}: {
  profile: { id: string; fullName: string | null };
}) {
  const [state, formAction, pending] = useActionState(
    approveOwnerAgent,
    initialAdminRoleActionState,
  );

  return (
    <form
      action={formAction}
      className="rounded-xl border border-[var(--sat-border)] bg-white p-5"
    >
      <input name="targetProfileId" type="hidden" value={profile.id} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-[var(--sat-charcoal)]">
            {profile.fullName ?? "Unnamed SAT12 account"}
          </h2>
          <p className="mt-1 break-all font-mono text-xs text-zinc-500">{profile.id}</p>
          <p className="mt-2 text-sm text-zinc-600">Current role: User</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Awaiting approval
        </span>
      </div>

      <label
        className="mt-5 block text-sm font-semibold text-zinc-800"
        htmlFor={`reason-${profile.id}`}
      >
        Audit reason
      </label>
      <textarea
        className="mt-2 min-h-24 w-full rounded-lg border border-[var(--sat-border)] px-3 py-2 outline-none focus:border-[var(--sat-red)] focus:ring-2 focus:ring-red-100"
        id={`reason-${profile.id}`}
        maxLength={1000}
        minLength={3}
        name="reason"
        placeholder="Why is this account approved to manage property listings?"
        required
      />
      {state.fieldErrors?.reason?.[0] ? (
        <p className="mt-2 text-sm text-red-700">{state.fieldErrors.reason[0]}</p>
      ) : null}
      {state.message ? (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-4 rounded-lg bg-[var(--sat-red)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || state.ok}
        type="submit"
      >
        {pending ? "Approving…" : state.ok ? "Approved" : "Approve owner/agent"}
      </button>
    </form>
  );
}
