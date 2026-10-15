import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildVerifiedTlsConfig } from "./cloud-db-test-runner.mjs";
import {
  validateDatabaseUrl,
  validateTargetFromEnvironment,
} from "./supabase-target.mjs";

const FIXTURE_FILE = path.resolve("supabase/fixtures/nagpur-properties.json");
const SUPABASE_ROOT_CA_PATH = path.resolve("certificates/supabase-root-2021-ca.crt");
const RUN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function deterministicUuid(value) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertRunId(runId) {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error("Fixture run ID must be a lowercase, hyphenated identifier of at most 48 characters.");
  }
}

function assertOwnerId(ownerId) {
  if (!UUID_PATTERN.test(ownerId)) {
    throw new Error("SAT12_FIXTURE_OWNER_PROFILE_ID must be an existing profile UUID.");
  }
}

export async function loadNagpurFixtureDefinitions() {
  const definitions = JSON.parse(await readFile(FIXTURE_FILE, "utf8"));
  if (!Array.isArray(definitions) || definitions.length !== 9) {
    throw new Error("The Nagpur fixture manifest must contain exactly nine properties.");
  }
  if (new Set(definitions.map(({ key }) => key)).size !== definitions.length) {
    throw new Error("Nagpur fixture keys must be unique.");
  }
  return definitions;
}

export function buildFixtureAccountRequirements() {
  return {
    createsAuthUsers: false,
    accounts: [
      { alias: "owner", role: "owner_agent", profileIdEnvironmentVariable: "SAT12_FIXTURE_OWNER_PROFILE_ID" },
      { alias: "user", role: "user", profileIdEnvironmentVariable: "SAT12_FIXTURE_USER_PROFILE_ID" },
      { alias: "admin", role: "admin", profileIdEnvironmentVariable: "SAT12_FIXTURE_ADMIN_PROFILE_ID" },
    ],
  };
}

export function buildFixturePlan(runId, ownerId, definitions) {
  assertRunId(runId);
  assertOwnerId(ownerId);
  if (!Array.isArray(definitions) || definitions.length !== 9) {
    throw new Error("A fixture plan requires exactly nine property definitions.");
  }

  const properties = definitions.map((definition) => {
    const id = deterministicUuid(`${runId}:property:${definition.key}`);
    const revisionId = deterministicUuid(`${runId}:revision:${definition.key}`);
    return {
      id,
      ownerId,
      slug: `fixture-${runId}-${definition.key}`,
      publishedRevisionId: revisionId,
    };
  });
  const revisions = definitions.map((definition, index) => ({
    id: properties[index].publishedRevisionId,
    propertyId: properties[index].id,
    ownerId,
    ...definition,
  }));
  const images = definitions.map((definition, index) => {
    const id = deterministicUuid(`${runId}:image:${definition.key}`);
    return {
      id,
      revisionId: revisions[index].id,
      ownerId,
      storagePath: `fixtures/${runId}/${ownerId}/${properties[index].id}/${id}.webp`,
      altText: definition.imageAlt,
      sourceFile: path.resolve("public/images/properties", definition.image),
    };
  });
  return { runId, ownerId, properties, revisions, images };
}

export function assertCleanupOwnership(plan, candidate) {
  if (candidate.ownerId !== plan.ownerId) {
    throw new Error("Cleanup candidate is outside the fixture owner boundary.");
  }
  const expected = plan.properties.find(({ id }) => id === candidate.id);
  if (!expected) throw new Error("Cleanup candidate is not in the fixture plan.");
  if (candidate.slug !== expected.slug || !candidate.slug.startsWith(`fixture-${plan.runId}-`)) {
    throw new Error("Cleanup candidate is outside the exact run boundary.");
  }
}

export function validateFixtureOperation(mode, env = process.env) {
  const operation = mode === "apply" ? "fixture-apply" : mode === "cleanup" ? "fixture-cleanup" : null;
  if (!operation) throw new Error("Fixture mode must be plan, apply, or cleanup.");
  return validateTargetFromEnvironment(operation, env);
}

