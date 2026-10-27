import Link from "next/link";
import { requireRole } from "@/features/auth/authorization";
import { enquiryStatusSchema, type EnquiryStatus } from "@/features/enquiries/schema";
import { EnquiryStatusForm } from "@/components/enquiries/EnquiryStatusForm";
import { createServerClient } from "@/lib/supabase/server";

interface EnquiryRow { id: string; name: string; email: string; phone: string | null; message: string; status: EnquiryStatus; created_at: string; submission_revision: { title: string } | null }
interface QueryResult { data: EnquiryRow[] | null; error: unknown }
interface Query { eq(column: string, value: string): Query & { order(column: string, options: { ascending: false }): Promise<QueryResult> }; order(column: string, options: { ascending: false }): Promise<QueryResult> }
interface EnquiryReadClient { from(table: "enquiries"): { select(columns: string): Query } }

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const principal = await requireRole(["owner_agent"]);
  const requested = (await searchParams).status;
  const status = enquiryStatusSchema.safeParse(requested).success ? requested as EnquiryStatus : null;
  const client = await createServerClient() as unknown as EnquiryReadClient;
  let query = client.from("enquiries").select("id, name, email, phone, message, status, created_at, submission_revision:property_revisions!enquiries_property_revision_id_at_submission_property_id_fkey(title)").eq("recipient_id", principal.id);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false });

  return <main className="px-5 py-10 sm:px-8 lg:px-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--sat-red)]">BUYER ENQUIRIES</p><h1 className="mt-1 text-3xl font-bold">Property leads</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Private buyer messages assigned to your account when they were received.</p></div><nav aria-label="Filter enquiries" className="flex gap-2">{[null, "new", "contacted", "closed"].map((value) => <Link aria-current={status === value ? "page" : undefined} className={`rounded-full border px-3 py-2 text-xs font-semibold ${status === value ? "border-[var(--sat-red)] bg-red-50 text-[var(--sat-red)]" : "border-zinc-200 bg-white"}`} href={value ? `/dashboard/enquiries?status=${value}` : "/dashboard/enquiries"} key={value ?? "all"}>{value ? `${value[0].toUpperCase()}${value.slice(1)}` : "All"}</Link>)}</nav></div>
    {error ? <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6" role="alert"><h2 className="font-bold text-red-900">Enquiries unavailable</h2><p className="mt-1 text-sm text-red-800">Buyer details could not be loaded safely. Try again later.</p></section>
      : !data?.length ? <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center"><h2 className="text-xl font-bold">No enquiries match this filter</h2><p className="mt-2 text-sm text-zinc-600">New buyer messages for your published properties will appear here after Stage 5B activation.</p></section>
        : <section aria-label="Property enquiries" className="mt-8 grid gap-4">{data.map((lead) => <article className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6" key={lead.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold text-[var(--sat-red)]">{lead.submission_revision?.title ?? "Published property"}</p><h2 className="mt-1 text-lg font-bold">{lead.name}</h2><a className="mt-1 block text-sm text-zinc-700 underline" href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone ? <a className="mt-1 block text-sm text-zinc-700 underline" href={`tel:${lead.phone}`}>{lead.phone}</a> : null}</div><div className="text-right"><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold capitalize">{lead.status}</span><time className="mt-2 block text-xs text-zinc-500">{new Date(lead.created_at).toLocaleString("en-IN")}</time></div></div><p className="my-5 whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">{lead.message}</p><EnquiryStatusForm enquiryId={lead.id} status={lead.status} /></article>)}</section>}
  </div></main>;
}
