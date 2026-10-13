import { validateTargetFromEnvironment } from "./supabase-target.mjs";

try {
  const { operation, projectRef } = validateTargetFromEnvironment(
    process.argv[2] ?? "read",
  );
  process.stdout.write(`Approved SAT12 ${operation} target: ${projectRef}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
