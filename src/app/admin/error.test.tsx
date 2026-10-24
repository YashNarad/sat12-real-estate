import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminError from "./error";

describe("AdminError", () => {
  it("describes an Admin failure without mislabeling it as a property-listing failure", () => {
    const reset = vi.fn();
    render(<AdminError error={new Error("private detail")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Admin tools are temporarily unavailable" })).toBeInTheDocument();
    expect(screen.queryByText(/properties are temporarily unavailable/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
