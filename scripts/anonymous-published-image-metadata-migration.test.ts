import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261025200000_fix_anonymous_published_image_metadata.sql",
);

async function migrationSql() {
  return readFile(migrationPath, "utf8");
}

describe("anonymous published-image metadata policy correction", () => {
  it("replaces the combined policy with separate public, owner, and AAL2 admin policies", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/drop policy "users read permitted image metadata" on public\.property_images/iu);
    expect(sql).toMatch(/create policy "public reads published image metadata"[\s\S]*?to anon, authenticated/iu);
    expect(sql).toMatch(/create policy "owners read own image metadata"[\s\S]*?to authenticated/iu);
    expect(sql).toMatch(/create policy "aal2 admins read image metadata"[\s\S]*?to authenticated/iu);
    expect(sql.match(/create policy/giu)).toHaveLength(3);
  });

  it("defines public visibility only through the active stable published pointer", async () => {
    const sql = await migrationSql();
    const publicPolicy = sql.match(
      /create policy "public reads published image metadata"[\s\S]*?;\s*(?=create policy)/iu,
    )?.[0] ?? "";

    expect(publicPolicy).toMatch(/p\.archived_at is null/iu);
    expect(publicPolicy).toMatch(/p\.published_revision_id = r\.id/iu);
    expect(publicPolicy).toMatch(/r\.id = property_images\.revision_id/iu);
    expect(publicPolicy).toMatch(/r\.status = 'published'/iu);
    expect(publicPolicy).not.toMatch(/private\./iu);
    expect(publicPolicy).not.toMatch(/auth\.uid/iu);
  });

  it("preserves owner and AAL2 admin access without exposing the private schema", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/p\.owner_id = \(select auth\.uid\(\)\)/iu);
    expect(sql).toMatch(/using \(private\.is_aal2_admin\(\)\)/iu);
    expect(sql).not.toMatch(/grant usage on schema private/iu);
    expect(sql).not.toMatch(/grant execute/iu);
    expect(sql).not.toMatch(/create\s+(?:or\s+replace\s+)?function/iu);
  });

  it("does not alter Storage policies, table grants, or RLS enforcement", async () => {
    const sql = await migrationSql();

    expect(sql).not.toMatch(/storage\.objects/iu);
    expect(sql).not.toMatch(/disable row level security/iu);
    expect(sql).not.toMatch(/\bgrant\b/iu);
    expect(sql).not.toMatch(/\brevoke\b/iu);
    expect(sql).not.toMatch(/\b(?:insert|update|delete|truncate)\b/iu);
  });
});
