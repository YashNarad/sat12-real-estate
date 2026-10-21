import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/properties", () => ({
  recordPropertyImage: vi.fn(async () => ({ ok: true, message: "Uploaded" })),
}));

import { PropertyImageManager } from "./PropertyImageManager";

describe("PropertyImageManager", () => {
  it("does not expose upload controls for an immutable revision", () => {
    render(<PropertyImageManager editable={false} propertyId="property" revisionId="revision" />);
    expect(screen.queryByLabelText(/image description/i)).not.toBeInTheDocument();
    expect(screen.getByText(/images are locked/i)).toBeInTheDocument();
  });

  it("offers MIME-restricted image upload for editable revisions", () => {
    render(<PropertyImageManager editable propertyId="property" revisionId="revision" />);
    expect(screen.getByLabelText(/image description/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload image/i })).toBeEnabled();
  });

  it("fails closed when the revision already has twelve images", () => {
    render(<PropertyImageManager editable nextPosition={12} propertyId="property" revisionId="revision" />);
    expect(screen.queryByRole("button", { name: /upload image/i })).not.toBeInTheDocument();
    expect(screen.getByText(/maximum of 12 images/i)).toBeInTheDocument();
  });
});
