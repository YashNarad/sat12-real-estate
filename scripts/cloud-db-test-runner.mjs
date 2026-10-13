import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  validateDatabaseUrl,
  validateTargetFromEnvironment,
} from "./supabase-target.mjs";

function visit(value, failures) {
  if (typeof value === "string") {
    for (const line of value.split(/\r?\n/u)) {
      if (/^not ok\b/u.test(line.trim())) failures.push(line.trim());
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visit(item, failures);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) visit(item, failures);
  }
}

export function collectTapFailures(results) {
  const failures = [];
  visit(results, failures);
  return failures;
}

function collectStrings(value, strings) {
  if (typeof value === "string") strings.push(...value.split(/\r?\n/u));
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, strings));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }
}

export function analyzeTapResults(results) {
  const failures = collectTapFailures(results);
  if (failures.length > 0) throw new Error(failures.join("\n"));

  const lines = [];
  collectStrings(results, lines);
  const planLine = lines.map((line) => line.trim()).find((line) => /^1\.\.\d+$/u.test(line));
  if (!planLine) throw new Error("Database test did not return a TAP plan.");
  const plannedCount = Number(planLine.slice(3));
  const assertionCount = lines.filter((line) => /^ok\s+\d+\b/u.test(line.trim())).length;
  if (assertionCount !== plannedCount) {
    throw new Error(`TAP plan expected ${plannedCount} assertions but received ${assertionCount}.`);
  }
  return { assertionCount, plannedCount };
}

async function resolveTestFiles(arguments_) {
  if (arguments_.length > 0) return arguments_.map((item) => path.resolve(item));
  const directory = path.resolve("supabase/tests");
  const entries = await readdir(directory);
  return entries
    .filter((entry) => entry.endsWith(".test.sql"))
    .sort()
    .map((entry) => path.join(directory, entry));
}

export async function runCloudDatabaseTests(arguments_, env = process.env) {
  const { projectRef } = validateTargetFromEnvironment("test", env);
  if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is required.");
  validateDatabaseUrl(env.SUPABASE_DB_URL, projectRef);

  const [{ Client }, files] = await Promise.all([
    import("pg"),
    resolveTestFiles(arguments_),
  ]);
  if (files.length === 0) throw new Error("No database test files were found.");

  const client = new Client({ connectionString: env.SUPABASE_DB_URL, ssl: true });
  await client.connect();
  try {
    for (const file of files) {
      const sql = await readFile(file, "utf8");
      await client.query("begin");
      try {
        const result = await client.query(sql);
        analyzeTapResults(result);
        process.stdout.write(`PASS ${path.relative(process.cwd(), file)}\n`);
      } finally {
        await client.query("rollback");
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCloudDatabaseTests(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
