import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ state: { ok: false, code: "VALIDATION", message: "", fieldErrors: undefined } as { ok: boolean; code: string; message: string; fieldErrors?: Record<string, string[]> }, pending: false }));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), useActionState: vi.fn(() => [harness.state, vi.fn(), harness.pending]) }));
vi.mock("@/app/actions/enquiries", () => ({ createEnquiryAction: vi.fn() }));

import { EnquiryForm } from "./EnquiryForm";

describe("EnquiryForm", () => {
  beforeEach(() => { harness.state = { ok: false, code: "VALIDATION", message: "", fieldErrors: undefined }; harness.pending = false; });

  it("identifies the property and collects only minimal buyer details", () => {
    render(<EnquiryForm propertyId="11111111-1111-4111-8111-111111111111" propertyTitle="Nagpur home" submissionEnabled />);
    expect(screen.getByRole("heading", { name: "Enquire now" })).toBeInTheDocument();
    expect(screen.getByText(/Nagpur home/)).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeRequired();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Phone number (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeRequired();
    expect(document.querySelector('input[name="recipientId"]')).toBeNull();
  });

  it("shows accessible field errors and disables repeat submission after success", () => {
    harness.state = { ok: false, code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: { email: ["Enter a valid email address."] } };
    render(<EnquiryForm propertyId="11111111-1111-4111-8111-111111111111" propertyTitle="Nagpur home" submissionEnabled />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email address.");
  });

  it("disables repeat submission after success", () => {
    harness.state = { ok: true, code: "SUCCESS", message: "Your enquiry was sent securely." };
    render(<EnquiryForm propertyId="11111111-1111-4111-8111-111111111111" propertyTitle="Nagpur home" submissionEnabled />);
    expect(screen.getByRole("status")).toHaveTextContent("Your enquiry was sent securely.");
    expect(screen.getByRole("button", { name: "Enquiry sent" })).toBeDisabled();
  });

  it("honestly disables submission before the backend and abuse controls are enabled", () => {
    render(<EnquiryForm propertyId="11111111-1111-4111-8111-111111111111" propertyTitle="Nagpur home" submissionEnabled={false} />);
    expect(screen.getByRole("button", { name: "Enquiries unavailable" })).toBeDisabled();
    expect(screen.getByText(/no information will be stored/i)).toBeInTheDocument();
  });
});
