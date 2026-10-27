"use client";

import { useActionState } from "react";
import { updateEnquiryStatusAction } from "@/app/actions/enquiries";
import type { EnquiryResult } from "@/features/enquiries/service";
import type { EnquiryStatus } from "@/features/enquiries/schema";

const initialState: EnquiryResult = { ok: false, code: "VALIDATION", message: "" };

export function EnquiryStatusForm({ enquiryId, status }: { enquiryId: string; status: EnquiryStatus }) {
  const [state, action, pending] = useActionState(updateEnquiryStatusAction, initialState);
  return <form action={action} className="flex flex-wrap items-end gap-3">
    <input name="enquiryId" type="hidden" value={enquiryId} />
    <label className="grid gap-1 text-xs font-semibold text-zinc-600">Lead status
      <select className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm" defaultValue={status} disabled={pending} name="status">
        <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
      </select>
    </label>
    <button className="min-h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Updating…" : "Update status"}</button>
    {state.message && <p aria-live="polite" className={`w-full text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
  </form>;
}
