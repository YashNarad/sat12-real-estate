import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("next/server", () => ({ connection: vi.fn(async () => harness.calls.push("connection")) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireAal2Admin: vi.fn(async () => harness.calls.push("requireAal2Admin")),
}));

import AdminLayout from "./layout";

describe("AdminLayout", () => {
  it("enters request time and verifies AAL2 Admin authorization", async () => {
    render(await AdminLayout({ children: <p>Admin content</p> }));
    expect(screen.getByText("Admin content")).toBeInTheDocument();
    expect(harness.calls).toEqual(["connection", "requireAal2Admin"]);
  });
});
