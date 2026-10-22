import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function OwnerPropertiesPage() {
  const client = await createServerClient();
  // property_revisions is disambiguated via FK hint: properties has two FK relationships
  // to property_revisions (one-to-many via property_id, and the published_revision_id FK).
  // Without the hint PostgREST returns PGRST201 (HTTP 300 Multiple Choices).
  const { data, error } = await client.from("properties").select("id, slug, archived_at, published_revision_id, property_revisions!property_revisions_property_id_fkey(id, title, status, revision_number, rejection_reason, updated_at)").order("updated_at", { ascending: false });
  if (error) return <DashboardMessage title="Properties unavailable" message="We could not load your properties. Please try again." />;
  return <main className="mx-auto max-w-7xl px-5 py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--sat-red)]">OWNER DASHBOARD</p><h1 className="mt-1 text-3xl font-bold">My properties</h1></div><Link className="rounded-lg bg-[var(--sat-red)] px-5 py-3 font-semibold text-white" href="/dashboard/properties/new">Add property</Link></div>
    {!data?.length ? <div className="mt-8"><DashboardMessage title="No properties yet" message="Create your first private draft to get started." /></div> : <div className="mt-8 grid gap-4">{data.map((property) => {
      const raw = property.property_revisions; const revisions = (Array.isArray(raw) ? raw : raw ? [raw] : []).sort((a, b) => b.revision_number - a.revision_number); const revision = revisions[0];
      return <article className="rounded-xl border border-[var(--sat-border)] bg-white p-5" key={property.id}><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-bold">{revision?.title ?? property.slug}</h2><p className="mt-1 text-sm text-zinc-500">Revision {revision?.revision_number ?? "—"} · <span className="capitalize">{revision?.status.replace("_", " ") ?? "draft"}</span></p>{revision?.rejection_reason ? <p className="mt-2 text-sm text-red-700">Review note: {revision.rejection_reason}</p> : null}</div>{revision ? <Link className="rounded-lg border border-[var(--sat-border)] px-4 py-2 text-sm font-semibold" href={`/dashboard/properties/${revision.id}`}>Manage</Link> : null}</div></article>;
    })}</div>}
  </main>;
}

function DashboardMessage({ title, message }: { title: string; message: string }) { return <section className="rounded-xl border border-[var(--sat-border)] bg-white p-8 text-center"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-zinc-600">{message}</p></section>; }
