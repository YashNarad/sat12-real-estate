import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261023120000_admin_moderation_security.sql",
);

async function migrationSql() {
  return readFile(migrationPath, "utf8");
}

describe("Task 7 admin moderation security migration", () => {
  it("adds a narrowly scoped AAL2 badge RPC with locking and stable errors", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(
      /create function public\.set_listing_badge\(\s*p_revision_id uuid,\s*p_badge text,\s*p_reason text\s*\)/i,
    );
    expect(sql).toMatch(/security definer\s+set search_path = ''/i);
    expect(sql).toMatch(/if not private\.is_aal2_admin\(\)/i);
    expect(sql).toMatch(/from public\.property_revisions[\s\S]+for update/i);
    expect(sql).toMatch(/SAT12_BADGE_INVALID/i);
    expect(sql).toMatch(/SAT12_BADGE_STATE_INVALID/i);
    expect(sql).toMatch(/SAT12_STALE_REVISION_STATE/i);
  });

  it("keeps badge writes behind the RPC and records immutable audit rows", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/create table public\.listing_badge_audit_log/i);
    expect(sql).toMatch(/alter table public\.listing_badge_audit_log enable row level security/i);
    expect(sql).toMatch(/insert into public\.listing_badge_audit_log/i);
    expect(sql).toMatch(/grant select on public\.listing_badge_audit_log to authenticated/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)[^;]+listing_badge_audit_log/i);
    expect(sql).not.toMatch(/grant\s+update[^;]+property_revisions/i);
  });

  it("restricts execution and preserves the set_user_role signature and audit", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/revoke all on function public\.set_listing_badge\(uuid, text, text\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.set_listing_badge\(uuid, text, text\) to authenticated/i);
    expect(sql).toMatch(/create or replace function public\.set_user_role\(\s*p_target_id uuid,\s*p_role public\.app_role,\s*p_reason text\s*\)/i);
    expect(sql).toMatch(/p_target_id\s*=\s*\(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/SAT12_SELF_ROLE_CHANGE_FORBIDDEN/i);
    expect(sql).toMatch(/insert into public\.role_audit_log/i);
  });
});
