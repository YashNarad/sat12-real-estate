select extensions.plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('71000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderation-user@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderation-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderation-admin@example.test', '', now(), '{}', '{}', now(), now());

update public.profiles set role = 'owner_agent' where id = '71000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin' where id = '71000000-0000-4000-8000-000000000003';

insert into public.properties (id, owner_id, slug)
values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'moderation-approved'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'moderation-draft'),
  ('72000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000002', 'moderation-stale');

insert into public.property_revisions (
  id, property_id, revision_number, title, description, listing_intent,
  property_type, price_inr, locality, latitude, longitude, bedrooms,
  bathrooms, area_sq_ft, construction_status, status, created_by
) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 1, 'Approved Home', 'Approved moderation fixture', 'buy', 'apartment', 8000000, 'Dharampeth', 21.14, 79.05, 3, 2, 1400, 'ready_to_move', 'approved', '71000000-0000-4000-8000-000000000002'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', 1, 'Draft Home', 'Draft moderation fixture', 'buy', 'villa', 9000000, 'Besa', 21.09, 79.11, 3, 3, 1900, 'under_construction', 'draft', '71000000-0000-4000-8000-000000000002'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000003', 1, 'Stale Home', 'Stale moderation fixture', 'buy', 'apartment', 7000000, 'Civil Lines', 21.15, 79.08, 2, 2, 1200, 'ready_to_move', 'published', '71000000-0000-4000-8000-000000000002');

set local role anon;
select extensions.throws_ok(
  $$select public.set_listing_badge('73000000-0000-4000-8000-000000000001', 'featured', 'feature reviewed listing')$$,
  '42501', null, 'anonymous cannot set a badge'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.set_listing_badge('73000000-0000-4000-8000-000000000001', 'featured', 'feature reviewed listing')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'non-admin cannot set a badge'
);
select extensions.throws_ok(
  $$select public.set_user_role('71000000-0000-4000-8000-000000000002', 'owner_agent', 'approve owner')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'non-admin cannot change roles'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.set_listing_badge('73000000-0000-4000-8000-000000000001', 'featured', 'feature reviewed listing')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot set a badge'
);
select extensions.throws_ok(
  $$select public.set_user_role('71000000-0000-4000-8000-000000000001', 'owner_agent', 'approve owner')$$,
  '42501', 'SAT12_AAL2_ADMIN_REQUIRED', 'aal1 admin cannot change roles'
);

select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.set_listing_badge('73999999-0000-4000-8000-000000000999', 'featured', 'feature reviewed listing')$$,
  'P0002', 'SAT12_REVISION_NOT_FOUND', 'missing revision is rejected'
);
select extensions.throws_ok(
  $$select public.set_listing_badge('73000000-0000-4000-8000-000000000001', 'premium', 'feature reviewed listing')$$,
  '23514', 'SAT12_BADGE_INVALID', 'invalid badge is rejected'
);
select extensions.throws_ok(
  $$select public.set_listing_badge('73000000-0000-4000-8000-000000000002', 'new', 'mark new listing')$$,
  'P0001', 'SAT12_BADGE_STATE_INVALID', 'draft revision badge is rejected'
);
select extensions.throws_ok(
  $$select public.set_listing_badge('73000000-0000-4000-8000-000000000003', 'featured', 'feature current listing')$$,
  'P0001', 'SAT12_STALE_REVISION_STATE', 'stale published revision badge is rejected'
);
select extensions.lives_ok(
  $$select public.set_listing_badge('73000000-0000-4000-8000-000000000001', 'featured', 'feature reviewed listing')$$,
  'aal2 admin sets an approved revision badge'
);
select extensions.is(
  (select badge from public.property_revisions where id = '73000000-0000-4000-8000-000000000001'),
  'featured', 'successful badge change updates the revision'
);
select extensions.is(
  (select count(*) from public.listing_badge_audit_log where revision_id = '73000000-0000-4000-8000-000000000001' and previous_badge is null and new_badge = 'featured'),
  1::bigint, 'badge change is recorded'
);
select extensions.throws_ok(
  $$update public.listing_badge_audit_log set reason = 'tampered' where revision_id = '73000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'badge audit rows are immutable'
);
select extensions.is(
  has_column_privilege('authenticated', 'public.property_revisions', 'badge', 'UPDATE'),
  false, 'authenticated users have no direct badge update privilege'
);

select extensions.throws_ok(
  $$select public.set_user_role('71000000-0000-4000-8000-000000000003', 'user', 'remove own admin access')$$,
  '42501', 'SAT12_SELF_ROLE_CHANGE_FORBIDDEN', 'admin cannot change own role'
);
select extensions.is(
  (select count(*) from public.role_audit_log where target_profile_id = '71000000-0000-4000-8000-000000000003'),
  0::bigint, 'self-role denial uses the stable error'
);
select extensions.lives_ok(
  $$select public.set_user_role('71000000-0000-4000-8000-000000000001', 'owner_agent', 'approve owner request')$$,
  'aal2 admin changes another user role'
);
select extensions.is(
  (select count(*) from public.role_audit_log where target_profile_id = '71000000-0000-4000-8000-000000000001' and previous_role = 'user' and new_role = 'owner_agent'),
  1::bigint, 'authorized role change is audited'
);
reset role;

select * from extensions.finish();
