import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261017180000_stage3_storage.sql",
);

async function migrationSql() {
  return readFile(migrationPath, "utf8");
}

describe("Stage 3 private property-image Storage migration", () => {
  it("creates one private, size-limited image bucket", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/insert into storage\.buckets/i);
    expect(sql).toMatch(/'property-images'/i);
    expect(sql).toMatch(/\bfalse\b/i);
    expect(sql).toMatch(/5242880/i);
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(sql).toContain(`'${mime}'`);
    }
  });

  it("uses hardened path and object authorization helpers", async () => {
    const sql = await migrationSql();

    for (const name of [
      "can_insert_property_image_object",
      "can_read_property_image_object",
      "can_delete_property_image_metadata",
      "can_delete_property_image_object",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `create function private\\.${name}\\([^)]*\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
          "i",
        ),
      );
      expect(sql).toMatch(new RegExp(`revoke all on function private\\.${name}`, "i"));
    }
  });

  it("allows only insert, select, and guarded delete object operations", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/on storage\.objects for insert to authenticated/i);
    expect(sql).toMatch(/on storage\.objects for select to anon, authenticated/i);
    expect(sql).toMatch(/on storage\.objects for delete to authenticated/i);
    expect(sql).not.toMatch(/on storage\.objects for update/i);
    expect(sql).not.toMatch(/bucket_id\s*=\s*'property-images'\s*\)\s*;\s*$/im);
  });

  it("makes image metadata object-backed and immutable", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/create trigger validate_property_image_object/i);
    expect(sql).toMatch(/from storage\.objects o/i);
    expect(sql).toMatch(/SAT12_IMAGE_OBJECT_MISSING/i);
    expect(sql).toMatch(
      /revoke update \(storage_path, alt_text, position, width, height, size_bytes, mime_type\)\s+on public\.property_images from authenticated/i,
    );
    expect(sql).toMatch(/grant update \(alt_text, position\)/i);
  });

  it("protects deletions with editable-state and legal-hold checks", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/status in \('draft', 'rejected'\)/i);
    expect(sql).toMatch(/from public\.legal_holds/i);
    expect(sql).toMatch(/entity_kind in \('property', 'revision', 'image'\)/i);
    expect(sql).toMatch(
      /can_delete_property_image_object[\s\S]*?not exists \([\s\S]*?from public\.property_images/i,
    );
    expect(sql).toMatch(
      /owners delete editable image metadata[\s\S]*?can_delete_property_image_metadata\(storage_path\)/i,
    );
  });

  it("never creates a public bucket or blanket object access", async () => {
    const sql = await migrationSql();

    expect(sql).not.toMatch(/public\s*=\s*true/i);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/grant\s+all[^;]+storage\.objects/i);
  });
});
