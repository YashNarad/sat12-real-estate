import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveSupabaseExecutable } from "./run-supabase-migrations.mjs";
import { validateTargetFromEnvironment } from "./supabase-target.mjs";

export function buildTypeGenerationArguments(projectRef) {
  return ["gen", "types", "typescript", "--project-id", projectRef, "--schema", "public"];
}

export function assertGeneratedTypesMatch(committed, generated) {
  if (committed !== generated) {
    throw new Error(
      "Generated database type drift detected. Regenerate and review src/types/database.generated.ts.",
    );
  }
}

export function validateTypeDriftTarget(env = process.env) {
  return validateTargetFromEnvironment("read", env);
}

export function checkDatabaseTypeDrift(env = process.env) {
  const { projectRef } = validateTypeDriftTarget(env);
  const result = spawnSync(
    resolveSupabaseExecutable(),
    buildTypeGenerationArguments(projectRef),
    { encoding: "utf8", env, shell: false },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Supabase type generation failed with exit code ${result.status}.`);
  }
  const committed = readFileSync(
    path.resolve("src/types/database.generated.ts"),
    "utf8",
  );
  assertGeneratedTypesMatch(committed, result.stdout);
  process.stdout.write("Database-generated types match the approved development schema.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkDatabaseTypeDrift();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
