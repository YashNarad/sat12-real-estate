import Link from "next/link";
import { notFound } from "next/navigation";
import { createRevision, deletePropertyImage, submitListing, updateDraft } from "@/app/actions/properties";
import { PropertyEditor } from "@/components/dashboard/PropertyEditor";
import { PropertyImageManager } from "@/components/dashboard/PropertyImageManager";
import { LifecycleAction } from "@/components/dashboard/LifecycleAction";
import { createServerClient } from "@/lib/supabase/server";
import type { ManagedRevision } from "@/types/managed-property";

export default async function PropertyRevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createServerClient();
  const { data } = await client.from("property_revisions").select("id, property_id, revision_number, title, description, listing_intent, property_type, price_inr, locality, city, state, postal_code, latitude, longitude, bedrooms, bathrooms, area_sq_ft, construction_status, rera_approved, rera_number, status, rejection_reason, updated_at, properties!inner(id, published_revision_id), property_images(id, storage_path, alt_text, position)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const revision = data as unknown as ManagedRevision & { property_images: { id: string; storage_path: string; alt_text: string; position: number }[] };
  const editable = revision.status === "draft" || revision.status === "rejected";
  const update = updateDraft.bind(null, revision.id);
  async function submit() { "use server"; return submitListing(revision.id); }
  async function clone() { "use server"; return createRevision(revision.property_id); }
  return <main className="mx-auto max-w-5xl px-5 py-10"><Link className="text-sm font-semibold text-[var(--sat-red)]" href="/dashboard/properties">← My properties</Link><div className="mt-5 grid gap-6">
    <section className="rounded-2xl border border-[var(--sat-border)] bg-white p-6 sm:p-8"><div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">{revision.title}</h1><p className="mt-1 text-sm text-zinc-500">Revision {revision.revision_number} · <span className="capitalize">{revision.status}</span></p></div>{editable ? <LifecycleAction action={submit} label="Submit for review" pendingLabel="Submitting…" /> : null}</div>
      {revision.rejection_reason ? <p className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">Reviewer note: {revision.rejection_reason}</p> : null}
      {editable ? <PropertyEditor action={update} revision={revision} /> : <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">This revision is locked while it is {revision.status}. Published edits must start as a new private revision.</p>}
      {revision.status === "published" ? <div className="mt-5"><LifecycleAction action={clone} label="Create private revision" pendingLabel="Creating…" /></div> : null}
    </section>
    <section className="rounded-2xl border border-[var(--sat-border)] bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Property images</h2>
      {revision.property_images.length ? <ul className="mt-4 grid gap-3">{revision.property_images.sort((a,b)=>a.position-b.position).map((image) => {
        async function remove() { "use server"; return deletePropertyImage(image.id, image.storage_path, revision.id); }
        return <li className="flex items-start justify-between gap-4 rounded-lg border border-[var(--sat-border)] p-4" key={image.id}><span className="text-sm">{image.alt_text}</span>{editable ? <LifecycleAction action={remove} destructive label="Delete" pendingLabel="Deleting…" /> : null}</li>;
      })}</ul> : <p className="mt-3 text-sm text-zinc-500">No images uploaded yet.</p>}
      <div className="mt-5"><PropertyImageManager editable={editable} nextPosition={revision.property_images.length} propertyId={revision.property_id} revisionId={revision.id} /></div>
    </section>
  </div></main>;
}
