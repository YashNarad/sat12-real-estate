import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { ManagementPortalShell } from "./ManagementPortalShell";

const logoutAction = vi.fn(async () => undefined);

function renderShell(role: "user" | "owner_agent" | "admin") {
  return render(
    <ManagementPortalShell
      account={{ aal: role === "admin" ? "aal2" : "aal1", displayName: "Dev Account", role }}
      logoutAction={logoutAction}
    >
      <p>Portal content</p>
    </ManagementPortalShell>,
  );
}

describe("ManagementPortalShell", () => {
  it("shows only account navigation to an ordinary user", () => {
    renderShell("user");
    expect(screen.getAllByRole("link", { name: "Overview" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Account settings" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "My properties" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "User approvals" })).not.toBeInTheDocument();
  });

  it("shows property tools only to owner agents", () => {
    renderShell("owner_agent");
    expect(screen.getAllByRole("link", { name: "My properties" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Property images" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Buyer enquiries" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Property moderation" })).not.toBeInTheDocument();
  });

  it("shows moderation tools only to administrators without owner capabilities", () => {
    renderShell("admin");
    expect(screen.getAllByRole("link", { name: "Property moderation" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "User approvals" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Buyer enquiries" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "My properties" })).not.toBeInTheDocument();
    expect(screen.getByText(/aal2/i)).toBeInTheDocument();
  });

  it("provides accessible mobile navigation and secure sign out", () => {
    renderShell("user");
    expect(screen.getByText("Menu").closest("summary")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign out" })).not.toHaveLength(0);
    expect(screen.getByText("Portal content")).toBeInTheDocument();
  });
});
