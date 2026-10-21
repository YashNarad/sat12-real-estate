"use client";

import { useActionState } from "react";
import type { ActionState } from "@/types/managed-property";
import { SubmissionStatus } from "./SubmissionStatus";

const initialState: ActionState = { ok: false, code: "VALIDATION", message: "" };

export function LifecycleAction({ action, label, pendingLabel, destructive = false }: {
  action: (state: ActionState) => Promise<ActionState>; label: string; pendingLabel: string; destructive?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="grid gap-2"><button className={destructive ? "text-sm font-semibold text-red-700 disabled:opacity-60" : "rounded-lg bg-[var(--sat-red)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"} disabled={pending} type="submit">{pending ? pendingLabel : label}</button><SubmissionStatus message={state.message} ok={state.ok} /></form>;
}
