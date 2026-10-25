import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccountMenu } from "./AccountMenu";

describe("AccountMenu", () => {
  it("shows login and signup links when no authenticated account exists", () => {
    render(<AccountMenu account={null} logoutAction={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/auth/signup",
    );
    expect(screen.queryByText("Sunil Verma")).not.toBeInTheDocument();
  });

  it("opens the authenticated menu and invokes the secure logout action", async () => {
    const user = userEvent.setup();
    const logoutAction = vi.fn(async () => undefined);
    render(
      <AccountMenu
        account={{ displayName: "Dev", initial: "D" }}
        logoutAction={logoutAction}
      />,
    );

    const trigger = screen.getByRole("button", { name: /account menu for dev/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "My Account" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByRole("link", { name: "Management Portal" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    await user.click(screen.getByRole("button", { name: "Log Out" }));
    await waitFor(() => expect(logoutAction).toHaveBeenCalledOnce());
  });

  it("supports keyboard opening and Escape dismissal", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        account={{ displayName: "Dev", initial: "D" }}
        logoutAction={vi.fn()}
      />,
    );

    await user.tab();
    const trigger = screen.getByRole("button", { name: /account menu for dev/i });
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("navigation", { name: "Account options" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("navigation", { name: "Account options" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