export function buildFixtureStatements() {
  return {
    selectOwner: "select id, role from public.profiles where id = $1",
    selectProperties: "select id, owner_id as \"ownerId\", slug from public.properties where id = any($1::uuid[])",
    insertProperty: "insert into public.properties (id, owner_id, slug) values ($1, $2, $3) on conflict (id) do nothing",
    insertRevision: `insert into public.property_revisions (id, property_id, revision_number, title, description, listing_intent, property_type, price_inr, locality, city, state, latitude, longitude, bedrooms, bathrooms, area_sq_ft, construction_status, rera_approved, badge, status, approved_at, published_at, created_by) values ($1,$2,1,$3,$4,$5,$6,$7,$8,'Nagpur','Maharashtra',$9,$10,$11,$12,$13,$14,$15,$16,'published',now(),now(),$17) on conflict (id) do nothing`,
    insertImage: "insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values ($1,$2,$3,$4,0,1536,1024,$5,'image/webp','sat12_illustrative',$6) on conflict (id) do nothing",
    publishProperty: "update public.properties set published_revision_id = $1 where id = $2 and owner_id = $3 and slug = $4 and (published_revision_id is null or published_revision_id = $1)",
    clearPublication: "update public.properties set published_revision_id = null where id = any($1::uuid[]) and owner_id = $2 and slug = any($3::text[])",
    deleteProperties: "delete from public.properties where id = any($1::uuid[]) and owner_id = $2 and slug = any($3::text[])",
  };
}

async function openApprovedClient(mode, env) {
  const { projectRef } = validateFixtureOperation(mode, env);
  validateDatabaseUrl(env.SUPABASE_DB_URL, projectRef);
  const certificate = await readFile(env.SUPABASE_SSL_ROOT_CERT || SUPABASE_ROOT_CA_PATH, "utf8");
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: buildVerifiedTlsConfig(certificate),
  });
  await client.connect();
  return client;
}

async function applyFixturePlan(plan, env) {
  const statements = buildFixtureStatements();
  const client = await openApprovedClient("apply", env);
  try {
    await client.query("begin");
    const owner = await client.query(statements.selectOwner, [plan.ownerId]);
    if (owner.rowCount !== 1 || owner.rows[0].role !== "owner_agent") {
      throw new Error("Fixture owner must be an existing owner_agent profile.");
    }
    const existing = await client.query(statements.selectProperties, [plan.properties.map(({ id }) => id)]);
    existing.rows.forEach((row) => assertCleanupOwnership(plan, row));
    for (let index = 0; index < plan.properties.length; index += 1) {
      const property = plan.properties[index];
      const revision = plan.revisions[index];
      const image = plan.images[index];
      const imageStat = await import("node:fs/promises").then(({ stat }) => stat(image.sourceFile));
      await client.query(statements.insertProperty, [property.id, property.ownerId, property.slug]);
      await client.query(statements.insertRevision, [revision.id, revision.propertyId, revision.title, "Illustrative SAT12 mock property; not a verified listing.", revision.listingIntent, revision.propertyType, revision.priceInr, revision.locality, revision.latitude, revision.longitude, revision.bedrooms, revision.bathrooms, revision.areaSqFt, revision.constructionStatus, revision.reraApproved, revision.badge ?? null, revision.ownerId]);
      await client.query(statements.insertImage, [image.id, image.revisionId, image.storagePath, image.altText, imageStat.size, image.ownerId]);
      await client.query(statements.publishProperty, [property.publishedRevisionId, property.id, property.ownerId, property.slug]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function cleanupFixturePlan(plan, env) {
  const statements = buildFixtureStatements();
  const client = await openApprovedClient("cleanup", env);
  try {
    await client.query("begin");
    const ids = plan.properties.map(({ id }) => id);
    const slugs = plan.properties.map(({ slug }) => slug);
    const existing = await client.query(statements.selectProperties, [ids]);
    existing.rows.forEach((row) => assertCleanupOwnership(plan, row));
    await client.query(statements.clearPublication, [ids, plan.ownerId, slugs]);
    await client.query(statements.deleteProperties, [ids, plan.ownerId, slugs]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

function parseArguments(arguments_) {
  const mode = arguments_[0] ?? "plan";
  const runIdIndex = arguments_.indexOf("--run-id");
  const runId = runIdIndex >= 0 ? arguments_[runIdIndex + 1] : undefined;
  if (!['plan', 'apply', 'cleanup'].includes(mode) || !runId) {
    throw new Error("Usage: seed-cloud-fixtures.mjs [plan|apply|cleanup] --run-id <run-id>");
  }
  return { mode, runId };
}

export async function runFixtureCommand(arguments_, env = process.env) {
  const { mode, runId } = parseArguments(arguments_);
  const definitions = await loadNagpurFixtureDefinitions();
  const ownerId = env.SAT12_FIXTURE_OWNER_PROFILE_ID;
  const plan = buildFixturePlan(runId, ownerId, definitions);
  if (mode === "plan") {
    process.stdout.write(`Prepared local fixture plan ${runId}: ${plan.properties.length} illustrative properties; no remote operations performed.\n`);
    return;
  }
  if (mode === "apply") await applyFixturePlan(plan, env);
  else await cleanupFixturePlan(plan, env);
  process.stdout.write(`Fixture ${mode} completed for run ${runId}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFixtureCommand(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
