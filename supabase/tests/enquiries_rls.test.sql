select extensions.plan(35);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('51000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lead-owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lead-owner-b@example.test', '', now(), '{}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lead-user@example.test', '', now(), '{}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lead-admin@example.test', '', now(), '{}', '{}', now(), now());
update public.profiles set role = 'owner_agent' where id in ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002');
update public.profiles set role = 'admin' where id = '51000000-0000-4000-8000-000000000004';

insert into public.properties (id, owner_id, slug, archived_at) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'lead-published', null),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'lead-draft', null),
  ('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', 'lead-submitted', null),
  ('52000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000001', 'lead-rejected', null),
  ('52000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000001', 'lead-archived', now());

insert into public.property_revisions (id, property_id, revision_number, title, description, listing_intent, property_type, price_inr, locality, latitude, longitude, bedrooms, bathrooms, area_sq_ft, construction_status, status, published_at, created_by)
values
  ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 1, 'Published lead home', 'Published lead test property.', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'published', now(), '51000000-0000-4000-8000-000000000001'),
  ('53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 1, 'Draft lead home', 'Draft lead test property.', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'draft', null, '51000000-0000-4000-8000-000000000001'),
  ('53000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000003', 1, 'Submitted lead home', 'Submitted lead test property.', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'submitted', null, '51000000-0000-4000-8000-000000000001'),
  ('53000000-0000-4000-8000-000000000004', '52000000-0000-4000-8000-000000000004', 1, 'Rejected lead home', 'Rejected lead test property.', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'rejected', null, '51000000-0000-4000-8000-000000000001'),
  ('53000000-0000-4000-8000-000000000005', '52000000-0000-4000-8000-000000000005', 1, 'Archived lead home', 'Archived lead test property.', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'published', now(), '51000000-0000-4000-8000-000000000001');
update public.properties set published_revision_id = '53000000-0000-4000-8000-000000000001' where id = '52000000-0000-4000-8000-000000000001';
update public.properties set published_revision_id = '53000000-0000-4000-8000-000000000005' where id = '52000000-0000-4000-8000-000000000005';
select set_config('app.settings.enquiry_submissions_enabled', 'on', true);

set local role anon;
select extensions.is((select count(*) from public.enquiries), 0::bigint, 'anonymous cannot list enquiries');
select extensions.throws_ok($$insert into public.enquiries (property_id, property_revision_id_at_submission, recipient_id, name, email, message) values ('52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','Buyer','buyer@example.test','Direct inserts stay forbidden.')$$, '42501', null, 'anonymous direct insert is denied');
select extensions.lives_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000001','Buyer Name','buyer@example.test','', 'Please arrange a viewing this weekend.')$$, 'anonymous submits to a published property through the RPC');
reset role;
select extensions.ok(exists(select 1 from public.enquiries where property_id='52000000-0000-4000-8000-000000000001' and property_revision_id_at_submission='53000000-0000-4000-8000-000000000001' and recipient_id='51000000-0000-4000-8000-000000000001' and sender_id is null), 'submission snapshots revision and trusted recipient');

set local role anon;
select extensions.is((select count(*) from public.enquiries), 0::bigint, 'anonymous still cannot read submitted buyer details');
select extensions.throws_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000001','Buyer Name','buyer@example.test','', 'Please arrange a second viewing.')$$, '23505', 'SAT12_ENQUIRY_DUPLICATE', 'duplicate submission is rejected');
select extensions.throws_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000002','Buyer Name','draft@example.test','', 'This draft must not accept a lead.')$$, 'P0002', 'SAT12_ENQUIRY_PROPERTY_UNAVAILABLE', 'draft property is rejected');
select extensions.throws_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000003','Buyer Name','submitted@example.test','', 'This submission must not accept a lead.')$$, 'P0002', 'SAT12_ENQUIRY_PROPERTY_UNAVAILABLE', 'submitted property is rejected');
select extensions.throws_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000004','Buyer Name','rejected@example.test','', 'This rejected listing must not accept a lead.')$$, 'P0002', 'SAT12_ENQUIRY_PROPERTY_UNAVAILABLE', 'rejected property is rejected');
select extensions.throws_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000005','Buyer Name','archived@example.test','', 'This archived listing must not accept a lead.')$$, 'P0002', 'SAT12_ENQUIRY_PROPERTY_UNAVAILABLE', 'archived property is rejected');
select extensions.throws_ok($$select public.submit_property_enquiry('52999999-0000-4000-8000-000000000099','Buyer Name','unknown@example.test','', 'This unknown listing must not accept a lead.')$$, 'P0002', 'SAT12_ENQUIRY_PROPERTY_UNAVAILABLE', 'unknown property is rejected');
select extensions.throws_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000001','Buyer Name','malformed@example.test','not-a-phone!', 'This malformed phone must be rejected.')$$, '22023', 'SAT12_ENQUIRY_INVALID', 'malformed submission is rejected by the database');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.lives_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000001','Signed-in Buyer','signed-in@example.test','', 'Please share the available viewing times.')$$, 'authenticated sender submits through the RPC');
select extensions.is((select count(*) from public.enquiries where sender_id='51000000-0000-4000-8000-000000000003'), 1::bigint, 'sender reads own enquiry');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries where sender_id is null), 0::bigint, 'unrelated user cannot read enquiries');
select extensions.throws_ok($$select public.update_enquiry_status((select id from public.enquiries where sender_id is null limit 1), 'contacted')$$, '42501', 'SAT12_ENQUIRY_FORBIDDEN', 'unrelated user cannot change status');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 2::bigint, 'snapshotted recipient reads own enquiries');
select extensions.lives_ok($$select public.update_enquiry_status((select id from public.enquiries where sender_id is null limit 1), 'contacted')$$, 'recipient changes allowed status');
select extensions.throws_ok($$update public.enquiries set email='changed@example.test'$$, '42501', null, 'recipient cannot update buyer fields directly');
select extensions.throws_ok($$update public.enquiries set recipient_id='51000000-0000-4000-8000-000000000002'$$, '42501', null, 'recipient cannot change snapshotted recipient');
select extensions.throws_ok($$update public.enquiries set property_id='52000000-0000-4000-8000-000000000002'$$, '42501', null, 'recipient cannot change stable property');
select extensions.throws_ok($$update public.enquiries set property_revision_id_at_submission='53000000-0000-4000-8000-000000000002'$$, '42501', null, 'recipient cannot change published revision snapshot');
select extensions.throws_ok($$delete from public.enquiries$$, '42501', null, 'recipient cannot delete enquiries directly');
reset role;

