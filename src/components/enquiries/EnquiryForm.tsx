"use client";

import { cloneElement, useActionState } from "react";
import { createEnquiryAction } from "@/app/actions/enquiries";
import type { EnquiryResult } from "@/features/enquiries/service";

const initialState: EnquiryResult = { ok: false, code: "VALIDATION", message: "" };

export function EnquiryForm({ propertyId, propertyTitle, submissionEnabled }: { propertyId: string; propertyTitle: string; submissionEnabled: boolean }) {
  const [state, action, pending] = useActionState(createEnquiryAction, initialState);
  const disabled = pending || state.ok || !submissionEnabled;
  const field = (name: string) => state.fieldErrors?.[name]?.[0];
  return (
    <section aria-labelledby="enquiry-heading" className="rounded-2xl bg-[var(--sat-charcoal)] p-6 text-white sm:p-8">
      <h2 className="text-xl font-bold" id="enquiry-heading">Enquire now</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">Ask about <strong className="font-semibold text-white">{propertyTitle}</strong>. Your contact details are shared only with the assigned Owner/Agent.</p>
      {!submissionEnabled && <p className="mt-4 rounded-lg border border-amber-400/40 bg-amber-300/10 p-3 text-sm text-amber-100">Enquiries are not available yet. No information will be stored.</p>}
      <form action={action} className="mt-6 grid gap-4" noValidate>
        <input name="propertyId" type="hidden" value={propertyId} />
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label htmlFor={`website-${propertyId}`}>Website</label><input autoComplete="off" id={`website-${propertyId}`} name="website" tabIndex={-1} /></div>
        <Field error={field("name")} label="Full name" name="name"><input autoComplete="name" className={inputClass} disabled={disabled} id={`name-${propertyId}`} maxLength={100} name="name" required /></Field>
        <Field error={field("email")} label="Email" name="email"><input autoComplete="email" className={inputClass} disabled={disabled} id={`email-${propertyId}`} maxLength={320} name="email" required type="email" /></Field>
        <Field error={field("phone")} label="Phone number (optional)" name="phone"><input autoComplete="tel" className={inputClass} disabled={disabled} id={`phone-${propertyId}`} maxLength={20} name="phone" type="tel" /></Field>
        <Field error={field("message")} label="Message" name="message"><textarea className={`${inputClass} min-h-28 resize-y py-3`} disabled={disabled} id={`message-${propertyId}`} maxLength={2000} name="message" required /></Field>
        {state.message && <p aria-live="polite" className={`rounded-lg p-3 text-sm ${state.ok ? "bg-emerald-400/15 text-emerald-100" : "bg-red-400/15 text-red-100"}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
        <button className="min-h-12 rounded-lg bg-white px-5 text-sm font-bold text-[var(--sat-charcoal)] disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled} type="submit">{state.ok ? "Enquiry sent" : !submissionEnabled ? "Enquiries unavailable" : pending ? "Sending securely…" : "Send enquiry"}</button>
        <p className="text-xs leading-5 text-zinc-400">By sending this enquiry, you agree that SAT12 may share these details with the assigned Owner/Agent so they can respond. Retention terms require approval before production launch.</p>
      </form>
    </section>
  );
}

const inputClass = "mt-1.5 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-white focus:outline-none disabled:opacity-60";

function Field({ children, error, label, name }: { children: React.ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>; error?: string; label: string; name: string }) {
  const id = `${name}-error`;
  return <div><label className="text-sm font-semibold" htmlFor={(children.props as { id?: string }).id}>{label}</label>{error ? <p className="mt-1 text-xs text-red-200" id={id}>{error}</p> : null}{cloneElement(children, { "aria-describedby": error ? id : undefined, "aria-invalid": Boolean(error) })}</div>;
}
