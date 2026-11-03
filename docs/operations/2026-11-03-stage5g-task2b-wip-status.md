# Stage 5G Task 2B — Preserved Local WIP Status

**Status:** intentionally preserved unfinished local work; not reviewed for deployment.

**Date:** 2026-11-03

## Included files

- `supabase/migrations/20261031120000_stage5g_projects_locations.sql`
- `src/supabase/projects-locations-migration.test.ts`
- `supabase/tests/projects_locations_schema.test.sql`
- `supabase/tests/projects_locations_rls.test.sql`
- `supabase/tests/project_storage_rls.test.sql`

## Current state

The migration draft introduces the proposed Projects and Locations schema,
private project image bucket, RLS policies, guarded RPCs, and local contract
and pgTAP suites. It has not been applied to any database.

The pgTAP files are prepared only. They have not been run against a local or
cloud PostgreSQL/Supabase environment.

At preservation time, the focused TypeScript migration-contract suite is red
on three newly added expectations. The outstanding work is to complete and
review the following safeguards:

1. Preserve project/location association fields when an existing property
   revision is cloned.
2. Snapshot the locality text from the selected exact published location at
   project submission rather than accepting owner-supplied text as authoritative.
3. Constrain project and location audit revision IDs to their matching stable
   parent IDs.

The conservative MahaRERA model is deliberate: `not_applicable` evidence can
be recorded for review but cannot approve or publish a project. Only a claimed
registration with administrator-verified official-source evidence can advance.

## Release restriction

Do not preview, deploy, or run these migration/pgTAP files against Supabase
until the focused contract is green, a complete SQL security review is done,
and separate deployment authorization is provided.
