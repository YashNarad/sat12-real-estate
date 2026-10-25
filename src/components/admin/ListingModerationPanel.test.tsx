import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ state: { ok: false, message: "" } }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(() => [harness.state, vi.fn(), false]) };
});
vi.mock("@/app/actions/moderation", () => ({ moderateListing: vi.fn() }));

import { ListingModerationPanel } from "./ListingModerationPanel";

describe("ListingModerationPanel", () => {
  beforeEach(() => { harness.state = { ok: false, message: "" }; });

  it("offers approve and reasoned rejection only for submitted revisions", () => {
    render(<ListingModerationPanel propertyId="20000000-0000-4000-8000-000000000001" revisionId="10000000-0000-4000-8000-000000000001" status="submitted" />);
    expect(screen.getByRole("button", { name: "Approve listing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject listing" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rejection reason")).toBeRequired();
    expect(screen.queryByRole("button", { name: "Publish listing" })).not.toBeInTheDocument();
  });

  it("offers publication and audited badge controls for approved revisions", () => {
    render(<ListingModerationPanel propertyId="20000000-0000-4000-8000-000000000001" revisionId="10000000-0000-4000-8000-000000000001" status="approved" />);
    expect(screen.getByRole("button", { name: "Publish listing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update badge" })).toBeInTheDocument();
    expect(screen.getByLabelText("Badge audit reason")).toBeRequired();
  });
});
