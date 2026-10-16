import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261017120000_fix_recursive_listing_rls.sql",
);

async function migrationSql() {
  return readFile(migrationPath, "utf8");
}

describe("recursive listing RLS corrective migration", () => {
  it("replaces both recursive select policies with authoritative helpers", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/drop policy "public reads active properties" on public\.properties/i);
    expect(sql).toMatch(/using \(private\.can_read_property\(id\)\)/i);
    expect(sql).toMatch(
      /drop policy "public reads current published revisions" on public\.property_revisions/i,
    );
    expect(sql).toMatch(/using \(private\.can_read_property_revision\(id\)\)/i);
  });

  it("uses hardened security-definer helpers and fully qualified relations", async () => {
    const sql = await migrationSql();

    for (const [declaration, invocation] of [
      ["private.can_read_property(p_property_id uuid)", "private.can_read_property(uuid)"],
      [
        "private.can_read_property_revision(p_revision_id uuid)",
        "private.can_read_property_revision(uuid)",
      ],
    ]) {
      const escapedDeclaration = declaration
        .replace(/[().]/g, "\\$&")
        .replace(/ /g, "\\s+");
      const escapedInvocation = invocation.replace(/[().]/g, "\\$&");
      expect(sql).toMatch(
        new RegExp(
          `create function ${escapedDeclaration}[\\s\\S]*?stable[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
          "i",
        ),
      );
      expect(sql).toMatch(
        new RegExp(`revoke all on function ${escapedInvocation} from public`, "i"),
      );
      expect(sql).toMatch(
        new RegExp(`grant execute on function ${escapedInvocation} to anon, authenticated`, "i"),
      );
    }

    expect(sql).toMatch(/from public\.properties p/i);
    expect(sql).toMatch(/join public\.property_revisions r/i);
    expect(sql).not.toMatch(/\bfrom\s+properties\b/i);
    expect(sql).not.toMatch(/\bfrom\s+property_revisions\b/i);
  });

  it("does not weaken RLS or expose helper execution broadly", async () => {
    const sql = await migrationSql();

    expect(sql).not.toMatch(/disable row level security/i);
    expect(sql).not.toMatch(/grant execute[^;]+to public/i);
    expect(sql).not.toMatch(/grant (?:all|select|insert|update|delete) on (?:table )?public\./i);
  });
});
