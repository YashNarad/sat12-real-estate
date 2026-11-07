import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/features/auth/authorization";
import {
  ADMIN_ENQUIRY_PAGE_SIZE,
  getAdminEnquiries,
  sanitizeEnquirySearchQuery,
  type AdminEnquiryRow,
} from "./admin";

const sampleEnquiry: AdminEnquiryRow = {
  id: "20000000-0000-4000-8000-000000000001",
  property_id: "10000000-0000-4000-8000-000000000001",
  property_revision_id_at_submission: "10000000-0000-4000-8000-000000000002",
  sender_id: "00000000-0000-4000-8000-000000000001",
  recipient_id: "00000000-0000-4000-8000-000000000002",
  name: "Rajesh Sharma",
  email: "rajesh@example.com",
  phone: "+91 98765 43210",
  message: "Interested in scheduling an in-person viewing of this property.",
  status: "new",
  created_at: "2026-10-28T14:30:00.000Z",
  closed_at: null,
  submission_revision: {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Luxury 3BHK in Civil Lines",
    property_id: "10000000-0000-4000-8000-000000000001",
  },
  recipient: {
    id: "00000000-0000-4000-8000-000000000002",
    full_name: "Amit Patel",
    agency_name: "Vidarbha Realty",
    role: "owner_agent",
  },
};

function createMockSupabaseClient(config: {
  data?: AdminEnquiryRow[];
  count?: number;
  error?: unknown;
}) {
  const operations: Array<{ method: string; args: unknown[] }> = [];

  const queryBuilder = {
    eq: (...args: unknown[]) => {
      operations.push({ method: "eq", args });
      return queryBuilder;
    },
    or: (...args: unknown[]) => {
      operations.push({ method: "or", args });
      return queryBuilder;
    },
    order: (...args: unknown[]) => {
      operations.push({ method: "order", args });
      return queryBuilder;
    },
    range: async (...args: unknown[]) => {
      operations.push({ method: "range", args });
      return {
        data: config.error ? null : (config.data ?? [sampleEnquiry]),
        count: config.error ? null : (config.count ?? 1),
        error: config.error ?? null,
      };
    },
  };

  const client = {
    from: (table: string) => {
      operations.push({ method: "from", args: [table] });
      return {
        select: (...args: unknown[]) => {
          operations.push({ method: "select", args });
          return queryBuilder;
        },
      };
    },
  };

  return { client, operations };
}

vi.mock("@/features/auth/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/authorization")>();
  return {
    ...actual,
    requireAal2Admin: vi.fn(async () => ({
      id: "admin-uuid",
      role: "admin",
      aal: "aal2",
    })),
  };
});

describe("sanitizeEnquirySearchQuery", () => {
  it("removes dangerous and punctuation characters while preserving legitimate search terms", () => {
    expect(sanitizeEnquirySearchQuery("  rajesh.sharma@example.com  ")).toBe("rajesh.sharma@example.com");
    expect(sanitizeEnquirySearchQuery("drop table enquiries; --")).toBe("drop table enquiries --");
    expect(sanitizeEnquirySearchQuery("buyer <script>alert(1)</script>")).toBe("buyer scriptalert1script");
    expect(sanitizeEnquirySearchQuery("a".repeat(100))).toHaveLength(50);
    expect(sanitizeEnquirySearchQuery(null)).toBe("");
  });
});

describe("getAdminEnquiries", () => {
  it("enforces requireAal2Admin before querying database", async () => {
    const { requireAal2Admin } = await import("@/features/auth/authorization");
    const { client, operations } = createMockSupabaseClient({});

    const result = await getAdminEnquiries({ client });

    expect(requireAal2Admin).toHaveBeenCalledWith({ client });
    expect(operations.find((op) => op.method === "from")?.args).toEqual(["enquiries"]);
    expect(result.enquiries).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.error).toBeNull();
  });

  it("propagates AuthorizationError if user is not an AAL2 admin", async () => {
    const { requireAal2Admin } = await import("@/features/auth/authorization");
    vi.mocked(requireAal2Admin).mockRejectedValueOnce(new AuthorizationError("MFA_REQUIRED"));

    const { client } = createMockSupabaseClient({});

    await expect(getAdminEnquiries({ client })).rejects.toThrow(AuthorizationError);
  });

  it("applies status filter when valid status is passed", async () => {
    const { client, operations } = createMockSupabaseClient({});

    const result = await getAdminEnquiries({ client, status: "spam" });

    expect(operations).toContainEqual({ method: "eq", args: ["status", "spam"] });
    expect(result.filterStatus).toBe("spam");
  });

  it("ignores invalid status filters", async () => {
    const { client, operations } = createMockSupabaseClient({});

    const result = await getAdminEnquiries({ client, status: "nonexistent" });

    const eqOp = operations.find((op) => op.method === "eq");
    expect(eqOp).toBeUndefined();
    expect(result.filterStatus).toBeNull();
  });

  it("applies sanitized search filter when search query is at least 2 characters", async () => {
    const { client, operations } = createMockSupabaseClient({});

    const result = await getAdminEnquiries({ client, query: "Rajesh" });

    expect(operations).toContainEqual({
      method: "or",
      args: ["name.ilike.%Rajesh%,email.ilike.%Rajesh%"],
    });
    expect(result.searchQuery).toBe("Rajesh");
  });

  it("ignores search queries shorter than 2 characters", async () => {
    const { client, operations } = createMockSupabaseClient({});

    const result = await getAdminEnquiries({ client, query: "R" });

    const orOp = operations.find((op) => op.method === "or");
    expect(orOp).toBeUndefined();
    expect(result.searchQuery).toBe("R");
  });

  it("bounds pagination to page size and clamps page numbers", async () => {
    const { client, operations } = createMockSupabaseClient({ count: 45 });

    const result = await getAdminEnquiries({ client, page: 2, pageSize: 20 });

    expect(operations).toContainEqual({
      method: "range",
      args: [20, 39],
    });
    expect(result.currentPage).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.totalCount).toBe(45);
    expect(result.totalPages).toBe(3);
  });

  it("handles negative or invalid page parameters gracefully", async () => {
    const { client, operations } = createMockSupabaseClient({});

    const result = await getAdminEnquiries({ client, page: -5 });

    expect(operations).toContainEqual({
      method: "range",
      args: [0, ADMIN_ENQUIRY_PAGE_SIZE - 1],
    });
    expect(result.currentPage).toBe(1);
  });

  it("isolates database errors safely without throwing unhandled exceptions", async () => {
    const { client } = createMockSupabaseClient({
      error: { code: "42501", message: "permission denied for table enquiries" },
    });

    const result = await getAdminEnquiries({ client });

    expect(result.enquiries).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.error).toEqual({ code: "QUERY_FAILED" });
  });
});

