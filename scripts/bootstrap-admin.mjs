import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

import { buildVerifiedTlsConfig } from "./cloud-db-test-runner.mjs";
import {
  validateDatabaseUrl,
  validateTargetFromEnvironment,
} from "./supabase-target.mjs";

const SUPABASE_ROOT_CA_PATH = path.resolve("certificates/supabase-root-2021-ca.crt");

function required(name, value) {
  if (!value?.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

export function buildBootstrapConfiguration(env = process.env) {
  const { projectRef } = validateTargetFromEnvironment("bootstrap", env);
  const databaseUrl = required("SUPABASE_DB_URL", env.SUPABASE_DB_URL);
  validateDatabaseUrl(databaseUrl, projectRef);
  return {
    projectRef,
    projectUrl: required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY),
    databaseUrl,
    certificatePath: env.SUPABASE_SSL_ROOT_CERT || SUPABASE_ROOT_CA_PATH,
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
    if (error || !data?.users) throw new Error("SAT12_BOOTSTRAP_USER_LOOKUP_FAILED");
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
}

export function createBootstrapStateReader(database) {
  return {
    async getState(userId, reason) {
      try {
        await database.query("begin read only");
        const result = await database.query(
          `select
             (select role::text from public.profiles where id = $1) as role,
             (select count(*)::int from public.profiles where role = 'admin') as admin_count,
             (select count(*)::int
                from public.role_audit_log
               where target_profile_id = $1
                 and previous_role = 'user'
                 and new_role = 'admin'
                 and actor_id is null
                 and actor_kind = 'bootstrap'
                 and reason = $2
                 and created_at is not null) as matching_audit_count`,
          [userId, reason],
        );
        const state = result.rows?.[0];
        if (result.rowCount !== 1
          || typeof state?.role !== "string"
          || !Number.isInteger(state?.admin_count)
          || !Number.isInteger(state?.matching_audit_count)) {
          throw new Error();
        }
        await database.query("commit");
        return {
          role: state.role,
          adminCount: state.admin_count,
          matchingAuditCount: state.matching_audit_count,
        };
      } catch {
        await database.query("rollback").catch(() => {});
        throw new Error("SAT12_BOOTSTRAP_STATE_LOOKUP_FAILED");
      }
    },
  };
}

async function openBootstrapStateReader(configuration) {
  const certificate = await readFile(configuration.certificatePath, "utf8");
  const database = new Client({
    connectionString: configuration.databaseUrl,
    ssl: buildVerifiedTlsConfig(certificate),
  });
  await database.connect();
  return {
    ...createBootstrapStateReader(database),
    close: () => database.end(),
  };
}

export function createBootstrapOperator(client, stateReader) {
  return {
    listUsers: () => listAllUsers(client),
    getState: (userId, reason) => stateReader.getState(userId, reason),
    async bootstrap(userId, reason) {
      const { error } = await client.rpc("bootstrap_first_admin", {
        p_target_id: userId,
        p_reason: reason,
      });
      if (error) throw new Error("SAT12_BOOTSTRAP_FAILED");
    },
  };
}

export async function runBootstrap(env = process.env, options = {}) {
  let stateReader;
  try {
    const configuration = buildBootstrapConfiguration(env);
    const client = options.operator
      ? null
      : createClient(configuration.projectUrl, configuration.serviceRoleKey, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      });
    stateReader = options.operator ? null : await openBootstrapStateReader(configuration);
    const operator = options.operator ?? createBootstrapOperator(client, stateReader);
    const target = findConfirmedUserByEmail(await operator.listUsers(), configuration.email);
    const initialState = await operator.getState(target.id, configuration.reason);
    if (initialState.role !== "user") throw new Error("SAT12_BOOTSTRAP_ROLE_INVALID");
    if (initialState.adminCount !== 0) throw new Error("SAT12_BOOTSTRAP_ADMIN_EXISTS");

    try {
      await operator.bootstrap(target.id, configuration.reason);
    } catch {
      throw new Error("SAT12_BOOTSTRAP_FAILED");
    }

    let finalState;
    try {
      finalState = await operator.getState(target.id, configuration.reason);
    } catch {
      throw new Error("SAT12_BOOTSTRAP_OUTCOME_UNCERTAIN");
    }
    if (finalState.role !== "admin"
      || finalState.adminCount !== 1
      || finalState.matchingAuditCount !== 1) {
      throw new Error("SAT12_BOOTSTRAP_OUTCOME_UNCERTAIN");
    }
    (options.write ?? ((message) => process.stdout.write(message)))(
      "First SAT12 administrator assigned and audit verified; TOTP enrollment is still required.\n",
    );
  } finally {
    try {
      await stateReader?.close();
    } finally {
      delete env.SAT12_REMOTE_OPERATION_APPROVED;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBootstrap().catch((error) => {
    const message = error instanceof Error && error.message.startsWith("SAT12_")
      ? error.message
      : "SAT12_BOOTSTRAP_FAILED";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
