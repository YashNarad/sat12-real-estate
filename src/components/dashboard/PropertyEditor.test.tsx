import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PropertyEditor } from "./PropertyEditor";

describe("PropertyEditor", () => {
  it("renders accessible listing fields and a create action", () => {
    render(<PropertyEditor action={vi.fn(async () => ({ ok: true as const, message: "Created" }))} />);
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Listing title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create draft" })).toBeEnabled();
  });
});
