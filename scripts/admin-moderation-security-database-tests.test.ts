import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function testSql() {
  return readFile(
    path.resolve("supabase/tests/admin_moderation_security.test.sql"),
    "utf8",
  );
}

describe("Task 7 transactional database coverage", () => {
  it("covers badge authorization, lifecycle, audit, and direct-write denial", async () => {
    const sql = await testSql();

    for (const assertion of [
      "anonymous cannot set a badge",
      "non-admin cannot set a badge",
      "aal1 admin cannot set a badge",
      "missing revision is rejected",
      "invalid badge is rejected",
      "draft revision badge is rejected",
      "stale published revision badge is rejected",
      "aal2 admin sets an approved revision badge",
      "badge change is recorded",
      "badge audit rows are immutable",
      "authenticated users have no direct badge update privilege",
    ]) {
      expect(sql).toMatch(new RegExp(assertion, "i"));
    }
  });

  it("covers direct self-role denial and preserves authorized audited role changes", async () => {
    const sql = await testSql();

    for (const assertion of [
      "admin cannot change own role",
      "self-role denial uses the stable error",
      "non-admin cannot change roles",
      "aal1 admin cannot change roles",
      "aal2 admin changes another user role",
      "authorized role change is audited",
    ]) {
      expect(sql).toMatch(new RegExp(assertion, "i"));
    }
  });
});