update public.properties set owner_id='51000000-0000-4000-8000-000000000002' where id='52000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 0::bigint, 'new property owner cannot read historic enquiry');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 2::bigint, 'original recipient retains historic enquiries after transfer');
reset role;

update public.properties set archived_at=now() where id='52000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 2::bigint, 'original recipient retains historic enquiries after property archival');
reset role;
update public.properties set published_revision_id=null where id='52000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 2::bigint, 'original recipient retains historic enquiries after unpublishing');
reset role;

update public.profiles set role='user' where id='51000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 0::bigint, 'downgraded recipient cannot read historic buyer details');
select extensions.throws_ok($$select public.update_enquiry_status((select id from public.enquiries where sender_id is null limit 1), 'closed')$$, '42501', 'SAT12_ENQUIRY_FORBIDDEN', 'downgraded recipient cannot change enquiry status');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000004","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 0::bigint, 'AAL1 admin cannot read enquiries');
select extensions.throws_ok($$select public.update_enquiry_status((select id from public.enquiries limit 1), 'closed')$$, '42501', 'SAT12_ENQUIRY_FORBIDDEN', 'AAL1 admin cannot change enquiry status');
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 2::bigint, 'AAL2 admin reads enquiries');
select extensions.lives_ok($$select public.update_enquiry_status((select id from public.enquiries limit 1), 'closed')$$, 'AAL2 admin changes enquiry status');
select extensions.throws_ok($$select public.update_enquiry_status((select id from public.enquiries limit 1), 'spam')$$, '22023', 'SAT12_ENQUIRY_STATUS_INVALID', 'unsupported owner-facing status is rejected');
reset role;

insert into public.enquiries (property_id, property_revision_id_at_submission, recipient_id, name, email, message, created_at)
values
  ('52000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','Rate Test','rate@example.test','Existing rate-limit fixture one.',statement_timestamp()),
  ('52000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000001','Rate Test','rate@example.test','Existing rate-limit fixture two.',statement_timestamp()),
  ('52000000-0000-4000-8000-000000000004','53000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000001','Rate Test','rate@example.test','Existing rate-limit fixture three.',statement_timestamp());
update public.properties set archived_at=null, published_revision_id='53000000-0000-4000-8000-000000000001' where id='52000000-0000-4000-8000-000000000001';
set local role anon;
select extensions.throws_ok($$select public.submit_property_enquiry('52000000-0000-4000-8000-000000000001','Rate Test','rate@example.test','', 'The fourth hourly submission must fail.')$$, '54000', 'SAT12_ENQUIRY_RATE_LIMITED', 'global per-email hourly submission limit is enforced');
reset role;

select * from extensions.finish();
