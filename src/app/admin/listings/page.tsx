import { connection } from "next/server";
import Link from "next/link";

import { requireAal2Admin } from "@/features/auth/authorization";
import { createServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminListingsPage() {
  await connection();
  const client = await createServerClient();
  await requireAal2Admin({ client });
  const { data, error } = await client.from("property_revisions")
    .select("id, property_id, title, status, revision_number, updated_at")
    .eq("status", "submitted")
    .order("updated_at", { ascending: true });
  return <main className="px-5 py-10 sm:px-8 lg:px-10"><div className="mx-auto max-w-6xl"><p className="text-sm font-semibold text-[var(--sat-red)]">ADMIN REVIEW</p><h1 className="mt-2 text-3xl font-bold">Property moderation</h1><p className="mt-2 max-w-2xl leading-7 text-zinc-600">Listings awaiting an authenticated, AAL2-protected moderation decision.</p>{error ? <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6" role="alert"><h2 className="font-bold text-red-900">Moderation queue unavailable</h2><p className="mt-1 text-sm text-red-800">The queue could not be loaded safely. No listing state changed.</p></section> : !data?.length ? <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-7"><h2 className="font-bold">No listings awaiting review</h2><p className="mt-1 text-sm text-zinc-600">Submitted property revisions will appear here.</p></section> : <section className="mt-8 grid gap-4" aria-label="Submitted property revisions">{data.map((revision) => <article className="rounded-xl border border-zinc-200 bg-white p-6" key={revision.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold">{revision.title}</h2><p className="mt-1 text-sm text-zinc-500">Revision {revision.revision_number} · Submitted</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Awaiting decision</span></div><Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--sat-red)] px-4 py-2 text-sm font-semibold text-white" href={`/admin/listings/${revision.id}`}>Review listing</Link></article>)}</section>}</div></main>;
}
