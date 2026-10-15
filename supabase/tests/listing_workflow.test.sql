select extensions.plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workflow-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workflow-admin@example.test', '', now(), '{}', '{}', now(), now());
update public.profiles set role = 'owner_agent' where id = '41000000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin' where id = '41000000-0000-4000-8000-000000000002';
insert into public.properties (id, owner_id, slug)
values ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'workflow-stable-slug');
insert into public.property_revisions (id, property_id, revision_number, title, description, listing_intent, property_type, price_inr, locality, latitude, longitude, bedrooms, bathrooms, area_sq_ft, construction_status, created_by)
values ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 1, 'Workflow Home', 'Complete workflow listing description', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', '41000000-0000-4000-8000-000000000001');
insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by)
values ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'workflow/revision-1/image.webp', 'Workflow property image', 0, 1536, 1024, 1000, 'image/webp', 'sat12_illustrative', '41000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.lives_ok($$select public.submit_listing('43000000-0000-4000-8000-000000000001')$$, 'owner submits complete draft');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok($$select public.approve_listing('43000000-0000-4000-8000-000000000001', 'reviewed')$$, '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot approve');
select extensions.throws_ok($$select public.reject_listing('43000000-0000-4000-8000-000000000001', 'not suitable')$$, '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot reject');
select extensions.throws_ok($$select public.publish_listing('43000000-0000-4000-8000-000000000001')$$, '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot publish');
select extensions.throws_ok($$select public.archive_listing('42000000-0000-4000-8000-000000000001')$$, '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot archive');
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}', true);
select extensions.throws_ok($$select public.reject_listing('43000000-0000-4000-8000-000000000001', '')$$, '23514', 'SAT12_REJECTION_NOTES_REQUIRED', 'rejection notes are required');
select extensions.lives_ok($$select public.reject_listing('43000000-0000-4000-8000-000000000001', 'needs correction')$$, 'aal2 admin rejects submitted revision');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.lives_ok($$select public.submit_listing('43000000-0000-4000-8000-000000000001')$$, 'owner resubmits rejected revision');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}', true);
select extensions.lives_ok($$select public.approve_listing('43000000-0000-4000-8000-000000000001', 'reviewed')$$, 'aal2 admin approves submitted revision');
select extensions.throws_ok($$select public.approve_listing('43000000-0000-4000-8000-000000000001', 'again')$$, 'P0001', 'SAT12_STALE_REVISION_STATE', 'repeated approval is rejected');
select extensions.is((select count(*) from public.listing_approvals where revision_id = '43000000-0000-4000-8000-000000000001'), 2::bigint, 'one audit row exists for each successful decision');
select extensions.is((select published_revision_id from public.properties where id = '42000000-0000-4000-8000-000000000001'), null::uuid, 'approval does not publish');
select extensions.lives_ok($$select public.publish_listing('43000000-0000-4000-8000-000000000001')$$, 'aal2 admin publishes approved revision');
select extensions.throws_ok($$update public.listing_approvals set notes = 'tampered' where revision_id = '43000000-0000-4000-8000-000000000001'$$, '42501', null, 'approval audit rows are immutable');
reset role;

insert into public.enquiries (id, property_id, property_revision_id_at_submission, sender_id, name, email, message)
values ('45000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Workflow Owner', 'workflow-owner@example.test', 'Keep this enquiry linked across revisions.');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select public.create_listing_revision('42000000-0000-4000-8000-000000000001');
insert into public.property_images (revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by)
select id, 'workflow/revision-2/image.webp', 'Workflow revision two image', 0, 1536, 1024, 1000, 'image/webp', 'sat12_illustrative', '41000000-0000-4000-8000-000000000001'
from public.property_revisions where property_id = '42000000-0000-4000-8000-000000000001' and status = 'draft';
select public.submit_listing((select id from public.property_revisions where property_id = '42000000-0000-4000-8000-000000000001' and status = 'draft'));
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}', true);
select public.approve_listing((select id from public.property_revisions where property_id = '42000000-0000-4000-8000-000000000001' and status = 'submitted'), 'revision two reviewed');
select public.publish_listing((select id from public.property_revisions where property_id = '42000000-0000-4000-8000-000000000001' and status = 'approved'));
select extensions.is((select slug from public.properties where id = '42000000-0000-4000-8000-000000000001'), 'workflow-stable-slug', 'stable slug survives revision publication');
select extensions.is((select status::text from public.property_revisions where id = '43000000-0000-4000-8000-000000000001'), 'superseded', 'previous publication is superseded');
select extensions.is((select count(*) from public.enquiries where id = '45000000-0000-4000-8000-000000000001'), 1::bigint, 'enquiry survives revision publication');
reset role;

select * from extensions.finish();
