import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TotpChallengeForm, TotpQrCode } from "./MfaForm";

describe("TotpQrCode", () => {
  it("renders the exact Supabase SVG data URI with a native image", () => {
    const qrCode = "data:image/svg+xml;utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";

    render(<TotpQrCode qrCode={qrCode} />);

    expect(screen.getByRole("img", { name: /authenticator qr code/i })).toHaveAttribute(
      "src",
      qrCode,
    );
  });

  it.each([
    undefined,
    "",
    "data:image/png;base64,abc",
    "data:image/svg+xml;base64,abc",
    "data:image/svg+xml;utf-8,%3Csvg%3E%3Cscript%3Ealert(1)%3C/script%3E%3C/svg%3E",
    "https://example.com/qr.svg",
  ])("does not render missing or malformed QR data: %s", (qrCode) => {
    render(<TotpQrCode qrCode={qrCode} />);

    expect(screen.queryByRole("img", { name: /authenticator qr code/i })).not.toBeInTheDocument();
  });
});

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
