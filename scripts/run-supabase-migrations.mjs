import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { validateTargetFromEnvironment } from "./supabase-target.mjs";

export function buildMigrationCommands(projectRef, apply) {
  const commands = [
    ["supabase", "link", "--project-ref", projectRef],
    ["supabase", "migration", "list", "--linked"],
    ["supabase", "db", "push", "--linked", "--dry-run"],
  ];
  if (apply) commands.push(["supabase", "db", "push", "--linked"]);
  return commands;
}

export function runMigrationWorkflow(apply, env = process.env) {
  const { projectRef } = validateTargetFromEnvironment(apply ? "migrate" : "read", env);
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  for (const command of buildMigrationCommands(projectRef, apply)) {
    const result = spawnSync(executable, command, {
      env,
      stdio: "inherit",
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Supabase command failed with exit code ${result.status}.`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? "preview";
  if (!['preview', 'apply'].includes(mode)) {
    process.stderr.write("Usage: run-supabase-migrations.mjs [preview|apply]\n");
    process.exitCode = 1;
  } else {
    try {
      runMigrationWorkflow(mode === "apply");
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
