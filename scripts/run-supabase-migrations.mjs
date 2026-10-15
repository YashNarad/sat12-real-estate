import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { validateTargetFromEnvironment } from "./supabase-target.mjs";

const require = createRequire(import.meta.url);
const SUPABASE_BINARY_PACKAGES = {
  darwin: { arm64: ["darwin-arm64"], x64: ["darwin-x64"] },
  linux: {
    arm64: ["linux-arm64", "linux-arm64-musl"],
    x64: ["linux-x64", "linux-x64-musl"],
  },
  win32: { arm64: ["windows-arm64"], x64: ["windows-x64"] },
};

export function resolveSupabaseExecutable(
  platform = process.platform,
  architecture = process.arch,
) {
  const override = process.env.SUPABASE_CLI_BINARY_OVERRIDE;
  if (override) return override;

  const candidates = SUPABASE_BINARY_PACKAGES[platform]?.[architecture] ?? [];
  const extension = platform === "win32" ? ".exe" : "";
  for (const candidate of candidates) {
    try {
      const packageDirectory = path.dirname(
        require.resolve(`@supabase/cli-${candidate}/package.json`),
      );
      return path.join(packageDirectory, "bin", `supabase${extension}`);
    } catch {}
  }
  throw new Error(`No Supabase CLI binary is installed for ${platform}-${architecture}.`);
}

export function buildMigrationCommands(projectRef, apply) {
  const commands = [
    ["supabase", "link", "--project-ref", projectRef],
    ["supabase", "migration", "list", "--linked"],
    ["supabase", "db", "push", "--linked", "--dry-run"],
  ];
  if (apply) commands.push(["supabase", "db", "push", "--linked"]);
  return commands;
}

export function buildSupabaseInvocation(
  command,
  executable = resolveSupabaseExecutable(),
) {
  return {
    executable,
    args: command.slice(1),
  };
}

export function runMigrationWorkflow(apply, env = process.env) {
  const { projectRef } = validateTargetFromEnvironment(apply ? "migrate" : "read", env);
  for (const command of buildMigrationCommands(projectRef, apply)) {
    const invocation = buildSupabaseInvocation(command);
    const result = spawnSync(invocation.executable, invocation.args, {
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
