import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  buildFixturePlan,
  loadNagpurFixtureDefinitions,
} from "./seed-cloud-fixtures.mjs";
import { validateTargetFromEnvironment } from "./supabase-target.mjs";

const BUCKET = "property-images";

export function buildPropertyImageFixturePlan(runId, ownerId, definitions) {
  const fixturePlan = buildFixturePlan(runId, ownerId, definitions);
  return {
    runId,
    ownerId,
    objects: fixturePlan.images.map(({ storagePath, sourceFile }) => ({
      path: storagePath,
      sourceFile,
    })),
  };
}

export function validatePropertyImageFixtureOperation(mode, env = process.env) {
  const operation =
    mode === "apply"
      ? "storage-fixture-apply"
      : mode === "cleanup"
        ? "storage-fixture-cleanup"
        : null;
  if (!operation) throw new Error("Storage fixture mode must be plan, apply, or cleanup.");
  return validateTargetFromEnvironment(operation, env);
}

export async function applyPropertyImageFixtures(plan, bucket, loadFile) {
  const readSource = loadFile ?? ((sourceFile) => readFile(sourceFile));
  const uploaded = [];
  try {
    for (const object of plan.objects) {
      const contents = await readSource(object.sourceFile);
      const result = await bucket.upload(object.path, contents, {
        contentType: "image/webp",
        upsert: false,
      });
      if (result.error) throw new Error("SAT12_STORAGE_FIXTURE_UPLOAD_FAILED");
      uploaded.push(object.path);
    }
  } catch (error) {
    if (uploaded.length > 0) await bucket.remove(uploaded);
    throw error;
  }
}

export async function cleanupPropertyImageFixtures(plan, bucket) {
  const result = await bucket.remove(plan.objects.map(({ path }) => path));
  if (result.error) throw new Error("SAT12_STORAGE_FIXTURE_CLEANUP_FAILED");
}

function parseArguments(arguments_) {
  const mode = arguments_[0] ?? "plan";
  const runIdIndex = arguments_.indexOf("--run-id");
  const runId = runIdIndex >= 0 ? arguments_[runIdIndex + 1] : undefined;
  if (!["plan", "apply", "cleanup"].includes(mode) || !runId) {
    throw new Error("Usage: seed-property-images.mjs [plan|apply|cleanup] --run-id <run-id>");
  }
  return { mode, runId };
}

export async function runPropertyImageFixtureCommand(arguments_, env = process.env) {
  const { mode, runId } = parseArguments(arguments_);
  const definitions = await loadNagpurFixtureDefinitions();
  const plan = buildPropertyImageFixturePlan(
    runId,
    env.SAT12_FIXTURE_OWNER_PROFILE_ID,
    definitions,
  );
  if (mode === "plan") {
    process.stdout.write(
      `Prepared local property-image plan ${runId}: ${plan.objects.length} objects; no remote operations performed.\n`,
    );
    return;
  }

  validatePropertyImageFixtureOperation(mode, env);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for the operator-only fixture command.");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bucket = client.storage.from(BUCKET);
  if (mode === "apply") await applyPropertyImageFixtures(plan, bucket);
  else await cleanupPropertyImageFixtures(plan, bucket);
  process.stdout.write(`Property-image fixture ${mode} completed for run ${runId}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPropertyImageFixtureCommand(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
