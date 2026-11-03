select extensions.plan(20);

select extensions.has_table('public', 'projects', 'projects table exists');
select extensions.has_table('public', 'project_revisions', 'project revisions table exists');
select extensions.has_table('public', 'project_images', 'project images table exists');
select extensions.has_table('public', 'project_rera_evidence', 'private RERA evidence table exists');
select extensions.has_table('public', 'project_approvals', 'project approvals table exists');
select extensions.has_table('public', 'project_audit_log', 'project audit table exists');
select extensions.has_table('public', 'locations', 'locations table exists');
select extensions.has_table('public', 'location_revisions', 'location revisions table exists');
select extensions.has_table('public', 'location_audit_log', 'location audit table exists');
select extensions.has_column('public', 'property_revisions', 'location_id', 'property revisions have optional location');
select extensions.has_column('public', 'property_revisions', 'project_id', 'property revisions have optional project');
select extensions.has_column('public', 'property_revisions', 'project_revision_id', 'property revisions capture exact project revision');
select extensions.ok(
  exists (select 1 from pg_constraint where conname = 'projects_published_revision_fk'),
  'projects use an exact same-project published pointer'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conname = 'locations_published_revision_fk'),
  'locations use an exact same-location published pointer'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conname = 'property_revisions_project_revision_fk'),
  'properties use an exact project revision association'
);
select extensions.ok(
  exists (select 1 from pg_indexes where indexname = 'project_revisions_one_working_idx'),
  'projects allow at most one working revision'
);
select extensions.ok(
  exists (select 1 from pg_indexes where indexname = 'location_revisions_one_draft_idx'),
  'locations allow at most one draft revision'
);
select extensions.ok(
  (select not public from storage.buckets where id = 'project-images'),
  'project image bucket is private'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.submit_project(uuid,text)', 'EXECUTE'),
  'authenticated users can invoke the guarded project submission RPC'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.project_rera_evidence', 'SELECT'),
  'anonymous users have no RERA evidence table privilege'
);

select * from extensions.finish();
