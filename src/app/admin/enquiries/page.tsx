import Link from "next/link";
import { connection } from "next/server";

import {
  getAdminEnquiries,
  type AdminEnquiryRow,
} from "@/features/enquiries/admin";
import type { AdminEnquiryStatus } from "@/features/enquiries/schema";

export const instant = false;

interface AdminEnquiriesPageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
  }>;
}

const statusTabs: Array<{ label: string; value: AdminEnquiryStatus | null }> = [
  { label: "All", value: null },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Closed", value: "closed" },
  { label: "Spam", value: "spam" },
];

function buildUrl({
  status,
  q,
  page,
}: {
  status?: string | null;
  q?: string | null;
  page?: number | null;
}): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/admin/enquiries?${queryString}` : "/admin/enquiries";
}

function StatusBadge({ status }: { status: AdminEnquiryStatus }) {
  switch (status) {
    case "new":
      return (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          New
        </span>
      );
    case "contacted":
      return (
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
          Contacted
        </span>
      );
    case "closed":
      return (
        <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
          Closed
        </span>
      );
    case "spam":
      return (
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
          Spam
        </span>
      );
  }
}

export default async function AdminEnquiriesPage({
  searchParams,
}: AdminEnquiriesPageProps) {
  await connection();
  const { status, q, page } = await searchParams;

  const result = await getAdminEnquiries({
    status,
    query: q,
    page,
  });

  const {
    enquiries,
    totalCount,
    currentPage,
    totalPages,
    pageSize,
    filterStatus,
    searchQuery,
    error,
  } = result;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  return (
    <main className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--sat-red)]">ADMIN</p>
            <h1 className="mt-1 text-3xl font-bold text-[var(--sat-charcoal)]">
              Buyer enquiries
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Audit and monitor buyer enquiries submitted for published properties with AAL2 protection.
            </p>
          </div>

          <form
            action="/admin/enquiries"
            className="flex w-full items-center gap-2 sm:w-auto"
            method="GET"
            role="search"
          >
            {filterStatus ? (
              <input name="status" type="hidden" value={filterStatus} />
            ) : null}
            <div className="relative flex-1 sm:w-64">
              <input
                aria-label="Search buyer enquiries by sender name or email"
                className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[var(--sat-red)] focus:outline-none focus:ring-1 focus:ring-[var(--sat-red)]"
                defaultValue={searchQuery}
                name="q"
                placeholder="Search name or email…"
                type="search"
              />
            </div>
            <button
              className="min-h-10 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              type="submit"
            >
              Search
            </button>
            {searchQuery ? (
              <Link
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900"
                href={buildUrl({ status: filterStatus })}
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <nav aria-label="Filter enquiries by status" className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => {
              const active = filterStatus === tab.value;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[var(--sat-red)] bg-red-50 text-[var(--sat-red)]"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                  }`}
                  href={buildUrl({ status: tab.value, q: searchQuery })}
                  key={tab.label}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {!error && totalCount > 0 ? (
            <p className="text-xs text-zinc-500">
              Showing <span className="font-semibold text-zinc-800">{startRecord}–{endRecord}</span> of{" "}
              <span className="font-semibold text-zinc-800">{totalCount}</span> enquiries
            </p>
          ) : null}
        </div>

        {error ? (
          <section
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6"
            role="alert"
          >
            <h2 className="font-bold text-red-900">Enquiries unavailable</h2>
            <p className="mt-1 text-sm text-red-800">
              The enquiry records could not be loaded safely. No buyer information was exposed.
            </p>
          </section>
        ) : enquiries.length === 0 ? (
          <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <h2 className="text-xl font-bold text-zinc-900">No enquiries match this filter</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {searchQuery
                ? `No enquiries matched search query "${searchQuery}".`
                : filterStatus
                  ? `No enquiries currently marked as "${filterStatus}".`
                  : "Submitted property enquiries will appear here."}
            </p>
            {searchQuery || filterStatus ? (
              <Link
                className="mt-4 inline-flex items-center text-sm font-semibold text-[var(--sat-red)] hover:underline"
                href="/admin/enquiries"
              >
                Reset filters
              </Link>
            ) : null}
          </section>
        ) : (
          <section
            aria-label="Buyer enquiries list"
            className="mt-8 grid gap-4"
          >
            {enquiries.map((enquiry: AdminEnquiryRow) => (
              <article
                className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm"
                key={enquiry.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--sat-red)]">
                      {enquiry.submission_revision?.title ? (
                        <Link
                          className="hover:underline"
                          href={`/properties/${enquiry.property_id}`}
                        >
                          {enquiry.submission_revision.title}
                        </Link>
                      ) : (
                        "Published property"
                      )}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-zinc-900">
                      {enquiry.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <a
                        className="text-zinc-700 underline hover:text-[var(--sat-red)]"
                        href={`mailto:${enquiry.email}`}
                      >
                        {enquiry.email}
                      </a>
                      {enquiry.phone ? (
                        <a
                          className="text-zinc-700 underline hover:text-[var(--sat-red)]"
                          href={`tel:${enquiry.phone}`}
                        >
                          {enquiry.phone}
                        </a>
                      ) : (
                        <span className="text-zinc-400">No phone provided</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <StatusBadge status={enquiry.status} />
                    <time
                      className="mt-2 block text-xs text-zinc-500"
                      dateTime={enquiry.created_at}
                    >
                      {new Date(enquiry.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Buyer message
                  </p>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
                    {enquiry.message}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <div>
                    Assigned recipient:{" "}
                    <span className="font-semibold text-zinc-700">
                      {enquiry.recipient?.full_name || enquiry.recipient_id}
                    </span>
                    {enquiry.recipient?.agency_name ? (
                      <span className="text-zinc-500">
                        {" "}
                        ({enquiry.recipient.agency_name})
                      </span>
                    ) : null}
                  </div>

                  {enquiry.closed_at ? (
                    <div>
                      Closed on:{" "}
                      <time dateTime={enquiry.closed_at}>
                        {new Date(enquiry.closed_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        )}

        {!error && totalPages > 1 ? (
          <nav
            aria-label="Enquiry pagination"
            className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-6"
          >
            {currentPage > 1 ? (
              <Link
                aria-label="Previous page"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                href={buildUrl({
                  status: filterStatus,
                  q: searchQuery,
                  page: currentPage - 1,
                })}
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-300">
                Previous
              </span>
            )}

            <span className="text-sm text-zinc-600">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link
                aria-label="Next page"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                href={buildUrl({
                  status: filterStatus,
                  q: searchQuery,
                  page: currentPage + 1,
                })}
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-300">
                Next
              </span>
            )}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
