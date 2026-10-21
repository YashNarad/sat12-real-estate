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
    "owner records metadata with matching pre-generated image id",
    "cross-owner image metadata insert is denied",
    "submitted revision image metadata insert is denied",
    "published revision image metadata insert is denied",
    "path and row image ids must match",
    "owner cannot change property ownership",
    "owner cannot change revision status through metadata privileges",
    "metadata-backed cross-owner fixture exists",
    "metadata-backed owner read remains independent of orphan policy",
    "metadata-backed cross-owner image remains private",
    "owner removes editable metadata to create an orphan",
    "owner selects a deletable orphan image",
    "cross-owner orphan image remains private",
    "submitted orphan image remains private",
    "published orphan image remains private",
    "legally held orphan image remains private",
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
  expect(source).toMatch(/extensions\.plan\(28\)/u);
  expect(assertions).toHaveLength(28);
});

it("does not invoke private helpers directly from application-role assertions", async () => {
  const source = await readFile(
    path.resolve("supabase/tests/storage_rls.test.sql"),
    "utf8",
  );

  expect(source).not.toMatch(/\bprivate\.[a-z_][a-z0-9_]*\s*\(/iu);
});

it("clears authenticated JWT claims before exercising anonymous image access", async () => {
  const source = await readFile(
    path.resolve("supabase/tests/storage_rls.test.sql"),
    "utf8",
  );

  expect(source).toMatch(
    /reset role;\s*select set_config\(\s*'request\.jwt\.claims',\s*'\{"role":"anon"\}',\s*true\s*\);\s*set local role anon;\s*select extensions\.results_eq\([\s\S]*?'anonymous reads only current published image'/iu,
  );
});

it("tests the exact anonymous image across every non-public lifecycle state", async () => {
  const source = await readFile(
    path.resolve("supabase/tests/storage_rls.test.sql"),
    "utf8",
  );

  expect(source).toMatch(/'Owner A Rejected'[\s\S]*?'rejected'/iu);
  expect(source).toMatch(/'Owner A Superseded'[\s\S]*?'superseded'/iu);
  expect(source).toMatch(/storage-owner-a-archived[\s\S]*?archived_at/iu);
  expect(source).toMatch(
    /select extensions\.results_eq\([\s\S]*?select id from storage\.objects[\s\S]*?values \('44000000-0000-4000-8000-000000000003'::uuid\)[\s\S]*?'anonymous reads only current published image'/iu,
  );
});
