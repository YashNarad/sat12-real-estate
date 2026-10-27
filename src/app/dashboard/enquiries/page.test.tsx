import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as unknown, eqCalls: [] as unknown[][] }));
vi.mock("@/features/auth/authorization", () => ({ requireRole: vi.fn(async () => ({ id: "owner-a", role: "owner_agent" })) }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => ({ from: () => ({ select: () => ({ eq: (...args: unknown[]) => { harness.eqCalls.push(args); return { eq: (...filter: unknown[]) => { harness.eqCalls.push(filter); return { order: async () => ({ data: harness.rows, error: harness.error }) }; }, order: async () => ({ data: harness.rows, error: harness.error }) }; } }) }) })) }));
vi.mock("@/components/enquiries/EnquiryStatusForm", () => ({ EnquiryStatusForm: ({ enquiryId }: { enquiryId: string }) => <div aria-label={`Status controls for ${enquiryId}`} /> }));

import EnquiriesPage from "./page";

describe("owner enquiry inbox", () => {
  it("shows only recipient-scoped leads with property context", async () => {
    harness.eqCalls = []; harness.error = null;
    harness.rows = [{ id: "lead-1", name: "Buyer", email: "buyer@example.test", phone: null, message: "Please arrange a viewing.", status: "new", created_at: "2026-10-27T10:00:00Z", submission_revision: { title: "Nagpur home" } }];
    render(await EnquiriesPage({ searchParams: Promise.resolve({}) }));
    expect(harness.eqCalls).toContainEqual(["recipient_id", "owner-a"]);
    expect(screen.getByText("Nagpur home")).toBeInTheDocument();
    expect(screen.getByText("buyer@example.test")).toBeInTheDocument();
  });

  it("supports a validated status filter and an empty state", async () => {
    harness.eqCalls = []; harness.rows = [];
    render(await EnquiriesPage({ searchParams: Promise.resolve({ status: "closed" }) }));
    expect(harness.eqCalls).toContainEqual(["status", "closed"]);
    expect(screen.getByText("No enquiries match this filter")).toBeInTheDocument();
  });

  it("does not expose database errors", async () => {
    harness.error = { message: "private buyer row and SQL" };
    render(await EnquiriesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enquiries unavailable");
    expect(screen.queryByText(/private buyer row/)).not.toBeInTheDocument();
  });
});
