insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);

create function private.parse_property_image_path(p_name text)
returns table (
  owner_id uuid,
  property_id uuid,
  revision_id uuid,
  image_id uuid,
  extension text
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[];
  v_file_match text[];
begin
  v_parts := string_to_array(p_name, '/');
  if array_length(v_parts, 1) <> 4
    or v_parts[1] = '' or v_parts[2] = '' or v_parts[3] = '' or v_parts[4] = ''
  then
    return;
  end if;
  v_file_match := regexp_match(
    v_parts[4],
    '^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|jpeg|png|webp)$',
    'i'
  );
  if v_file_match is null then
    return;
  end if;
  begin
    return query select
      v_parts[1]::uuid,
      v_parts[2]::uuid,
      v_parts[3]::uuid,
      v_file_match[1]::uuid,
      lower(v_file_match[2]);
  exception when invalid_text_representation then
    return;
  end;
end;
$$;

create function private.can_insert_property_image_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_path record;
begin
  select * into v_path from private.parse_property_image_path(p_name);
  if not found or v_path.owner_id <> (select auth.uid()) or not private.is_owner_agent() then
    return false;
  end if;
  return exists (
    select 1
    from public.properties p
    join public.property_revisions r on r.property_id = p.id
    where p.id = v_path.property_id
      and p.owner_id = v_path.owner_id
      and r.id = v_path.revision_id
      and r.status in ('draft', 'rejected')
      and not exists (
        select 1 from public.legal_holds h
        where h.released_at is null
          and (
            (h.entity_kind = 'property' and h.entity_id = p.id)
            or (h.entity_kind = 'revision' and h.entity_id = r.id)
            or (h.entity_kind = 'image' and h.entity_id = v_path.image_id)
          )
      )
  );
end;
$$;

create function private.can_read_property_image_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_path record;
begin
  select * into v_path from private.parse_property_image_path(p_name);
  if not found then return false; end if;
  return exists (
    select 1
    from public.property_images i
    join public.property_revisions r on r.id = i.revision_id
    join public.properties p on p.id = r.property_id
    where i.id = v_path.image_id
      and i.storage_path = p_name
      and i.revision_id = v_path.revision_id
      and p.id = v_path.property_id
      and p.owner_id = v_path.owner_id
      and (
        (
          p.archived_at is null
          and p.published_revision_id = r.id
          and r.status = 'published'
        )
        or p.owner_id = (select auth.uid())
        or private.is_aal2_admin()
      )
  );
end;
$$;

create function private.can_delete_property_image_metadata(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_path record;
begin
  select * into v_path from private.parse_property_image_path(p_name);
  if not found or v_path.owner_id <> (select auth.uid()) or not private.is_owner_agent() then
    return false;
  end if;
  return exists (
    select 1
    from public.properties p
    join public.property_revisions r on r.property_id = p.id
    where p.id = v_path.property_id
      and p.owner_id = v_path.owner_id
      and r.id = v_path.revision_id
      and r.status in ('draft', 'rejected')
      and not exists (
        select 1 from public.legal_holds h
        where h.released_at is null
          and h.entity_kind in ('property', 'revision', 'image')
          and h.entity_id = case h.entity_kind
            when 'property' then p.id
            when 'revision' then r.id
            when 'image' then v_path.image_id
          end
      )
  );
end;
$$;

create function private.can_delete_property_image_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_delete_property_image_metadata(p_name)
    and not exists (
      select 1 from public.property_images i where i.storage_path = p_name
    );
$$;

revoke all on function private.parse_property_image_path(text) from public;
revoke all on function private.can_insert_property_image_object(text) from public;
revoke all on function private.can_read_property_image_object(text) from public;
revoke all on function private.can_delete_property_image_metadata(text) from public;
revoke all on function private.can_delete_property_image_object(text) from public;
grant execute on function private.can_insert_property_image_object(text) to authenticated;
grant execute on function private.can_read_property_image_object(text) to anon, authenticated;
grant execute on function private.can_delete_property_image_metadata(text) to authenticated;
grant execute on function private.can_delete_property_image_object(text) to authenticated;

create policy "owners upload editable property images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-images'
  and private.can_insert_property_image_object(name)
);

create policy "permitted users read property images"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'property-images'
  and private.can_read_property_image_object(name)
);

create policy "owners delete editable property images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'property-images'
  and private.can_delete_property_image_object(name)
);

create function private.validate_property_image_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_property_id uuid;
  v_expected_extensions text[];
  v_path record;
begin
  select p.owner_id, p.id into v_owner_id, v_property_id
  from public.property_revisions r
  join public.properties p on p.id = r.property_id
  where r.id = new.revision_id;
  if not found then
    raise exception using errcode = '23503', message = 'SAT12_IMAGE_REVISION_MISSING';
  end if;

  select * into v_path from private.parse_property_image_path(new.storage_path);
  if not found
    or v_path.owner_id <> v_owner_id
    or v_path.property_id <> v_property_id
    or v_path.revision_id <> new.revision_id
    or v_path.image_id <> new.id
  then
    raise exception using errcode = '23514', message = 'SAT12_IMAGE_PATH_MISMATCH';
  end if;

  v_expected_extensions := case new.mime_type
    when 'image/jpeg' then array['jpg', 'jpeg']::text[]
    when 'image/png' then array['png']::text[]
    when 'image/webp' then array['webp']::text[]
    else array[]::text[]
  end;
  if not v_path.extension = any(v_expected_extensions) then
    raise exception using errcode = '23514', message = 'SAT12_IMAGE_EXTENSION_MISMATCH';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'property-images'
      and o.name = new.storage_path
      and lower(coalesce(o.metadata ->> 'mimetype', '')) = new.mime_type
      and case
        when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
          then (o.metadata ->> 'size')::bigint
        else null
      end = new.size_bytes
  ) then
    raise exception using errcode = '23514', message = 'SAT12_IMAGE_OBJECT_MISSING';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_property_image_object() from public, anon, authenticated;

create trigger validate_property_image_object
before insert or update on public.property_images
for each row execute function private.validate_property_image_object();

drop policy "owners delete editable image metadata" on public.property_images;
create policy "owners delete editable image metadata"
on public.property_images for delete to authenticated
using (
  private.revision_is_editable(revision_id)
  and private.can_delete_property_image_metadata(storage_path)
);

revoke update (storage_path, alt_text, position, width, height, size_bytes, mime_type)
on public.property_images from authenticated;
grant update (alt_text, position) on public.property_images to authenticated;
