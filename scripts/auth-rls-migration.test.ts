import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261015220000_stage3_auth_and_rls.sql",
);

async function migrationSql() {
  return readFile(migrationPath, "utf8");
}

describe("Stage 3 authentication and RLS migration", () => {
  it("creates profiles with a fixed user role and never trusts user role metadata", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/new\.raw_user_meta_data\s*->>\s*'full_name'/i);
    expect(sql).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/i);
    expect(sql).toMatch(/values\s*\(\s*new\.id,\s*'user'/i);
  });

  it("requires both the admin database role and AAL2", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/function private\.is_aal2_admin/i);
    expect(sql).toMatch(/role\s*=\s*'admin'/i);
    expect(sql).toMatch(/auth\.jwt\(\)\s*->>\s*'aal'\s*=\s*'aal2'/i);
  });

  it("defines every planned lifecycle and role function", async () => {
    const sql = await migrationSql();
    for (const name of [
      "create_draft_listing",
      "create_listing_revision",
      "submit_listing",
      "approve_listing",
      "reject_listing",
      "publish_listing",
      "archive_listing",
      "set_user_role",
      "bootstrap_first_admin",
    ]) {
      expect(sql).toMatch(new RegExp(`function (?:public|private)\\.${name}\\b`, "i"));
    }
  });

  it("keeps direct role, status, badge, and publication pointer writes ungranted", async () => {
    const sql = await migrationSql();

    expect(sql).not.toMatch(/grant\s+update\s*\(\s*role\s*\)/i);
    expect(sql).not.toMatch(/grant\s+update\s*\([^)]*\bstatus\b[^)]*\)/i);
    expect(sql).not.toMatch(/grant\s+update\s*\([^)]*\bbadge\b[^)]*\)/i);
    expect(sql).not.toMatch(/grant\s+update\s*\([^)]*published_revision_id[^)]*\)/i);
  });

  it("grants bootstrap only to service_role and protects audit tables", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/grant execute on function public\.bootstrap_first_admin[^;]+to service_role/i);
    expect(sql).not.toMatch(/grant execute on function public\.bootstrap_first_admin[^;]+to authenticated/i);
    expect(sql).toMatch(/create policy "aal2 admins read role audit"/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)[^;]+role_audit_log/i);
  });

  it("does not create image metadata for Storage objects that do not exist", async () => {
    const sql = await migrationSql();

    expect(sql).not.toMatch(
      /gen_random_uuid\(\)::text\s*\|\|\s*'\.'\s*\|\|\s*split_part\(mime_type/i,
    );
  });

  it("fails closed when security-sensitive reasons are null", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/p_notes is null\s+or char_length\(trim\(p_notes\)\) < 3/i);
    expect(sql).toMatch(/p_reason is null\s+or char_length\(trim\(p_reason\)\) < 3/i);
  });
});
