import { pathToFileURL } from "node:url";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const APPROVAL_REQUIRED_OPERATIONS = new Set([
  "test",
  "migrate",
  "seed",
  "bootstrap",
  "fixture-apply",
  "fixture-cleanup",
  "storage-fixture-apply",
  "storage-fixture-cleanup",
]);
const ALLOWED_OPERATIONS = new Set(["read", ...APPROVAL_REQUIRED_OPERATIONS]);

function required(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function validateSupabaseTarget(input) {
  const projectRef = required("SUPABASE_PROJECT_REF", input.projectRef);
  const approvedProjectRef = required(
    "SAT12_APPROVED_PROJECT_REF",
    input.approvedProjectRef,
  );
  const projectUrl = required("NEXT_PUBLIC_SUPABASE_URL", input.projectUrl);
  const operation = required("operation", input.operation);

  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF must be a 20-character project reference.");
  }
  if (projectRef !== approvedProjectRef) {
    throw new Error("Target project does not match SAT12_APPROVED_PROJECT_REF.");
  }
  if (!ALLOWED_OPERATIONS.has(operation)) {
    throw new Error(`Unsupported Supabase operation: ${operation}.`);
  }

  let url;
  try {
    url = new URL(projectUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
  if (url.protocol !== "https:" || url.hostname !== `${projectRef}.supabase.co`) {
    throw new Error("Project URL does not match the approved Supabase project reference.");
  }
  if (input.dataConfirmed !== "true") {
    throw new Error(
      "SAT12_DEVELOPMENT_DATA_CONFIRMED=true is required after confirming there is no production customer data.",
    );
  }

  if (
    APPROVAL_REQUIRED_OPERATIONS.has(operation) &&
    input.operationApproval !== `${operation}:${projectRef}`
  ) {
    throw new Error(
      `SAT12_REMOTE_OPERATION_APPROVED=${operation}:${projectRef} is required for ${operation}.`,
    );
  }

  return { operation, projectRef };
}

export function validateDatabaseUrl(databaseUrl, projectRef) {
  let url;
  try {
    url = new URL(required("SUPABASE_DB_URL", databaseUrl));
  } catch {
    throw new Error("SUPABASE_DB_URL must be a valid PostgreSQL URL.");
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error("SUPABASE_DB_URL must use PostgreSQL.");
  }

  const directMatch = url.hostname === `db.${projectRef}.supabase.co`;
  const poolerMatch =
    url.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(url.username) === `postgres.${projectRef}`;
  if (!directMatch && !poolerMatch) {
    throw new Error("SUPABASE_DB_URL does not belong to the approved project.");
  }
}

export function validateTargetFromEnvironment(operation, env = process.env) {
  return validateSupabaseTarget({
    projectRef: env.SUPABASE_PROJECT_REF,
    approvedProjectRef: env.SAT12_APPROVED_PROJECT_REF,
    projectUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    dataConfirmed: env.SAT12_DEVELOPMENT_DATA_CONFIRMED,
    operation,
    operationApproval: env.SAT12_REMOTE_OPERATION_APPROVED,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { operation, projectRef } = validateTargetFromEnvironment(
      process.argv[2] ?? "read",
    );
    process.stdout.write(`Approved SAT12 ${operation} target: ${projectRef}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
