import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildVerifiedTlsConfig } from "./cloud-db-test-runner.mjs";
import {
  validateDatabaseUrl,
  validateTargetFromEnvironment,
} from "./supabase-target.mjs";

const BUCKET = "property-images";
const CONTENT_TYPE = "image/webp";

function required(name, value) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function expectApiSuccess(result, errorCode) {
  if (result?.error) throw new Error(errorCode);
}

async function expectObjectState(observer, pathValue, expected, description) {
  const actual = await observer.exists(pathValue);
  if (actual !== expected) throw new Error(`SAT12_STORAGE_API_ASSERTION_FAILED: ${description}`);
}

export function validateStorageApiTestOperation(env = process.env) {
  return validateTargetFromEnvironment("storage-api-test", env);
}

export async function runStorageApiSecurityScenarios(input) {
  const passed = [];

  expectApiSuccess(
    await input.owner.upload(input.paths.draft, input.body, {
      contentType: CONTENT_TYPE,
      upsert: false,
    }),
    "SAT12_STORAGE_API_OWNER_UPLOAD_FAILED",
  );
  await input.recordDraftMetadata();
  await expectObjectState(input.observer, input.paths.draft, true, "owner upload");
  passed.push("owner upload");

  const update = await input.owner.update(input.paths.draft, input.body, {
    contentType: CONTENT_TYPE,
    upsert: false,
  });
  if (!update.error) throw new Error("SAT12_STORAGE_API_UPDATE_WAS_ALLOWED");
  await expectObjectState(input.observer, input.paths.draft, true, "update preserves object");
  passed.push("update denied");

  const upsert = await input.owner.upload(input.paths.draft, input.body, {
    contentType: CONTENT_TYPE,
    upsert: true,
  });
  if (!upsert.error) throw new Error("SAT12_STORAGE_API_UPSERT_WAS_ALLOWED");
  await expectObjectState(input.observer, input.paths.draft, true, "upsert preserves object");
  passed.push("upsert denied");

  await input.otherOwner.remove([input.paths.draft]);
  await expectObjectState(input.observer, input.paths.draft, true, "cross-owner delete");
  passed.push("cross-owner delete denied");

  await input.owner.remove([input.paths.draft]);
  await expectObjectState(input.observer, input.paths.draft, true, "metadata-first delete");
  passed.push("metadata-first delete denied");

  await input.owner.remove([input.paths.submitted]);
  await expectObjectState(input.observer, input.paths.submitted, true, "submitted delete");
  passed.push("submitted delete denied");

  await input.owner.remove([input.paths.published]);
  await expectObjectState(input.observer, input.paths.published, true, "published delete");
  passed.push("published delete denied");

  await input.owner.remove([input.paths.held]);
  await expectObjectState(input.observer, input.paths.held, true, "legal-hold delete");
  passed.push("legal-hold delete denied");

  await input.deleteDraftMetadata();
  expectApiSuccess(
    await input.owner.remove([input.paths.draft]),
    "SAT12_STORAGE_API_EDITABLE_DELETE_FAILED",
  );
  await expectObjectState(input.observer, input.paths.draft, false, "editable delete");
  passed.push("editable delete succeeds");

  return passed;
}

export async function executeStorageApiTestRun(input) {
  const fixture = await input.createFixture();
  let result;
  let scenarioError;
  let cleanupError;
  try {
    result = await input.runScenarios(fixture);
  } catch (error) {
    scenarioError = error;
  }
  try {
    await input.cleanupFixture(fixture);
  } catch (error) {
    cleanupError = error;
  }
  try {
    await input.verifyCleanup(fixture);
  } catch (error) {
    cleanupError = cleanupError
      ? new AggregateError([cleanupError, error], "Storage API cleanup and verification failed.")
      : error;
  }
  if (scenarioError && cleanupError) {
    throw new AggregateError([scenarioError, cleanupError], "Storage API test and cleanup failed.");
  }
  if (scenarioError) throw scenarioError;
  if (cleanupError) throw cleanupError;
  return result;
}

export async function recoverFailedFixtureSetup(input) {
  const errors = [input.setupError];
  try {
    await input.cleanupFixture(input.fixture);
  } catch (error) {
    errors.push(error);
  }
  try {
    await input.verifyCleanup(input.fixture);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw input.setupError;
  throw new AggregateError(errors, "Storage API fixture setup and recovery failed.");
}

export async function runCleanupSteps(steps) {
  const errors = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, `${errors.length} Storage API cleanup steps failed.`);
  }
}

function createAuthenticatedClient(createClient, env, accessToken) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function signIn(createClient, env, email, password) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session?.access_token) {
    throw new Error("SAT12_STORAGE_API_TEST_SIGN_IN_FAILED");
  }
  return createAuthenticatedClient(createClient, env, result.data.session.access_token);
}

