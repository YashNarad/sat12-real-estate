import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminEnquiriesResult, AdminEnquiryRow } from "@/features/enquiries/admin";

const harness = vi.hoisted(() => ({
  connectionCalled: false,
  getAdminEnquiriesCalls: [] as unknown[][],
  result: {
    enquiries: [] as AdminEnquiryRow[],
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,
    pageSize: 20,
    filterStatus: null,
    searchQuery: "",
    error: null,
  } as AdminEnquiriesResult,
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {
    harness.connectionCalled = true;
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/enquiries/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/enquiries/admin")>();
  return {
    ...actual,
    getAdminEnquiries: vi.fn(async (options: unknown) => {
      harness.getAdminEnquiriesCalls.push([options]);
      return harness.result;
    }),
  };
});

import AdminEnquiriesPage from "./page";

const mockEnquiry: AdminEnquiryRow = {
  id: "20000000-0000-4000-8000-000000000001",
  property_id: "10000000-0000-4000-8000-000000000001",
  property_revision_id_at_submission: "10000000-0000-4000-8000-000000000002",
  sender_id: "00000000-0000-4000-8000-000000000001",
  recipient_id: "00000000-0000-4000-8000-000000000002",
  name: "Sunita Deshmukh",
  email: "sunita@example.com",
  phone: "+91 91234 56789",
  message: "Interested in visiting the property this Saturday afternoon.",
  status: "new",
  created_at: "2026-10-30T10:15:00.000Z",
  closed_at: null,
  submission_revision: {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Ramdaspeth Penthouse",
    property_id: "10000000-0000-4000-8000-000000000001",
  },
  recipient: {
    id: "00000000-0000-4000-8000-000000000002",
    full_name: "Kavita Rao",
    agency_name: "Nagpur Prime Properties",
    role: "owner_agent",
  },
};

describe("AdminEnquiriesPage", () => {
  it("enters request time and passes search params to getAdminEnquiries", async () => {
    harness.connectionCalled = false;
    harness.getAdminEnquiriesCalls = [];
    harness.result = {
      enquiries: [mockEnquiry],
      totalCount: 1,
      currentPage: 1,
      totalPages: 1,
      pageSize: 20,
      filterStatus: "new",
      searchQuery: "Sunita",
      error: null,
    };

    render(
      await AdminEnquiriesPage({
        searchParams: Promise.resolve({
          status: "new",
          q: "Sunita",
          page: "1",
        }),
      }),
    );

    expect(harness.connectionCalled).toBe(true);
    expect(harness.getAdminEnquiriesCalls).toContainEqual([
      { status: "new", query: "Sunita", page: "1" },
    ]);
    expect(screen.getByRole("heading", { name: "Buyer enquiries" })).toBeInTheDocument();
    expect(screen.getByText("Sunita Deshmukh")).toBeInTheDocument();
    expect(screen.getByText("sunita@example.com")).toHaveAttribute("href", "mailto:sunita@example.com");
    expect(screen.getByText("+91 91234 56789")).toHaveAttribute("href", "tel:+91 91234 56789");
    expect(screen.getByText("Ramdaspeth Penthouse")).toBeInTheDocument();
    expect(screen.getByText("Interested in visiting the property this Saturday afternoon.")).toBeInTheDocument();
    expect(screen.getByText("Kavita Rao")).toBeInTheDocument();
    expect(screen.getByText("(Nagpur Prime Properties)")).toBeInTheDocument();
  });

  it("renders empty state when no enquiries match", async () => {
    harness.result = {
      enquiries: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      pageSize: 20,
      filterStatus: null,
      searchQuery: "",
      error: null,
    };

    render(await AdminEnquiriesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "No enquiries match this filter" })).toBeInTheDocument();
    expect(screen.getByText("Submitted property enquiries will appear here.")).toBeInTheDocument();
  });

  it("renders safe error banner if enquiry retrieval fails", async () => {
    harness.result = {
      enquiries: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      pageSize: 20,
      filterStatus: null,
      searchQuery: "",
      error: { code: "QUERY_FAILED" },
    };

    render(await AdminEnquiriesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Enquiries unavailable" })).toBeInTheDocument();
    expect(
      screen.getByText("The enquiry records could not be loaded safely. No buyer information was exposed."),
    ).toBeInTheDocument();
  });

  it("renders bounded pagination controls when multiple pages exist", async () => {
    harness.result = {
      enquiries: [mockEnquiry],
      totalCount: 45,
      currentPage: 2,
      totalPages: 3,
      pageSize: 20,
      filterStatus: "contacted",
      searchQuery: "",
      error: null,
    };

    render(
      await AdminEnquiriesPage({
        searchParams: Promise.resolve({ status: "contacted", page: "2" }),
      }),
    );

    expect(screen.getByLabelText("Previous page")).toHaveAttribute(
      "href",
      "/admin/enquiries?status=contacted",
    );
    expect(screen.getByLabelText("Next page")).toHaveAttribute(
      "href",
      "/admin/enquiries?status=contacted&page=3",
    );
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });
});

