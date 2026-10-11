import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { formatArea, formatINR } from "@/lib/formatters";
import { MapPreviewCard } from "./MapPreviewCard";

it("shows selected property details and accessible actions", async () => {
  const user = userEvent.setup();
  const property = NAGPUR_PROPERTIES[0];
  const onClose = vi.fn();
  const onViewProperty = vi.fn();
  render(<MapPreviewCard property={property} onClose={onClose} onViewProperty={onViewProperty} />);

  expect(screen.getByText(property.title)).toBeInTheDocument();
  expect(screen.getByText(formatINR(property.price, property.listingIntent))).toBeInTheDocument();
  expect(screen.getByText(new RegExp(property.locality))).toBeInTheDocument();
  expect(screen.getByText(formatArea(property.areaSqFt))).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close property preview" }));
  await user.click(screen.getByRole("button", { name: "View property in list" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onViewProperty).toHaveBeenCalledWith(property.id);
});

it("renders nothing without a selected property", () => {
  const { container } = render(<MapPreviewCard property={null} onClose={() => undefined} onViewProperty={() => undefined} />);
  expect(container).toBeEmptyDOMElement();
});
