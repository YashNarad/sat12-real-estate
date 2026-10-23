import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000002";

const harness = vi.hoisted(() => ({
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/features/auth/authorization", () => ({
  requireAal2Admin: vi.fn(async () => ({ id: ADMIN_ID, role: "admin", aal: "aal2" })),
}));
vi.mock("@/app/actions/moderation", () => ({
  approveOwnerAgent: vi.fn(),
  initialAdminRoleActionState: { ok: false, message: "" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        neq: (column: string, value: unknown) => {
          harness.filters.push([`neq:${column}`, value]);
          return {
            in: (roleColumn: string, roles: unknown) => {
              harness.filters.push([`in:${roleColumn}`, roles]);
              return {
                order: async () => ({
                  data: [
                    { id: USER_ID, full_name: "Second Account", role: "user", agency_name: null, created_at: "2026-01-01" },
                    { id: "10000000-0000-4000-8000-000000000003", full_name: "Approved Agent", role: "owner_agent", agency_name: null, created_at: "2026-01-02" },
                  ],
                  error: null,
                }),
              };
            },
          };
        },
      }),
    }),
  })),
}));

import AdminUsersPage from "./page";

describe("AdminUsersPage", () => {
  it("excludes the acting admin and presents exact pending user targets", async () => {
    render(await AdminUsersPage());

    expect(screen.getByRole("heading", { name: "Owner and agent approvals" })).toBeInTheDocument();
    expect(screen.getByText("Second Account")).toBeInTheDocument();
    expect(screen.getByText(USER_ID)).toBeInTheDocument();
    expect(screen.getByText("Approved Agent")).toBeInTheDocument();
    expect(harness.filters).toEqual([
      ["neq:id", ADMIN_ID],
      ["in:role", ["user", "owner_agent"]],
    ]);
  });
});
