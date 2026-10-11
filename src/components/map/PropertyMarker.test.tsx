import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { PropertyMarker } from "./PropertyMarker";

const { markerRender } = vi.hoisted(() => ({
  markerRender: vi.fn(({ title, eventHandlers }: { title: string; eventHandlers: { click: () => void } }) => <button onClick={eventHandlers.click}>{title}</button>),
}));

vi.mock("react-leaflet", () => ({ Marker: markerRender }));
vi.mock("./mapIcons", () => ({ createPropertyIcon: () => ({}) }));

it("labels a marker with property and locality and selects it from the keyboard", async () => {
  const user = userEvent.setup();
  const property = NAGPUR_PROPERTIES[0];
  const onSelect = vi.fn();
  render(<PropertyMarker property={property} selected={false} onSelect={onSelect} />);
  const marker = screen.getByRole("button", { name: `${property.title}, ${property.locality}, Nagpur` });
  marker.focus();
  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledWith(property.id);
});

it("does not rebuild a stable marker during unrelated parent renders", () => {
  markerRender.mockClear();
  const property = NAGPUR_PROPERTIES[0];
  const onSelect = vi.fn();
  const { rerender } = render(<PropertyMarker property={property} selected={false} onSelect={onSelect} />);
  rerender(<PropertyMarker property={property} selected={false} onSelect={onSelect} />);
  expect(markerRender).toHaveBeenCalledOnce();
});
