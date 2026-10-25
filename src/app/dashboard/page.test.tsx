import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ role: "user" as "user" | "owner_agent" | "admin" }));

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/features/auth/authorization", () => ({
  requireUser: vi.fn(async () => ({ aal: "aal1", email: "dev@example.test", fullName: "Dev", id: "user", mfaVerifiedAt: null, role: harness.role })),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it.each([
    ["user", "Account settings"],
    ["owner_agent", "Manage properties"],
    ["admin", "Review properties"],
  ] as const)("shows the relevant next action to %s accounts", async (role, linkName) => {
    harness.role = role;
    render(await DashboardPage());
    expect(screen.getByRole("link", { name: linkName })).toBeInTheDocument();
  });
});
