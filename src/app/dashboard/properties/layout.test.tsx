import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ shouldReject: false }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("@/features/auth/authorization", () => {
  class AuthorizationError extends Error { code = "ROLE_REQUIRED"; }
  return { AuthorizationError, requireRole: vi.fn(async () => { if (harness.shouldReject) throw new AuthorizationError("ROLE_REQUIRED"); }) };
});

import PropertiesLayout from "./layout";

describe("PropertiesLayout", () => {
  it("authorizes owner agents on the server", async () => {
    harness.shouldReject = false;
    render(await PropertiesLayout({ children: <p>Property workspace</p> }));
    expect(screen.getByText("Property workspace")).toBeInTheDocument();
  });

  it("returns non-owner roles to the role-aware dashboard", async () => {
    harness.shouldReject = true;
    await expect(PropertiesLayout({ children: <p>Private properties</p> })).rejects.toThrow("REDIRECT:/dashboard");
  });
});
