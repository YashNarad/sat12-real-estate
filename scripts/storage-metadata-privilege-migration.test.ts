import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261020160000_grant_property_image_id_insert.sql",
);

describe("property image metadata id privilege correction", () => {
  it("grants authenticated callers only the missing property_images id insert privilege", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements).toEqual([
      "grant insert (id) on public.property_images to authenticated",
    ]);
    expect(sql).not.toMatch(/grant\s+(?:all|update|delete|select)/iu);
    expect(sql).not.toMatch(/\b(?:alter|drop|create|revoke)\b/iu);
  });

  it("leaves the previously applied column grant unchanged", async () => {
    const applied = await readFile(
      path.resolve("supabase/migrations/20261015220000_stage3_auth_and_rls.sql"),
      "utf8",
    );
    const originalInsertColumns = applied.match(
      /grant insert \(([^)]*)\),\s*update[\s\S]*?on public\.property_images to authenticated/iu,
    )?.[1];

    expect(originalInsertColumns).toBeDefined();
    expect(originalInsertColumns?.split(",").map((column) => column.trim())).not.toContain("id");
  });
});
