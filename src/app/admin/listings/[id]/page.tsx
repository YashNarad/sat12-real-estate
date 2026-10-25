import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { ListingModerationPanel } from "@/components/admin/ListingModerationPanel";
import { requireAal2Admin } from "@/features/auth/authorization";
import { createPropertyImageSignedUrl, PROPERTY_IMAGE_BUCKET } from "@/features/property-images/storage";
import { getPublicSupabaseEnvironment } from "@/lib/supabase/config";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type Revision = Database["public"]["Tables"]["property_revisions"]["Row"];
type ReviewRow = Revision & {
  properties: Pick<Database["public"]["Tables"]["properties"]["Row"], "id" | "slug" | "archived_at" | "published_revision_id">;
  property_images: Array<Pick<Database["public"]["Tables"]["property_images"]["Row"], "id" | "storage_path" | "alt_text" | "position">>;
  listing_approvals: Array<Pick<Database["public"]["Tables"]["listing_approvals"]["Row"], "id" | "decision" | "notes" | "created_at">>;
  listing_badge_audit_log: Array<Pick<Database["public"]["Tables"]["listing_badge_audit_log"]["Row"], "id" | "previous_badge" | "new_badge" | "reason" | "created_at">>;
};

function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }

export default async function AdminListingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createServerClient();
  await requireAal2Admin({ client });
  const { data, error } = await client.from("property_revisions").select("*, properties!property_revisions_property_id_fkey!inner(id, slug, archived_at, published_revision_id), property_images(id, storage_path, alt_text, position), listing_approvals!listing_approvals_revision_id_property_id_fkey(id, decision, notes, created_at), listing_badge_audit_log!listing_badge_audit_log_revision_id_property_id_fkey(id, previous_badge, new_badge, reason, created_at)").eq("id", id).maybeSingle();
  if (error || !data) notFound();
  const revision = data as unknown as ReviewRow;
  const { url } = getPublicSupabaseEnvironment();
  const images = await Promise.all(revision.property_images.sort((a, b) => a.position - b.position).map(async (image) => {
    try {
      const signedUrl = await createPropertyImageSignedUrl(client.storage.from(PROPERTY_IMAGE_BUCKET), image.storage_path, url);
      return { ...image, signedUrl };
    } catch { return null; }
  }));
  const visibleImages = images.filter((image): image is NonNullable<typeof image> => Boolean(image));
  const history = [
    ...revision.listing_approvals.map((entry) => ({ id: `approval-${entry.id}`, at: entry.created_at, label: entry.decision === "approved" ? "Listing approved" : "Listing rejected", notes: entry.notes })),
    ...revision.listing_badge_audit_log.map((entry) => ({ id: `badge-${entry.id}`, at: entry.created_at, label: `Badge changed from ${entry.previous_badge ?? "none"} to ${entry.new_badge ?? "none"}`, notes: entry.reason })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return <main className="px-5 py-10 sm:px-8 lg:px-10"><div className="mx-auto max-w-6xl"><Link className="text-sm font-semibold text-[var(--sat-red)]" href="/admin/listings">← Submitted properties</Link><div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--sat-red)]">ADMIN REVIEW</p><h1 className="mt-1 text-3xl font-bold">{revision.title}</h1><p className="mt-2 text-sm text-zinc-500">Revision {revision.revision_number} · <span className="capitalize">{revision.status}</span></p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-800">{revision.status}</span></div><div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="grid gap-6"><section className="rounded-2xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">Listing details</h2><p className="mt-4 whitespace-pre-wrap leading-7 text-zinc-700">{revision.description}</p><dl className="mt-6 grid gap-4 sm:grid-cols-2"><Detail label="Price" value={money(revision.price_inr)} /><Detail label="Location" value={`${revision.locality}, ${revision.city} ${revision.postal_code ?? ""}`.trim()} /><Detail label="Property type" value={revision.property_type.replaceAll("_", " ")} /><Detail label="Intent" value={revision.listing_intent} /><Detail label="Area" value={`${revision.area_sq_ft.toLocaleString("en-IN")} sq ft`} /><Detail label="Bedrooms / bathrooms" value={`${revision.bedrooms} / ${revision.bathrooms}`} /><Detail label="Construction" value={revision.construction_status.replaceAll("_", " ")} /><Detail label="RERA" value={revision.rera_approved ? revision.rera_number || "Approved" : "Not marked approved"} /></dl></section><section className="rounded-2xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">Property images</h2>{visibleImages.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{visibleImages.map((image) => <figure className="overflow-hidden rounded-xl border border-zinc-200" key={image.id}><Image alt={image.alt_text} className="aspect-[4/3] w-full object-cover" height={480} src={image.signedUrl} unoptimized width={640} /><figcaption className="p-3 text-sm text-zinc-600">{image.alt_text}</figcaption></figure>)}</div> : <p className="mt-3 text-sm text-zinc-600">No reviewable images are available.</p>}</section><section className="rounded-2xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">Moderation history</h2>{history.length ? <ol className="mt-4 grid gap-3">{history.map((entry) => <li className="rounded-lg bg-zinc-50 p-4" key={entry.id}><p className="font-semibold">{entry.label}</p>{entry.notes ? <p className="mt-1 text-sm text-zinc-600">{entry.notes}</p> : null}<time className="mt-2 block text-xs text-zinc-500">{new Date(entry.at).toLocaleString("en-IN")}</time></li>)}</ol> : <p className="mt-3 text-sm text-zinc-600">No prior moderation decisions for this revision.</p>}</section></div><aside><ListingModerationPanel propertyId={revision.property_id} revisionId={revision.id} status={revision.status} /></aside></div></div></main>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt><dd className="mt-1 capitalize text-zinc-900">{value}</dd></div>;
}
