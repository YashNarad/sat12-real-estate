import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PropertyImageGallery } from "./PropertyImageGallery";

const images = [
  { src: "/first.webp", alt: "Front view", kind: "listing" as const },
  { src: "/second.webp", alt: "Living room", kind: "listing" as const },
];

describe("PropertyImageGallery", () => {
  it("keeps a single image free of redundant carousel controls", () => {
    render(<PropertyImageGallery eager images={images.slice(0, 1)} propertyTitle="Home" sizes="100vw" />);
    expect(screen.getByRole("img", { name: "Front view" })).toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next image/i })).not.toBeInTheDocument();
  });

  it("preserves image order and supports accessible next and previous navigation", async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={images} propertyTitle="Home" sizes="100vw" />);
    expect(screen.getByRole("img", { name: "Front view" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next image for Home" }));
    expect(screen.getByRole("img", { name: "Living room" })).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous image for Home" }));
    expect(screen.getByRole("img", { name: "Front view" })).toBeInTheDocument();
  });

  it("falls back safely when an image URL expires or fails", async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery fallbackSrc="/fallback.svg" images={images} propertyTitle="Home" sizes="100vw" />);
    const image = screen.getByRole("img", { name: "Front view" });
    image.dispatchEvent(new Event("error"));
    expect(await screen.findByRole("img", { name: "Image unavailable for Home" })).toHaveAttribute("src", expect.stringContaining("fallback.svg"));
    await user.click(screen.getByRole("button", { name: "Next image for Home" }));
    expect(screen.getByRole("img", { name: "Living room" })).toBeInTheDocument();
  });

  it("supports arrow-key navigation in the full gallery", async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={images} propertyTitle="Home" sizes="100vw" />);
    const gallery = screen.getByRole("group", { name: "Property images for Home" });
    gallery.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: "Living room" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("img", { name: "Front view" })).toBeInTheDocument();
  });
});
