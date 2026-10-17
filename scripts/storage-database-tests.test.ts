import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vitest";

it("covers the approved private Storage threat model", async () => {
  const source = await readFile(
    path.resolve("supabase/tests/storage_rls.test.sql"),
    "utf8",
  );

  for (const description of [
    "owner uploads to exact revision prefix",
    "cross-owner upload is denied",
    "cross-revision upload is denied",
    "path traversal is denied",
    "unsupported bucket is denied",
    "owner deletes editable image metadata",
    "legally held metadata deletion is denied",
    "anonymous reads only current published image",
    "owner reads own revision image",
    "aal1 admin cannot read private image",
    "aal2 admin reads private image",
  ]) {
    expect(source).toMatch(new RegExp(description, "i"));
  }
});

it("keeps unsupported Storage object mutations out of transactional pgTAP", async () => {
  const source = await readFile(
    path.resolve("supabase/tests/storage_rls.test.sql"),
    "utf8",
  );

  expect(source).not.toMatch(/\(\s*with\s+(?:updated|deleted)\s+as\s*\(/iu);
  expect(source).not.toMatch(/\bupdate\s+storage\.objects\b/iu);
  expect(source).not.toMatch(/\bdelete\s+from\s+storage\.objects\b/iu);
  expect(source).not.toMatch(/on\s+conflict[\s\S]*do\s+update/iu);

  const assertions = source.match(
    /select\s+extensions\.(?:is|ok|lives_ok|throws_ok|results_eq)\s*\(/giu,
  );
  expect(source).toMatch(/extensions\.plan\(12\)/u);
  expect(assertions).toHaveLength(12);
});
