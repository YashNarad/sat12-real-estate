select extensions.plan(34);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'image-owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'image-owner-b@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'image-admin@example.test', '', now(), '{}', '{}', now(), now());
update public.profiles set role = 'owner_agent' where id in (
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000002'
);
update public.profiles set role = 'admin' where id = '41000000-0000-4000-8000-000000000003';

insert into public.properties (id, owner_id, slug) values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'storage-owner-a-draft'),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'storage-owner-a-submitted'),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000001', 'storage-owner-a-published'),
  ('42000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000002', 'storage-owner-b-draft'),
  ('42000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000001', 'storage-owner-a-rejected'),
  ('42000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000001', 'storage-owner-a-superseded'),
  ('42000000-0000-4000-8000-000000000007', '41000000-0000-4000-8000-000000000001', 'storage-owner-a-archived');

insert into public.property_revisions (
  id, property_id, revision_number, title, description, listing_intent,
  property_type, price_inr, locality, latitude, longitude, bedrooms,
  bathrooms, area_sq_ft, construction_status, status, created_by
) values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 1, 'Owner A Draft', 'Private draft image listing', 'buy', 'apartment', 5000000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'draft', '41000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 1, 'Owner A Submitted', 'Submitted image listing', 'buy', 'apartment', 6000000, 'Ramdaspeth', 21.13, 79.07, 2, 2, 1100, 'ready_to_move', 'submitted', '41000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000003', 1, 'Owner A Published', 'Published image listing', 'buy', 'villa', 9000000, 'Civil Lines', 21.15, 79.08, 3, 3, 1800, 'ready_to_move', 'published', '41000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000004', 1, 'Owner B Draft', 'Owner B private listing', 'buy', 'apartment', 4500000, 'Manish Nagar', 21.10, 79.09, 2, 2, 900, 'ready_to_move', 'draft', '41000000-0000-4000-8000-000000000002'),
  ('43000000-0000-4000-8000-000000000005', '42000000-0000-4000-8000-000000000005', 1, 'Owner A Rejected', 'Rejected image listing', 'buy', 'apartment', 5500000, 'Dharampeth', 21.14, 79.05, 2, 2, 1000, 'ready_to_move', 'rejected', '41000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000006', '42000000-0000-4000-8000-000000000006', 1, 'Owner A Superseded', 'Superseded image listing', 'buy', 'apartment', 6500000, 'Ramdaspeth', 21.13, 79.07, 2, 2, 1100, 'ready_to_move', 'superseded', '41000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000007', '42000000-0000-4000-8000-000000000007', 1, 'Owner A Archived', 'Archived published image listing', 'buy', 'villa', 9500000, 'Civil Lines', 21.15, 79.08, 3, 3, 1800, 'ready_to_move', 'published', '41000000-0000-4000-8000-000000000001');
update public.properties
set published_revision_id = '43000000-0000-4000-8000-000000000003'
where id = '42000000-0000-4000-8000-000000000003';
update public.properties
set published_revision_id = '43000000-0000-4000-8000-000000000007', archived_at = now()
where id = '42000000-0000-4000-8000-000000000007';

insert into storage.buckets (id, name, public) values ('other-images', 'other-images', false);
insert into storage.objects (id, bucket_id, name, owner_id, metadata) values
  ('44000000-0000-4000-8000-000000000001', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000001.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000002', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000002/43000000-0000-4000-8000-000000000002/44000000-0000-4000-8000-000000000002.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000003', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000003/43000000-0000-4000-8000-000000000003/44000000-0000-4000-8000-000000000003.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000004', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000004.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000005', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000005/43000000-0000-4000-8000-000000000005/44000000-0000-4000-8000-000000000005.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000006', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000006/43000000-0000-4000-8000-000000000006/44000000-0000-4000-8000-000000000006.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000007', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000007/43000000-0000-4000-8000-000000000007/44000000-0000-4000-8000-000000000007.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000015', 'property-images', '41000000-0000-4000-8000-000000000002/42000000-0000-4000-8000-000000000004/43000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000015.webp', '41000000-0000-4000-8000-000000000002', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000016', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000002/43000000-0000-4000-8000-000000000002/44000000-0000-4000-8000-000000000016.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000017', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000003/43000000-0000-4000-8000-000000000003/44000000-0000-4000-8000-000000000017.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000018', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000018.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000020', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000020.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}'),
  ('44000000-0000-4000-8000-000000000021', 'property-images', '41000000-0000-4000-8000-000000000002/42000000-0000-4000-8000-000000000004/43000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000021.webp', '41000000-0000-4000-8000-000000000002', '{"mimetype":"image/webp","size":400000}');
insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values
  ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000001.webp', 'Draft living room', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000003', '43000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000003/43000000-0000-4000-8000-000000000003/44000000-0000-4000-8000-000000000003.webp', 'Published living room', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000004', '43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000004.webp', 'Held draft bedroom', 1, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000005', '43000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000005/43000000-0000-4000-8000-000000000005/44000000-0000-4000-8000-000000000005.webp', 'Rejected living room', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000006', '43000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000006/43000000-0000-4000-8000-000000000006/44000000-0000-4000-8000-000000000006.webp', 'Superseded living room', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000007', '43000000-0000-4000-8000-000000000007', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000007/43000000-0000-4000-8000-000000000007/44000000-0000-4000-8000-000000000007.webp', 'Archived living room', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000021', '43000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000002/42000000-0000-4000-8000-000000000004/43000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000021.webp', 'Owner B metadata-backed draft', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000002');
insert into public.legal_holds (entity_kind, entity_id, reason, created_by)
values
  ('image', '44000000-0000-4000-8000-000000000004', 'Preserve disputed image', '41000000-0000-4000-8000-000000000003'),
  ('image', '44000000-0000-4000-8000-000000000020', 'Preserve orphaned disputed image', '41000000-0000-4000-8000-000000000003');

select extensions.ok(
  exists (select 1 from storage.objects where id = '44000000-0000-4000-8000-000000000021')
    and exists (select 1 from public.property_images where id = '44000000-0000-4000-8000-000000000021'),
  'metadata-backed cross-owner fixture exists'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select extensions.results_eq(
  $$select id from public.property_images order by id$$,
  $$values ('44000000-0000-4000-8000-000000000003'::uuid)$$,
  'anonymous reads only current published image metadata'
);
select extensions.is(
  has_schema_privilege('anon', 'private', 'usage'),
  false,
  'anonymous retains no private schema access'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.is(
  (select count(*) from public.property_images where id = '44000000-0000-4000-8000-000000000001'),
  1::bigint,
  'owner reads own draft image metadata'
);
select extensions.is(
  (select count(*) from public.property_images where id = '44000000-0000-4000-8000-000000000021'),
  0::bigint,
  'owner cannot read cross-property image metadata'
);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.is(
  (select count(*) from public.property_images where id = '44000000-0000-4000-8000-000000000001'),
  0::bigint,
  'aal1 admin cannot read private image metadata'
);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}', true);
select extensions.is(
  (select count(*) from public.property_images where id = '44000000-0000-4000-8000-000000000001'),
  1::bigint,
  'aal2 admin reads private image metadata'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.lives_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id, metadata) values ('44000000-0000-4000-8000-000000000010', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000010.webp', '41000000-0000-4000-8000-000000000001', '{"mimetype":"image/webp","size":400000}')$$,
  'owner uploads to exact revision prefix'
);
select extensions.lives_ok(
  $$insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values ('44000000-0000-4000-8000-000000000010', '43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000010.webp', 'Owner uploaded kitchen', 2, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001')$$,
  'owner records metadata with matching pre-generated image id'
);
select extensions.ok(
  exists (select 1 from storage.objects where id = '44000000-0000-4000-8000-000000000010'),
  'metadata-backed owner read remains independent of orphan policy'
);
select extensions.is(
  (select count(*) from storage.objects where id = '44000000-0000-4000-8000-000000000021'),
  0::bigint,
  'metadata-backed cross-owner image remains private'
);
select extensions.throws_ok(
  $$insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values ('44000000-0000-4000-8000-000000000015', '43000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000002/42000000-0000-4000-8000-000000000004/43000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000015.webp', 'Other owner bedroom', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'cross-owner image metadata insert is denied'
);
select extensions.throws_ok(
  $$insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values ('44000000-0000-4000-8000-000000000016', '43000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000002/43000000-0000-4000-8000-000000000002/44000000-0000-4000-8000-000000000016.webp', 'Submitted revision bedroom', 0, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'submitted revision image metadata insert is denied'
);
select extensions.throws_ok(
  $$insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values ('44000000-0000-4000-8000-000000000017', '43000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000003/43000000-0000-4000-8000-000000000003/44000000-0000-4000-8000-000000000017.webp', 'Published revision bedroom', 1, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'published revision image metadata insert is denied'
);
select extensions.throws_ok(
  $$insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values ('44000000-0000-4000-8000-000000000019', '43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000018.webp', 'Mismatched image identity', 3, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001')$$,
  '23514', 'SAT12_IMAGE_PATH_MISMATCH', 'path and row image ids must match'
);
select extensions.throws_ok(
  $$update public.properties set owner_id = '41000000-0000-4000-8000-000000000002' where id = '42000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot change property ownership'
);
select extensions.throws_ok(
  $$update public.property_revisions set status = 'published' where id = '43000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot change revision status through metadata privileges'
);
select extensions.throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id, metadata) values ('44000000-0000-4000-8000-000000000011', 'property-images', '41000000-0000-4000-8000-000000000002/42000000-0000-4000-8000-000000000004/43000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000011.webp', '41000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'cross-owner upload is denied'
);
select extensions.throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id, metadata) values ('44000000-0000-4000-8000-000000000012', 'property-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000002/44000000-0000-4000-8000-000000000012.webp', '41000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'cross-revision upload is denied'
);
select extensions.throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id, metadata) values ('44000000-0000-4000-8000-000000000013', 'property-images', '../42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000013.webp', '41000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'path traversal is denied'
);
select extensions.throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id, metadata) values ('44000000-0000-4000-8000-000000000014', 'other-images', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000014.webp', '41000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'unsupported bucket is denied'
);
select extensions.lives_ok(
  $$delete from public.property_images where id = '44000000-0000-4000-8000-000000000001'$$,
  'owner deletes editable image metadata'
);
select extensions.results_eq(
  $mutation$with deleted as (
    delete from public.property_images where id = '44000000-0000-4000-8000-000000000004' returning 1
  ) select count(*) from deleted$mutation$,
  $expected$values (0::bigint)$expected$,
  'legally held metadata deletion is denied'
);
select extensions.lives_ok(
  $$delete from public.property_images where id = '44000000-0000-4000-8000-000000000010'$$,
  'owner removes editable metadata to create an orphan'
);
select extensions.ok(
  exists (select 1 from storage.objects where id = '44000000-0000-4000-8000-000000000010'),
  'owner selects a deletable orphan image'
);
select extensions.is(
  (select count(*) from storage.objects where id = '44000000-0000-4000-8000-000000000015'),
  0::bigint,
  'cross-owner orphan image remains private'
);
select extensions.is(
  (select count(*) from storage.objects where id = '44000000-0000-4000-8000-000000000016'),
  0::bigint,
  'submitted orphan image remains private'
);
select extensions.is(
  (select count(*) from storage.objects where id = '44000000-0000-4000-8000-000000000017'),
  0::bigint,
  'published orphan image remains private'
);
select extensions.is(
  (select count(*) from storage.objects where id = '44000000-0000-4000-8000-000000000020'),
  0::bigint,
  'legally held orphan image remains private'
);
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select extensions.results_eq(
  $$select id from storage.objects where bucket_id = 'property-images' order by id$$,
  $$values ('44000000-0000-4000-8000-000000000003'::uuid)$$,
  'anonymous reads only current published image'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.ok(
  exists (select 1 from storage.objects where id = '44000000-0000-4000-8000-000000000004'),
  'owner reads own revision image'
);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.is(
  (select count(*) from storage.objects where id = '44000000-0000-4000-8000-000000000004'),
  0::bigint,
  'aal1 admin cannot read private image'
);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}', true);
select extensions.is(
  (select count(*) from storage.objects where id = '44000000-0000-4000-8000-000000000004'),
  1::bigint,
  'aal2 admin reads private image'
);
reset role;

select extensions.throws_ok(
  $$insert into public.property_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by) values ('44000000-0000-4000-8000-000000000099', '43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000099.webp', 'Missing object image', 9, 1200, 800, 400000, 'image/webp', 'owner_uploaded', '41000000-0000-4000-8000-000000000001')$$,
  '23514', 'SAT12_IMAGE_OBJECT_MISSING', 'metadata cannot reference a nonexistent object'
);

select * from extensions.finish();
