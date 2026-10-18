import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TotpChallengeForm } from "./MfaForm";

describe("TotpChallengeForm", () => {
  it("collects only a six-digit TOTP code and trusted hidden navigation data", () => {
    const action = vi.fn();
    const { container } = render(
      <TotpChallengeForm action={action} factorId="factor-1" next="/account" />,
    );

    expect(screen.getByLabelText(/six-digit code/i)).toHaveAttribute("pattern", "[0-9]{6}");
    expect(screen.getByLabelText(/six-digit code/i)).toHaveAttribute(
      "autocomplete",
      "one-time-code",
    );
    expect(screen.getByDisplayValue("factor-1")).toHaveAttribute("type", "hidden");
    expect(screen.getByDisplayValue("/account")).toHaveAttribute("type", "hidden");
    expect(container.querySelector('[name="role"]')).not.toBeInTheDocument();
  });
});
