import "server-only";

import { requireAal2Admin } from "@/features/auth/authorization";
import { createServerClient } from "@/lib/supabase/server";
import {
  adminEnquiryStatusSchema,
  type AdminEnquiryStatus,
} from "./schema";

export const ADMIN_ENQUIRY_PAGE_SIZE = 20;

export const ADMIN_ENQUIRY_SELECT = `
  id,
  property_id,
  property_revision_id_at_submission,
  sender_id,
  recipient_id,
  name,
  email,
  phone,
  message,
  status,
  created_at,
  closed_at,
  submission_revision:property_revisions!enquiries_property_revision_id_at_submission_property_id_fkey(id, title, property_id),
  recipient:profiles!enquiries_recipient_id_fkey(id, full_name, agency_name, role)
`.replace(/\s+/g, " ").trim();

export interface AdminEnquiryRow {
  id: string;
  property_id: string;
  property_revision_id_at_submission: string;
  sender_id: string | null;
  recipient_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: AdminEnquiryStatus;
  created_at: string;
  closed_at: string | null;
  submission_revision: { id?: string; title: string; property_id?: string } | null;
  recipient: { id: string; full_name: string | null; agency_name: string | null; role: string } | null;
}

export interface GetAdminEnquiriesOptions {
  status?: string | null;
  query?: string | null;
  page?: number | string | null;
  pageSize?: number;
  client?: unknown;
}

export interface AdminEnquiriesResult {
  enquiries: AdminEnquiryRow[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  filterStatus: AdminEnquiryStatus | null;
  searchQuery: string;
  error: { code: "QUERY_FAILED" } | null;
}

interface SupabaseQueryFilter {
  eq(column: string, value: unknown): SupabaseQueryFilter;
  or(filters: string): SupabaseQueryFilter;
  order(column: string, options: { ascending: boolean }): SupabaseQueryFilter;
  range(from: number, to: number): Promise<{ data: AdminEnquiryRow[] | null; count: number | null; error: unknown }>;
}

interface SupabaseAdminClient {
  from(table: "enquiries"): {
    select(columns: string, options: { count: "exact" }): SupabaseQueryFilter;
  };
}

export function sanitizeEnquirySearchQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/[^a-zA-Z0-9@._ -]/g, "").slice(0, 50);
}

export async function getAdminEnquiries(
  options: GetAdminEnquiriesOptions = {},
): Promise<AdminEnquiriesResult> {
  const client = (options.client ?? (await createServerClient())) as SupabaseAdminClient;

  // Strict server-side AAL2 admin authorization check
  await requireAal2Admin({ client });

  // Validate status filter
  const parsedStatus = adminEnquiryStatusSchema.safeParse(options.status);
  const filterStatus = parsedStatus.success ? parsedStatus.data : null;

  // Sanitize search query
  const searchQuery = sanitizeEnquirySearchQuery(options.query);

  // Calculate bounded pagination
  const rawPage = options.page;
  const parsedPage =
    typeof rawPage === "number"
      ? rawPage
      : typeof rawPage === "string" && /^\d+$/.test(rawPage)
        ? parseInt(rawPage, 10)
        : 1;
  const currentPage = Math.max(1, Math.min(parsedPage, 1000));
  const pageSize = Math.max(1, Math.min(options.pageSize ?? ADMIN_ENQUIRY_PAGE_SIZE, 100));
  const offset = (currentPage - 1) * pageSize;

  let queryBuilder = client
    .from("enquiries")
    .select(ADMIN_ENQUIRY_SELECT, { count: "exact" });

  if (filterStatus) {
    queryBuilder = queryBuilder.eq("status", filterStatus);
  }

  if (searchQuery.length >= 2) {
    queryBuilder = queryBuilder.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
  }

  const { data, count, error } = await queryBuilder
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return {
      enquiries: [],
      totalCount: 0,
      currentPage,
      totalPages: 1,
      pageSize,
      filterStatus,
      searchQuery,
      error: { code: "QUERY_FAILED" },
    };
  }

  const totalCount = count ?? (data?.length ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    enquiries: data ?? [],
    totalCount,
    currentPage,
    totalPages,
    pageSize,
    filterStatus,
    searchQuery,
    error: null,
  };
}

