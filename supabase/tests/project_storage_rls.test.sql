select extensions.plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'storage-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'storage-other@example.test', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'storage-admin@example.test', '', now(), '{}', '{}', now(), now());
update public.profiles set role = 'owner_agent' where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002');
update public.profiles set role = 'admin' where id = '91000000-0000-4000-8000-000000000003';

insert into public.projects (id, owner_id, slug) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'storage-published'),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'storage-draft'),
  ('92000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', 'storage-archived');
insert into public.project_revisions (
  id, project_id, revision_number, name, builder_name, description, construction_status,
  locality_text, city, state, status, created_by, published_at
) values
  ('92100000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 1,
   'Published Storage Project', 'Builder', 'Published storage fixture for exact image authorization.',
   'ready_to_move', 'Dharampeth', 'Nagpur', 'Maharashtra', 'published', '91000000-0000-4000-8000-000000000001', now()),
  ('92100000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 1,
   'Draft Storage Project', 'Builder', 'Editable draft storage fixture for the owner.',
   'ready_to_move', 'Dharampeth', 'Nagpur', 'Maharashtra', 'draft', '91000000-0000-4000-8000-000000000001', null),
  ('92100000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003', 1,
   'Archived Storage Project', 'Builder', 'Archived storage fixture that is not public.',
   'ready_to_move', 'Dharampeth', 'Nagpur', 'Maharashtra', 'published', '91000000-0000-4000-8000-000000000001', now());
update public.projects set published_revision_id = '92100000-0000-4000-8000-000000000001'
where id = '92000000-0000-4000-8000-000000000001';
update public.projects set published_revision_id = '92100000-0000-4000-8000-000000000003', archived_at = now()
where id = '92000000-0000-4000-8000-000000000003';

insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('project-images', '91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000001/92100000-0000-4000-8000-000000000001/92200000-0000-4000-8000-000000000001.jpg', '91000000-0000-4000-8000-000000000001', '{"mimetype":"image/jpeg","size":"1000"}'),
  ('project-images', '91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000002/92100000-0000-4000-8000-000000000002/92200000-0000-4000-8000-000000000002.jpg', '91000000-0000-4000-8000-000000000001', '{"mimetype":"image/jpeg","size":"1000"}'),
  ('project-images', '91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000003/92100000-0000-4000-8000-000000000003/92200000-0000-4000-8000-000000000003.jpg', '91000000-0000-4000-8000-000000000001', '{"mimetype":"image/jpeg","size":"1000"}');
insert into public.project_images (id, revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, created_by) values
  ('92200000-0000-4000-8000-000000000001', '92100000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000001/92100000-0000-4000-8000-000000000001/92200000-0000-4000-8000-000000000001.jpg', 'Published project image', 0, 800, 600, 1000, 'image/jpeg', '91000000-0000-4000-8000-000000000001'),
  ('92200000-0000-4000-8000-000000000002', '92100000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000002/92100000-0000-4000-8000-000000000002/92200000-0000-4000-8000-000000000002.jpg', 'Draft project image', 0, 800, 600, 1000, 'image/jpeg', '91000000-0000-4000-8000-000000000001'),
  ('92200000-0000-4000-8000-000000000003', '92100000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000003/92100000-0000-4000-8000-000000000003/92200000-0000-4000-8000-000000000003.jpg', 'Archived project image', 0, 800, 600, 1000, 'image/jpeg', '91000000-0000-4000-8000-000000000001');

select extensions.is((select public from storage.buckets where id = 'project-images'), false, 'project image bucket remains private');
select extensions.is((select file_size_limit from storage.buckets where id = 'project-images'), 5242880::bigint, 'project image bucket retains the five MiB limit');
select extensions.is((select count(*) from private.parse_project_image_path('91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000001/92100000-0000-4000-8000-000000000001/92200000-0000-4000-8000-000000000001.jpg')), 1::bigint, 'project image paths bind every identifier');
select extensions.is((select count(*) from private.parse_project_image_path('bad/path.jpg')), 0::bigint, 'malformed project image paths are rejected');

set local role anon;
select extensions.is((select count(*) from public.project_images), 1::bigint, 'anonymous sees only current published image metadata');
select extensions.is((select count(*) from storage.objects where bucket_id = 'project-images'), 1::bigint, 'anonymous reads only the exact published project image');
select extensions.is((select count(*) from public.project_images where id = '92200000-0000-4000-8000-000000000003'), 0::bigint, 'archived project images are not public');
select extensions.throws_ok($$insert into storage.objects (bucket_id, name) values ('project-images', 'fake/path.jpg')$$, '42501', null, 'anonymous cannot upload project images');
select extensions.throws_ok($$delete from storage.objects where bucket_id = 'project-images'$$, '42501', null, 'anonymous cannot delete project images');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.project_images where revision_id = '92100000-0000-4000-8000-000000000002'), 0::bigint, 'cross-owner draft image metadata is private');
select extensions.throws_ok($$delete from public.project_images where id = '92200000-0000-4000-8000-000000000002'$$, '42501', null, 'cross-owner image deletion is denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.project_images where revision_id = '92100000-0000-4000-8000-000000000002'), 1::bigint, 'owner reads own draft image metadata');
select extensions.is((select count(*) from storage.objects where name like '%92200000-0000-4000-8000-000000000002.jpg'), 1::bigint, 'owner reads own draft object');
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('project-images', '91000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000002/92100000-0000-4000-8000-000000000002/92200000-0000-4000-8000-000000000099.exe', '91000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'invalid extensions cannot be uploaded'
);
select extensions.throws_ok(
  $$update public.project_images set storage_path = 'tampered' where id = '92200000-0000-4000-8000-000000000002'$$,
  '42501', null, 'owners cannot rewrite immutable image paths'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}', true);
select extensions.is((select count(*) from public.project_images where revision_id = '92100000-0000-4000-8000-000000000002'), 0::bigint, 'aal1 admin cannot read private image metadata');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}', true);
select extensions.is((select count(*) from public.project_images), 3::bigint, 'aal2 admin reads project image metadata');
select extensions.is((select count(*) from storage.objects where bucket_id = 'project-images'), 3::bigint, 'aal2 admin reads project image objects');
reset role;

select * from extensions.finish();
