import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261020200000_allow_orphan_image_delete_select.sql",
);

describe("editable orphan image SELECT policy correction", () => {
  it("adds one authenticated policy using the existing delete authorization helper", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(
      /create policy "owners read deletable orphan property images"\s+on storage\.objects\s+for select\s+to authenticated\s+using\s*\(\s*bucket_id = 'property-images'\s+and private\.can_delete_property_image_object\(name\)\s*\)\s*;/iu,
    );
    expect(sql.match(/create policy/giu)).toHaveLength(1);
    expect(sql).not.toMatch(/\b(?:anon|public)\b/iu);
    expect(sql).not.toMatch(/\b(?:grant|alter|drop|delete|update|insert)\b/iu);
  });

  it("does not redefine or weaken the existing authorization helper", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).not.toMatch(/create\s+(?:or\s+replace\s+)?function/iu);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/iu);
  });
});
