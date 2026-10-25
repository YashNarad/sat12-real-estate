import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ status: "", result: { data: [] as Array<Record<string, unknown>>, error: null as unknown } }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/features/auth/authorization", () => ({ requireAal2Admin: vi.fn(async () => ({ role: "admin", aal: "aal2" })) }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({ select: () => ({ eq: (_field: string, status: string) => { harness.status = status; return { order: async () => harness.result }; } }) }),
  })),
}));

import AdminListingsPage from "./page";

describe("AdminListingsPage", () => {
  it("loads only submitted revisions after AAL2 authorization", async () => {
    harness.result = { data: [], error: null };
    render(await AdminListingsPage());
    expect(harness.status).toBe("submitted");
    expect(screen.getByRole("heading", { name: "No listings awaiting review" })).toBeInTheDocument();
  });

  it("keeps queue errors scoped to the moderation workspace", async () => {
    harness.result = { data: [], error: { code: "42501" } };
    render(await AdminListingsPage());
    expect(screen.getByRole("heading", { name: "Moderation queue unavailable" })).toBeInTheDocument();
  });

  it("links every submitted revision to its exact review page", async () => {
    harness.result = { data: [{ id: "10000000-0000-4000-8000-000000000002", property_id: "10000000-0000-4000-8000-000000000003", title: "Submitted home", status: "submitted", revision_number: 1, updated_at: "2026-10-25T00:00:00Z" }], error: null };
    render(await AdminListingsPage());
    expect(screen.getByRole("link", { name: "Review listing" })).toHaveAttribute("href", "/admin/listings/10000000-0000-4000-8000-000000000002");
  });
});
