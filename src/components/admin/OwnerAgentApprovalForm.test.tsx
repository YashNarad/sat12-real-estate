import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ state: { ok: false, message: "" } }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: vi.fn(() => [harness.state, vi.fn(), false]),
  };
});

vi.mock("@/app/actions/moderation", () => ({
  approveOwnerAgent: vi.fn(),
  initialAdminRoleActionState: { ok: false, message: "" },
}));

import { OwnerAgentApprovalForm } from "./OwnerAgentApprovalForm";

describe("OwnerAgentApprovalForm", () => {
  beforeEach(() => {
    harness.state = { ok: false, message: "" };
  });

  it("identifies the exact target and requires an audit reason", () => {
    render(
      <OwnerAgentApprovalForm
        profile={{ id: "10000000-0000-4000-8000-000000000002", fullName: "Second Account" }}
      />,
    );

    expect(screen.getByText("Second Account")).toBeInTheDocument();
    expect(screen.getByText("10000000-0000-4000-8000-000000000002")).toBeInTheDocument();
    expect(screen.getByLabelText("Audit reason")).toBeRequired();
    expect(screen.getByRole("button", { name: "Approve owner/agent" })).toBeInTheDocument();
    expect(document.querySelector('input[name="targetProfileId"]')).toHaveValue(
      "10000000-0000-4000-8000-000000000002",
    );
  });

  it("prevents a successful approval from being submitted again", () => {
    harness.state = { ok: true, message: "Owner/agent access approved." };
    render(
      <OwnerAgentApprovalForm
        profile={{ id: "10000000-0000-4000-8000-000000000002", fullName: "Second Account" }}
      />,
    );

    expect(screen.getByRole("button", { name: "Approved" })).toBeDisabled();
    expect(screen.getByText("Owner/agent access approved.")).toBeInTheDocument();
  });
});