function imagePath(ownerId, propertyId, revisionId, imageId) {
  return `${ownerId}/${propertyId}/${revisionId}/${imageId}.webp`;
}

async function createFixtureResources(env) {
  const [{ createClient }, { Client }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("pg"),
  ]);
  const projectRef = env.SUPABASE_PROJECT_REF;
  validateDatabaseUrl(required("SUPABASE_DB_URL", env.SUPABASE_DB_URL), projectRef);
  const certificate = await readFile(
    env.SUPABASE_SSL_ROOT_CERT || path.resolve("certificates/supabase-root-2021-ca.crt"),
    "utf8",
  );
  const database = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: buildVerifiedTlsConfig(certificate),
  });
  await database.connect();

  const operator = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const runId = randomUUID();
  const fixture = {
    runId,
    database,
    operator,
    userIds: [],
    propertyIds: [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    revisionIds: [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    imageIds: [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    paths: {},
  };

  try {
    const password = `${randomBytes(24).toString("base64url")}Aa1!`;
    const emails = [`sat12-storage-${runId}-a@example.test`, `sat12-storage-${runId}-b@example.test`];
    for (const email of emails) {
      const created = await operator.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "SAT12 Storage Test" },
      });
      if (created.error || !created.data.user) throw new Error("SAT12_STORAGE_API_USER_SETUP_FAILED");
      fixture.userIds.push(created.data.user.id);
    }
    const [ownerId] = fixture.userIds;
    await database.query("update public.profiles set role='owner_agent' where id = any($1::uuid[])", [
      fixture.userIds,
    ]);

    const statuses = ["draft", "submitted", "published", "draft"];
    const slugs = ["draft", "submitted", "published", "held"];
    for (let index = 0; index < fixture.propertyIds.length; index += 1) {
      await database.query(
        "insert into public.properties (id, owner_id, slug) values ($1, $2, $3)",
        [fixture.propertyIds[index], ownerId, `storage-api-${runId}-${slugs[index]}`],
      );
      await database.query(
        `insert into public.property_revisions (
          id, property_id, revision_number, title, description, listing_intent,
          property_type, price_inr, locality, latitude, longitude, bedrooms,
          bathrooms, area_sq_ft, construction_status, status, created_by
        ) values ($1,$2,1,$3,'Run-scoped Storage API security fixture','buy','apartment',5000000,'Nagpur',21.14,79.08,2,2,1000,'ready_to_move',$4,$5)`,
        [fixture.revisionIds[index], fixture.propertyIds[index], `Storage API ${slugs[index]}`, statuses[index], ownerId],
      );
    }
    await database.query("update public.properties set published_revision_id=$1 where id=$2", [
      fixture.revisionIds[2],
      fixture.propertyIds[2],
    ]);

    fixture.paths = {
      draft: imagePath(ownerId, fixture.propertyIds[0], fixture.revisionIds[0], fixture.imageIds[0]),
      submitted: imagePath(ownerId, fixture.propertyIds[1], fixture.revisionIds[1], fixture.imageIds[1]),
      published: imagePath(ownerId, fixture.propertyIds[2], fixture.revisionIds[2], fixture.imageIds[2]),
      held: imagePath(ownerId, fixture.propertyIds[3], fixture.revisionIds[3], fixture.imageIds[3]),
    };
    fixture.body = await readFile(path.resolve("public/images/properties/property-01.webp"));
    const operatorBucket = operator.storage.from(BUCKET);
    for (const pathValue of [fixture.paths.submitted, fixture.paths.published, fixture.paths.held]) {
      expectApiSuccess(
        await operatorBucket.upload(pathValue, fixture.body, { contentType: CONTENT_TYPE, upsert: false }),
        "SAT12_STORAGE_API_OBJECT_SETUP_FAILED",
      );
    }
    for (const index of [1, 2, 3]) {
      await database.query(
        `insert into public.property_images
          (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by)
         values ($1,$2,$3,'Storage API test image',0,1200,800,$4,'image/webp','owner_uploaded',$5)`,
        [fixture.imageIds[index], fixture.revisionIds[index], Object.values(fixture.paths)[index], fixture.body.length, ownerId],
      );
    }
    await database.query(
      "insert into public.legal_holds (entity_kind, entity_id, reason, created_by) values ('image',$1,'Storage API legal-hold test',$2)",
      [fixture.imageIds[3], ownerId],
    );

    fixture.ownerClient = await signIn(createClient, env, emails[0], password);
    fixture.otherOwnerClient = await signIn(createClient, env, emails[1], password);
    return fixture;
  } catch (error) {
    return recoverFailedFixtureSetup({
      fixture,
      setupError: error,
      cleanupFixture: cleanupFixtureResources,
      verifyCleanup: verifyFixtureCleanup,
    });
  }
}

