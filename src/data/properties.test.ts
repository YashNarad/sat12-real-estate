import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAGPUR_PROPERTIES } from "./properties";

describe("Nagpur property imagery", () => {
  it("uses nine unique project-owned illustrative WebP assets", () => {
    const images = NAGPUR_PROPERTIES.map(({ image }) => image);

    expect(images).toHaveLength(9);
    expect(new Set(images.map(({ src }) => src))).toHaveLength(9);

    for (const image of images) {
      expect(image.src).toMatch(/^\/images\/properties\/property-\d{2}\.webp$/);
      expect(image.alt).toMatch(/^Illustrative /);
      expect(image.license).toBe("SAT12 generated illustrative image");
      expect(existsSync(join(process.cwd(), "public", image.src))).toBe(true);
    }
  });
});
