# SAT12 Stage 3 Storage Security Test Split

## Why the split exists

Supabase Storage rejects direct `DELETE FROM storage.objects` and requires object deletion through the Storage API. Transactional pgTAP therefore verifies database and metadata boundaries only. Object update and deletion behavior is verified separately through authenticated Storage API clients.

## Transactional database suite

Command (requires separately approved `test:<project-ref>`):

```powershell
npm run test:db:cloud -- supabase/tests/storage_rls.test.sql
```

The repository-owned runner opens one PostgreSQL transaction for the complete file and always rolls it back. The 12 assertions cover:

- exact owner/revision upload-prefix decisions;
- cross-owner, cross-revision, traversal, and unsupported-bucket denial;
- editable metadata deletion and legal-hold metadata protection;
- anonymous access to only the current published revision;
- owner access to owned revision images;
- AAL1-admin denial and AAL2-admin access;
- rejection of metadata that references a nonexistent object.

Direct Storage object UPDATE, UPSERT, and DELETE statements are forbidden in this suite by a local regression test.

## Storage API suite

Command (requires separate `storage-api-test:<project-ref>` approval):

```powershell
npm run test:storage:cloud
```

The runner creates a unique run ID, two disposable verified test users, four run-scoped properties/revisions, and private object paths. The tested operations use only authenticated owner/other-owner clients. The operator client is never passed to the security-scenario function.

The nine API scenarios cover:

1. owner upload to an editable revision;
2. object update denial;
3. object upsert denial;
4. cross-owner deletion denial;
5. metadata-first deletion denial;
6. submitted-revision deletion denial;
7. published-revision deletion denial;
8. legal-hold deletion denial;
9. successful editable deletion after authenticated metadata removal.

Operator credentials are limited to fixture provisioning, independent object-state observation, run-scoped cleanup, and post-cleanup verification. They are not used for the actions under test and are never printed.

## Cleanup boundary

Storage API calls are not transactionally reversible. Cleanup therefore runs in `finally`-equivalent control flow after success or failure:

1. remove run-scoped legal holds and image metadata;
2. remove only the four known run-scoped object paths through the Storage API;
3. remove only the four run-scoped properties/revisions;
4. remove only the two run-scoped Auth users;
5. query Auth users, trigger-created profiles, properties, revisions, image metadata, legal holds, and Storage objects by their generated IDs/paths and require zero remaining rows.

Post-cleanup verification still runs if cleanup reports an error so any residue is reported explicitly. The runner never resets a database, enumerates or deletes unrelated prefixes, or uses a shared fixture identity.

## Required local-only credentials

The ignored operational environment must provide the approved project URL/reference, publishable key, database URL, verified CA path when overridden, and service-role key. The service-role key is accepted only by this trusted operator script; it must never use a `NEXT_PUBLIC_*` name or enter browser code, logs, screenshots, or Git.

No remote execution is authorized merely because credentials exist. Each database or Storage API run requires its exact process-scoped approval value, which must be cleared immediately afterward.
