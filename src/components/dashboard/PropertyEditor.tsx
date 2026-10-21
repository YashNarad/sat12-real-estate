"use client";

import { useActionState } from "react";
import type { ActionState, ManagedRevision } from "@/types/managed-property";
import { SubmissionStatus } from "./SubmissionStatus";

const initialState: ActionState = { ok: false, code: "VALIDATION", message: "" };
type EditorAction = (state: ActionState, data: FormData) => Promise<ActionState>;

export function PropertyEditor({ action, revision }: { action: EditorAction; revision?: ManagedRevision }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const error = (field: string) => state.ok ? undefined : state.fieldErrors?.[field]?.[0];
  return <form action={formAction} className="grid gap-5" noValidate>
    {revision ? <input name="updatedAt" type="hidden" value={revision.updated_at} /> : null}
    <div><label className="text-sm font-semibold" htmlFor="title">Listing title</label><input className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-4" defaultValue={revision?.title} id="title" name="title" required /><p className="text-sm text-red-700">{error("title")}</p></div>
    <div><label className="text-sm font-semibold" htmlFor="description">Description</label><textarea className="mt-2 min-h-32 w-full rounded-lg border border-[var(--sat-border)] p-4" defaultValue={revision?.description} id="description" name="description" /><p className="text-sm text-red-700">{error("description")}</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Listing intent<select className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-3" defaultValue={revision?.listing_intent ?? "buy"} name="listingIntent"><option value="buy">Buy</option><option value="rent">Rent</option></select></label>
      <label className="text-sm font-semibold">Property type<select className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-3" defaultValue={revision?.property_type ?? "apartment"} name="propertyType"><option value="apartment">Apartment</option><option value="villa">Villa</option><option value="independent_house">Independent house</option><option value="plot">Residential plot</option></select></label>
      <Field name="priceInr" label="Price in INR" type="number" value={revision?.price_inr} error={error("priceInr")} />
      <Field name="areaSqFt" label="Area (sq ft)" type="number" value={revision?.area_sq_ft} error={error("areaSqFt")} />
      <Field name="locality" label="Locality" value={revision?.locality} error={error("locality")} />
      <Field name="postalCode" label="PIN code" value={revision?.postal_code ?? ""} error={error("postalCode")} />
      <Field name="latitude" label="Latitude" type="number" step="any" value={revision?.latitude ?? 21.1458} error={error("latitude")} />
      <Field name="longitude" label="Longitude" type="number" step="any" value={revision?.longitude ?? 79.0882} error={error("longitude")} />
      <Field name="bedrooms" label="Bedrooms" type="number" value={revision?.bedrooms ?? 0} error={error("bedrooms")} />
      <Field name="bathrooms" label="Bathrooms" type="number" value={revision?.bathrooms ?? 0} error={error("bathrooms")} />
      <label className="text-sm font-semibold">Construction status<select className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-3" defaultValue={revision?.construction_status ?? "ready_to_move"} name="constructionStatus"><option value="ready_to_move">Ready to move</option><option value="under_construction">Under construction</option></select></label>
      <Field name="reraNumber" label="RERA number" value={revision?.rera_number ?? ""} error={error("reraNumber")} />
    </div>
    <label className="flex items-center gap-3 text-sm"><input defaultChecked={revision?.rera_approved} name="reraApproved" type="checkbox" /> RERA approved</label>
    <input name="city" type="hidden" value="Nagpur" /><input name="state" type="hidden" value="Maharashtra" />
    <SubmissionStatus message={state.message} ok={state.ok} />
    <button className="h-12 rounded-lg bg-[var(--sat-red)] px-6 font-semibold text-white disabled:opacity-60 sm:w-fit" disabled={pending} type="submit">{pending ? "Saving…" : revision ? "Save draft" : "Create draft"}</button>
  </form>;
}

function Field({ name, label, value, type = "text", step, error }: { name: string; label: string; value?: string | number; type?: string; step?: string; error?: string }) {
  return <label className="text-sm font-semibold">{label}<input className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-4" defaultValue={value} name={name} step={step} type={type} /><span className="block font-normal text-red-700">{error}</span></label>;
}
