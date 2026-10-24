import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { LifecycleAction } from "./LifecycleAction";

describe("LifecycleAction", () => {
  it("requires unsaved editor changes to be saved before submission", () => {
    render(<><form id="draft-editor"><input aria-label="Title" /></form><LifecycleAction action={vi.fn()} label="Submit for review" pendingLabel="Submitting…" trackedFormId="draft-editor" /></>);
    fireEvent.input(screen.getByLabelText("Title"), { target: { value: "Changed" } });
    expect(screen.getByRole("button", { name: "Save changes before submitting" })).toBeDisabled();
    expect(screen.getByText("Save your draft before submitting it for review.")).toBeInTheDocument();
  });
});
