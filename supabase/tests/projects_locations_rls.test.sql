select extensions.plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage5g-owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('81000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage5g-owner-b@example.test', '', now(), '{}', '{}', now(), now()),
  ('81000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage5g-admin@example.test', '', now(), '{}', '{}', now(), now());
update public.profiles set role = 'owner_agent' where id in (
  '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002'
);
update public.profiles set role = 'admin' where id = '81000000-0000-4000-8000-000000000003';

insert into public.locations (id, slug) values
  ('82000000-0000-4000-8000-000000000001', 'stage5g-dharampeth'),
  ('82000000-0000-4000-8000-000000000002', 'stage5g-private-location');
insert into public.location_revisions (
  id, location_id, revision_number, name, description, centre_latitude, centre_longitude,
  seo_title, seo_description, status, created_by, published_at
) values
  ('82100000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 1,
   'Dharampeth', 'Reviewed Stage 5G published location.', 21.139, 79.057,
   'Property in Dharampeth Nagpur', 'Reviewed published homes and projects in Dharampeth, Nagpur.',
   'published', '81000000-0000-4000-8000-000000000003', now()),
  ('82100000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', 1,
   'Private Fixture', 'Unpublished Stage 5G location fixture.', 21.140, 79.058,
   'Private location fixture Nagpur', 'Unpublished location fixture that must remain private.',
   'draft', '81000000-0000-4000-8000-000000000003', null);
update public.locations set published_revision_id = '82100000-0000-4000-8000-000000000001'
where id = '82000000-0000-4000-8000-000000000001';

insert into public.projects (id, owner_id, slug) values
  ('83000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'stage5g-published'),
  ('83000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'stage5g-submitted'),
  ('83000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002', 'stage5g-cross-owner'),
  ('83000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000001', 'stage5g-archived');
insert into public.project_revisions (
  id, project_id, revision_number, name, builder_name, description, construction_status,
  maharera_number, location_id, locality_text, latitude, longitude, rights_attested_at,
  rights_attestation_version, status, created_by, submitted_at, approved_at, published_at
) values
  ('83100000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 1,
   'Published Project', 'Reviewed Builder', 'Published project fixture with reviewed factual content.',
   'under_construction', 'P50500000001', '82000000-0000-4000-8000-000000000001', 'Dharampeth',
   21.139, 79.057, now(), 'stage5g-v1', 'published', '81000000-0000-4000-8000-000000000001', now(), now(), now()),
  ('83100000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000002', 1,
   'Submitted Project', 'Reviewed Builder', 'Submitted project fixture awaiting evidence review.',
   'under_construction', null, '82000000-0000-4000-8000-000000000001', 'Dharampeth',
   21.139, 79.057, now(), 'stage5g-v1', 'submitted', '81000000-0000-4000-8000-000000000001', now(), null, null),
  ('83100000-0000-4000-8000-000000000003', '83000000-0000-4000-8000-000000000003', 1,
   'Other Owner Project', 'Other Builder', 'Private project fixture owned by another account.',
   'ready_to_move', 'P50500000003', '82000000-0000-4000-8000-000000000001', 'Dharampeth',
   21.139, 79.057, null, null, 'draft', '81000000-0000-4000-8000-000000000002', null, null, null),
  ('83100000-0000-4000-8000-000000000004', '83000000-0000-4000-8000-000000000004', 1,
   'Archived Project', 'Reviewed Builder', 'Archived project fixture that must not be public.',
   'ready_to_move', 'P50500000004', '82000000-0000-4000-8000-000000000001', 'Dharampeth',
   21.139, 79.057, now(), 'stage5g-v1', 'published', '81000000-0000-4000-8000-000000000001', now(), now(), now());
update public.projects set published_revision_id = '83100000-0000-4000-8000-000000000001'
where id = '83000000-0000-4000-8000-000000000001';
update public.projects set published_revision_id = '83100000-0000-4000-8000-000000000004', archived_at = now()
where id = '83000000-0000-4000-8000-000000000004';
insert into public.project_rera_evidence (
  id, project_id, revision_id, claimed_number, official_source_url, submitted_by,
  decision, reviewer_id, reviewed_at, review_reason
) values
  ('83200000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001',
   '83100000-0000-4000-8000-000000000001', 'P50500000001', 'https://example.test/rera/1',
   '81000000-0000-4000-8000-000000000001', 'verified', '81000000-0000-4000-8000-000000000003', now(), null),
  ('83200000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000002',
   '83100000-0000-4000-8000-000000000002', null, null,
   '81000000-0000-4000-8000-000000000001', 'not_applicable', '81000000-0000-4000-8000-000000000003', now(), 'claim requires legal review');

set local role anon;
select extensions.is((select count(*) from public.projects), 1::bigint, 'anonymous sees only exact published projects');
select extensions.is((select count(*) from public.project_revisions), 1::bigint, 'anonymous sees only exact published project revisions');
select extensions.is((select count(*) from public.locations), 1::bigint, 'anonymous sees only exact published locations');
select extensions.is((select count(*) from public.location_revisions), 1::bigint, 'anonymous sees only exact published location revisions');
select extensions.throws_ok($$select count(*) from public.project_rera_evidence$$, '42501', null, 'anonymous cannot read RERA evidence');
select extensions.is((select count(*) from public.projects where id = '83000000-0000-4000-8000-000000000004'), 0::bigint, 'archived projects are not public');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}', true);
select extensions.is((select count(*) from public.projects where id = '83000000-0000-4000-8000-000000000001'), 1::bigint, 'owners can still read public projects');
select extensions.is((select count(*) from public.projects where id = '83000000-0000-4000-8000-000000000002'), 0::bigint, 'cross-owner project access is denied');
select extensions.is((select count(*) from public.project_rera_evidence where project_id = '83000000-0000-4000-8000-000000000001'), 0::bigint, 'cross-owner evidence access is denied');
select extensions.throws_ok(
  $$update public.project_revisions set name = 'Tampered' where id = '83100000-0000-4000-8000-000000000001'$$,
  '42501', null, 'cross-owner project updates are denied'
);
select extensions.throws_ok(
  $$select public.create_project_revision('83000000-0000-4000-8000-000000000001')$$,
  '42501', 'SAT12_PROJECT_FORBIDDEN', 'cross-owner revision creation is denied'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.approve_project('83100000-0000-4000-8000-000000000002', 'reviewed')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot approve a project'
);
select extensions.throws_ok(
  $$select public.create_location('{}'::jsonb, 'create')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot curate a location'
);
select extensions.throws_ok(
  $$select public.archive_project('83000000-0000-4000-8000-000000000001', 'archive')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot archive a project'
);

select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.approve_project('83100000-0000-4000-8000-000000000002', 'reviewed')$$,
  '23514', 'SAT12_PROJECT_RERA_NOT_VERIFIED', 'not-applicable evidence cannot approve a project'
);
select extensions.is((select count(*) from public.project_approvals where revision_id = '83100000-0000-4000-8000-000000000002'), 0::bigint, 'failed approval creates no approval record');
select extensions.is((select count(*) from public.project_audit_log where revision_id = '83100000-0000-4000-8000-000000000002' and event = 'approved'), 0::bigint, 'failed approval creates no audit event');
select extensions.throws_ok(
  $$update public.project_audit_log set reason = 'tampered'$$,
  '42501', null, 'project audit history is immutable'
);
select extensions.throws_ok(
  $$delete from public.location_audit_log$$,
  '42501', null, 'location audit history is immutable'
);
select extensions.ok(has_function_privilege('authenticated', 'public.publish_project(uuid,text)', 'EXECUTE'), 'authenticated callers reach guarded publish RPC');
select extensions.ok(not has_table_privilege('authenticated', 'public.projects', 'UPDATE'), 'stable projects deny direct updates');
select extensions.ok(not has_table_privilege('authenticated', 'public.locations', 'INSERT'), 'locations deny direct inserts');
select extensions.ok(not has_table_privilege('authenticated', 'public.project_approvals', 'INSERT'), 'approvals deny direct inserts');
select extensions.ok(not has_column_privilege('authenticated', 'public.project_revisions', 'status', 'UPDATE'), 'project status denies direct updates');
select extensions.ok(not has_column_privilege('authenticated', 'public.project_revisions', 'rights_attested_at', 'UPDATE'), 'rights timestamps deny direct updates');
select extensions.ok(not has_column_privilege('authenticated', 'public.project_rera_evidence', 'decision', 'UPDATE'), 'evidence decisions deny owner updates');
reset role;

