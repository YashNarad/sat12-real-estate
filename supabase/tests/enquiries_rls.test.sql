select extensions.plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('31000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sender@example.test', '', now(), '{}', '{}', now(), now()),
  ('31000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('31000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unrelated@example.test', '', now(), '{}', '{}', now(), now()),
  ('31000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'enquiry-admin@example.test', '', now(), '{}', '{}', now(), now());
update public.profiles set role = 'owner_agent' where id = '31000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin' where id = '31000000-0000-4000-8000-000000000004';
insert into public.properties (id, owner_id, slug)
values ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 'enquiry-published-property');
insert into public.property_revisions (id, property_id, revision_number, title, description, listing_intent, property_type, price_inr, locality, latitude, longitude, bedrooms, bathrooms, area_sq_ft, construction_status, status, published_at, created_by)
values ('33000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 1, 'Published Home', 'Published home for enquiry tests', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'published', now(), '31000000-0000-4000-8000-000000000002');
update public.properties set published_revision_id = '33000000-0000-4000-8000-000000000001' where id = '32000000-0000-4000-8000-000000000001';
insert into public.enquiries (id, property_id, property_revision_id_at_submission, sender_id, name, email, message)
values ('34000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Test Sender', 'sender@example.test', 'Please contact me about this home.');

set local role anon;
select extensions.throws_ok(
  $$insert into public.enquiries (property_id, property_revision_id_at_submission, sender_id, name, email, message) values ('32000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Anon User', 'anon@example.test', 'Anonymous enquiry is forbidden.')$$,
  '42501', null, 'anonymous cannot create enquiries'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.lives_ok(
  $$insert into public.enquiries (property_id, property_revision_id_at_submission, sender_id, name, email, message) values ('32000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Test Sender', 'sender@example.test', 'I would like another property viewing.')$$,
  'authenticated user creates an enquiry'
);
select extensions.is((select count(*) from public.enquiries), 2::bigint, 'sender reads own enquiry');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 0::bigint, 'unrelated user cannot read enquiry');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}', true);
select extensions.is((select count(*) from public.enquiries), 2::bigint, 'aal2 admin reads enquiries');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}', true);
select extensions.lives_ok(
  $$update public.enquiries set status = 'contacted' where id = '34000000-0000-4000-8000-000000000001'$$,
  'owner changes enquiry status'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$update public.enquiries set message = 'Attempted replacement message' where id = '34000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'message fields remain immutable'
);
reset role;

select * from extensions.finish();
