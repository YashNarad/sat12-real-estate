import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminLoading from "./loading";

describe("AdminLoading", () => {
  it("announces protected Admin content loading", () => {
    render(<AdminLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Admin tools");
  });
});
