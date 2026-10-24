"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/types/managed-property";
import { SubmissionStatus } from "./SubmissionStatus";

const initialState: ActionState = { ok: false, code: "VALIDATION", message: "" };

export function LifecycleAction({ action, label, pendingLabel, destructive = false, trackedFormId }: {
  action: (state: ActionState) => Promise<ActionState>; label: string; pendingLabel: string; destructive?: boolean; trackedFormId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [dirty, setDirty] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!trackedFormId) return;
    const form = document.getElementById(trackedFormId);
    if (!form) return;
    const markDirty = () => setDirty(true);
    const markSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ formId?: string }>).detail;
      if (detail?.formId === trackedFormId) setDirty(false);
    };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    window.addEventListener("sat12:draft-saved", markSaved);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      window.removeEventListener("sat12:draft-saved", markSaved);
    };
  }, [trackedFormId]);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  const disabled = pending || dirty || state.ok;
  const buttonLabel = dirty ? "Save changes before submitting" : pending ? pendingLabel : state.ok ? "Submitted" : label;
  return <form action={formAction} className="grid gap-2"><button className={destructive ? "text-sm font-semibold text-red-700 disabled:opacity-60" : "rounded-lg bg-[var(--sat-red)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"} disabled={disabled} type="submit">{buttonLabel}</button>{dirty ? <p className="text-sm text-amber-800">Save your draft before submitting it for review.</p> : null}<SubmissionStatus message={state.message} ok={state.ok} /></form>;
}
