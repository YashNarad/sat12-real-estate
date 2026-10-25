import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => harness.calls.push("connection")) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), usePathname: () => "/dashboard" }));
vi.mock("@/app/actions/auth", () => ({ logoutAction: vi.fn() }));
vi.mock("@/features/auth/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireUser: vi.fn(async () => {
    harness.calls.push("requireUser");
    return { aal: "aal1", email: "member@example.test", fullName: "Member", role: "user" };
  }),
}));

import DashboardLayout from "./layout";

describe("DashboardLayout", () => {
  it("verifies the authenticated account before rendering the portal", async () => {
    render(await DashboardLayout({ children: <p>Dashboard content</p> }));
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(harness.calls).toEqual(["connection", "requireUser"]);
  });
});
