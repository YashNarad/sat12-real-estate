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
    "object update is denied",
    "object upsert is denied",
    "object deletion before metadata is denied",
    "owner deletes editable image metadata",
    "owner deletes editable image",
    "submitted image deletion is denied",
    "published image deletion is denied",
    "legally held image deletion is denied",
    "legally held metadata deletion is denied",
    "anonymous reads only current published image",
    "owner reads own revision image",
    "aal1 admin cannot read private image",
    "aal2 admin reads private image",
  ]) {
    expect(source).toMatch(new RegExp(description, "i"));
  }
});
