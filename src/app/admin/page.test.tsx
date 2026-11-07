import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/features/auth/authorization", () => ({ requireAal2Admin: vi.fn(async () => ({ role: "admin", aal: "aal2" })) }));

import AdminPage from "./page";

describe("AdminPage", () => {
  it("provides the protected Admin portal destinations", async () => {
    render(await AdminPage());
    expect(screen.getByRole("heading", { name: "Administration overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /submitted properties/i })).toHaveAttribute("href", "/admin/listings");
    expect(screen.getByRole("link", { name: /user approvals/i })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: /buyer enquiries/i })).toHaveAttribute("href", "/admin/enquiries");
    expect(screen.getByRole("link", { name: /account settings/i })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: /security/i })).toHaveAttribute("href", "/auth/mfa?next=%2Fadmin");
  });
});
