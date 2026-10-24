import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  state: { ok: false, code: "VALIDATION", message: "" } as Record<string, unknown>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: vi.fn(() => [harness.state, vi.fn(), false]),
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { PropertyEditor } from "./PropertyEditor";

describe("PropertyEditor", () => {
  beforeEach(() => {
    harness.state = { ok: false, code: "VALIDATION", message: "" };
  });

  it("renders accessible listing fields and a create action", () => {
    render(<PropertyEditor action={vi.fn(async () => ({ ok: true as const, message: "Created" }))} />);
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Listing title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create draft" })).toBeEnabled();
  });

  it("links a newly created revision to its manage page and prevents duplicate creation", () => {
    const revisionId = "10000000-0000-4000-8000-000000000002";
    harness.state = {
      ok: true,
      message: "Draft created.",
      data: { id: revisionId, property_id: "10000000-0000-4000-8000-000000000003" },
    };

    render(
      <PropertyEditor action={vi.fn(async () => ({ ok: true as const, message: "Created" }))} />,
    );

    expect(screen.getByRole("link", { name: "Edit draft and add photos" })).toHaveAttribute(
      "href",
      `/dashboard/properties/${revisionId}`,
    );
    expect(screen.getByRole("button", { name: "Draft created" })).toBeDisabled();
  });
});