async function cleanupFixtureResources(fixture) {
  const paths = Object.values(fixture.paths ?? {});
  const steps = [];
  if (fixture.database) {
    if (fixture.imageIds?.length) {
      steps.push(
        () => fixture.database.query("delete from public.legal_holds where entity_id = any($1::uuid[])", [fixture.imageIds]),
        () => fixture.database.query("delete from public.property_images where id = any($1::uuid[])", [fixture.imageIds]),
      );
    }
  }
  if (paths.length && fixture.operator) {
    steps.push(async () => {
      const removed = await fixture.operator.storage.from(BUCKET).remove(paths);
      if (removed.error) throw new Error("SAT12_STORAGE_API_OBJECT_CLEANUP_FAILED");
    });
  }
  if (fixture.database && fixture.propertyIds?.length) {
    steps.push(
      () => fixture.database.query(
        "update public.properties set published_revision_id=null where id = any($1::uuid[])",
        [fixture.propertyIds],
      ),
      () => fixture.database.query("delete from public.properties where id = any($1::uuid[])", [fixture.propertyIds]),
    );
  }
  if (fixture.operator) {
    for (const userId of fixture.userIds ?? []) {
      steps.push(async () => {
        const removed = await fixture.operator.auth.admin.deleteUser(userId);
        if (removed.error) throw new Error("SAT12_STORAGE_API_USER_CLEANUP_FAILED");
      });
    }
  }
  await runCleanupSteps(steps);
}

export async function verifyFixtureCleanup(fixture) {
  try {
    const result = await fixture.database.query(
      `select
        (select count(*)::int from auth.users where id = any($1::uuid[])) as users,
        (select count(*)::int from public.profiles where id = any($1::uuid[])) as profiles,
        (select count(*)::int from public.properties where id = any($2::uuid[])) as properties,
        (select count(*)::int from public.property_revisions where id = any($3::uuid[])) as revisions,
        (select count(*)::int from public.property_images where id = any($4::uuid[])) as metadata,
        (select count(*)::int from public.legal_holds where entity_id = any($4::uuid[])) as legal_holds,
        (select count(*)::int from storage.objects where bucket_id=$5 and name = any($6::text[])) as objects`,
      [fixture.userIds, fixture.propertyIds, fixture.revisionIds, fixture.imageIds, BUCKET, Object.values(fixture.paths)],
    );
    if (Object.values(result.rows[0]).some((count) => count !== 0)) {
      throw new Error("SAT12_STORAGE_API_CLEANUP_VERIFICATION_FAILED");
    }
  } finally {
    await fixture.database.end();
  }
}

export async function runStorageApiTestCommand(env = process.env) {
  validateStorageApiTestOperation(env);
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);
  required("SUPABASE_DB_URL", env.SUPABASE_DB_URL);

  const results = await executeStorageApiTestRun({
    createFixture: () => createFixtureResources(env),
    runScenarios: (fixture) => {
      const ownerBucket = fixture.ownerClient.storage.from(BUCKET);
      const otherOwnerBucket = fixture.otherOwnerClient.storage.from(BUCKET);
      return runStorageApiSecurityScenarios({
        owner: ownerBucket,
        otherOwner: otherOwnerBucket,
        observer: {
          exists: async (pathValue) => {
            const result = await fixture.database.query(
              "select exists(select 1 from storage.objects where bucket_id=$1 and name=$2) as present",
              [BUCKET, pathValue],
            );
            return result.rows[0].present;
          },
        },
        recordDraftMetadata: async () => {
          const result = await fixture.ownerClient.from("property_images").insert({
            id: fixture.imageIds[0],
            revision_id: fixture.revisionIds[0],
            storage_path: fixture.paths.draft,
            alt_text: "Storage API draft test image",
            position: 0,
            width: 1200,
            height: 800,
            size_bytes: fixture.body.length,
            mime_type: CONTENT_TYPE,
            source_kind: "owner_uploaded",
            created_by: fixture.userIds[0],
          });
          expectApiSuccess(result, "SAT12_STORAGE_API_METADATA_SETUP_FAILED");
        },
        deleteDraftMetadata: async () => {
          const result = await fixture.ownerClient
            .from("property_images")
            .delete()
            .eq("id", fixture.imageIds[0]);
          expectApiSuccess(result, "SAT12_STORAGE_API_METADATA_DELETE_FAILED");
        },
        body: fixture.body,
        paths: fixture.paths,
      });
    },
    cleanupFixture: cleanupFixtureResources,
    verifyCleanup: verifyFixtureCleanup,
  });
  process.stdout.write(`PASS Storage API security scenarios ${results.length}/${results.length}; cleanup verified.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStorageApiTestCommand().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
