select extensions.plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('21000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('21000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('21000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), '{}', '{}', now(), now()),
  ('21000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('21000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unconfirmed@example.test', '', null, '{}', '{}', now(), now());
update public.profiles set role = 'owner_agent' where id in ('21000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.bootstrap_first_admin('21000000-0000-4000-8000-000000000004', 'initial administrator')$$,
  '42501', null, 'ordinary caller cannot bootstrap admin'
);
reset role;

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select extensions.throws_ok(
  $$select public.bootstrap_first_admin('21000000-0000-4000-8000-000000000005', 'unconfirmed administrator')$$,
  'P0002', 'SAT12_CONFIRMED_USER_REQUIRED', 'unconfirmed user cannot become first admin'
);
select extensions.lives_ok(
  $$select public.bootstrap_first_admin('21000000-0000-4000-8000-000000000004', 'initial administrator')$$,
  'first admin bootstrap succeeds once'
);
select extensions.throws_ok(
  $$select public.bootstrap_first_admin('21000000-0000-4000-8000-000000000001', 'second administrator')$$,
  'P0001', 'SAT12_ADMIN_ALREADY_EXISTS', 'second admin bootstrap is refused'
);
reset role;

insert into public.properties (id, owner_id, slug)
values ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002', 'rls-owner-a-draft');
insert into public.property_revisions (id, property_id, revision_number, title, description, listing_intent, property_type, price_inr, locality, latitude, longitude, bedrooms, bathrooms, area_sq_ft, construction_status, created_by)
values ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 1, 'Owner A Draft', 'Private draft listing', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', '21000000-0000-4000-8000-000000000002');

set local role anon;
select extensions.is((select count(*) from public.property_revisions), 0::bigint, 'anonymous cannot read a draft');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.create_draft_listing('{"slug":"forbidden-user-listing"}'::jsonb)$$,
  '42501', 'SAT12_OWNER_REQUIRED', 'user cannot create a listing'
);
select extensions.throws_ok(
  $$update public.profiles set role = 'admin' where id = '21000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'user cannot change own role'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.property_revisions), 0::bigint, 'owner b cannot read owner a draft');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$update public.property_revisions set status = 'published' where id = '23000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot change revision status'
);
select extensions.throws_ok(
  $$update public.property_revisions set badge = 'featured' where id = '23000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot set listing badge'
);
select extensions.throws_ok(
  $$update public.properties set published_revision_id = '23000000-0000-4000-8000-000000000001' where id = '22000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot change published pointer'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000004","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.set_user_role('21000000-0000-4000-8000-000000000001', 'owner_agent', 'approve owner request')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot change roles'
);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}', true);
select extensions.lives_ok(
  $$select public.set_user_role('21000000-0000-4000-8000-000000000001', 'owner_agent', 'approve owner request')$$,
  'aal2 admin can approve owner role'
);
reset role;

select * from extensions.finish();
