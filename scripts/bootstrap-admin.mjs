import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { validateTargetFromEnvironment } from "./supabase-target.mjs";

function required(name, value) {
  if (!value?.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

export function buildBootstrapConfiguration(env = process.env) {
  const { projectRef } = validateTargetFromEnvironment("bootstrap", env);
  return {
    projectRef,
    projectUrl: required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY),
    email: required("SAT12_BOOTSTRAP_ADMIN_EMAIL", env.SAT12_BOOTSTRAP_ADMIN_EMAIL).toLowerCase(),
    reason: required("SAT12_BOOTSTRAP_REASON", env.SAT12_BOOTSTRAP_REASON),
  };
}

export function findConfirmedUserByEmail(users, email) {
  const normalized = email.trim().toLowerCase();
  const matches = users.filter((user) => user.email?.toLowerCase() === normalized);
  if (matches.length !== 1) {
    throw new Error("Bootstrap requires exactly one Auth user matching the configured email.");
  }
  if (!matches[0].email_confirmed_at) {
    throw new Error("Bootstrap target must be an email-confirmed Auth user.");
  }
  return matches[0];
}

async function listAllUsers(client) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Unable to inspect Auth users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
}

export async function runBootstrap(env = process.env) {
  const configuration = buildBootstrapConfiguration(env);
  const client = createClient(configuration.projectUrl, configuration.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const target = findConfirmedUserByEmail(
    await listAllUsers(client),
    configuration.email,
  );
  const { error } = await client.rpc("bootstrap_first_admin", {
    p_target_id: target.id,
    p_reason: configuration.reason,
  });
  if (error) throw new Error(`First-admin bootstrap was refused: ${error.message}`);
  process.stdout.write("First SAT12 administrator role assigned; TOTP enrollment is still required.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBootstrap().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
