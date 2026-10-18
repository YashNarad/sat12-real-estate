import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "./AuthForm";

const action = vi.fn(async () => ({ ok: false, message: "" }));

describe("AuthForm", () => {
  it("renders an accessible login flow with recovery and signup links", () => {
    render(<AuthForm action={action} mode="login" next="/dashboard" />);
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/auth/recover",
    );
    expect(screen.getByDisplayValue("/dashboard")).toHaveAttribute("type", "hidden");
  });

  it("collects only accepted signup profile metadata and never exposes a role field", () => {
    const { container } = render(<AuthForm action={action} mode="signup" />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute("autocomplete", "new-password");
    expect(container.querySelector('[name="role"]')).not.toBeInTheDocument();
  });

  it("renders recovery and password-update modes with clear instructions", () => {
    const { rerender } = render(<AuthForm action={action} mode="recover" />);
    expect(screen.getByRole("heading", { name: /reset your password/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();

    rerender(<AuthForm action={action} mode="reset" />);
    expect(screen.getByLabelText(/new password/i)).toHaveAttribute("autocomplete", "new-password");
  });
});