insert into public.properties (id, owner_id, slug)
values ('84000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'stage5g-property-association');
insert into public.property_revisions (
  id, property_id, revision_number, title, description, listing_intent, property_type,
  price_inr, locality, latitude, longitude, bedrooms, bathrooms, area_sq_ft,
  construction_status, project_id, project_revision_id, created_by
) values (
  '84100000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 1,
  'Association Fixture', 'Association fixture with an invalid other-owner project.', 'buy', 'apartment',
  5000000, 'Dharampeth', 21.139, 79.057, 2, 2, 1000, 'ready_to_move',
  '83000000-0000-4000-8000-000000000003', '83100000-0000-4000-8000-000000000003',
  '81000000-0000-4000-8000-000000000001'
);
insert into public.property_images (
  id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by
) values (
  '84200000-0000-4000-8000-000000000001', '84100000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001/84000000-0000-4000-8000-000000000001/84100000-0000-4000-8000-000000000001/84200000-0000-4000-8000-000000000001.jpg',
  'Property fixture', 0, 800, 600, 1000, 'image/jpeg', 'owner_uploaded', '81000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.submit_listing('84100000-0000-4000-8000-000000000001')$$,
  '23514', 'SAT12_PROJECT_ASSOCIATION_INVALID', 'property association requires the same owner'
);
select extensions.is((select status from public.property_revisions where id = '84100000-0000-4000-8000-000000000001'), 'draft'::public.revision_status, 'failed property association remains draft');
select extensions.is((select count(*) from public.project_approvals), 0::bigint, 'no unrelated project approval is created');
select extensions.is((select count(*) from public.location_audit_log), 0::bigint, 'fixtures do not invent location audit history');
reset role;

select * from extensions.finish();
