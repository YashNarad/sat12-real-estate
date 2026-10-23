import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/moderation", () => ({
  approveOwnerAgent: vi.fn(),
  initialAdminRoleActionState: { ok: false, message: "" },
}));

import { OwnerAgentApprovalForm } from "./OwnerAgentApprovalForm";

describe("OwnerAgentApprovalForm", () => {
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
});
