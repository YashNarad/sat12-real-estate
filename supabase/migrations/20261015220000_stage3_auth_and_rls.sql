create function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function private.is_owner_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() = 'owner_agent', false);
$$;

create function private.is_aal2_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() = 'admin'
    and auth.jwt() ->> 'aal' = 'aal2',
    false
  );
$$;

create function private.owns_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.properties
    where id = p_property_id and owner_id = (select auth.uid())
  );
$$;

create function private.revision_is_editable(p_revision_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.property_revisions r
    join public.properties p on p.id = r.property_id
    where r.id = p_revision_id
      and p.owner_id = (select auth.uid())
      and r.status in ('draft', 'rejected')
  );
$$;

revoke all on function private.current_role() from public;
revoke all on function private.is_owner_agent() from public;
revoke all on function private.is_aal2_admin() from public;
revoke all on function private.owns_property(uuid) from public;
revoke all on function private.revision_is_editable(uuid) from public;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_owner_agent() to authenticated;
grant execute on function private.is_aal2_admin() to authenticated;
grant execute on function private.owns_property(uuid) to authenticated;
grant execute on function private.revision_is_editable(uuid) to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'user',
    case
      when char_length(trim(new.raw_user_meta_data ->> 'full_name')) between 2 and 100
        then trim(new.raw_user_meta_data ->> 'full_name')
      else null
    end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "users read own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_aal2_admin());

create policy "users update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "public reads active properties"
on public.properties for select to anon, authenticated
using (
  archived_at is null
  and published_revision_id is not null
  and exists (
    select 1 from public.property_revisions r
    where r.id = published_revision_id
      and r.property_id = properties.id
      and r.status = 'published'
  )
  or owner_id = (select auth.uid())
  or private.is_aal2_admin()
);

create policy "public reads current published revisions"
on public.property_revisions for select to anon, authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_revisions.property_id
      and p.archived_at is null
      and p.published_revision_id = property_revisions.id
      and property_revisions.status = 'published'
  )
  or private.owns_property(property_id)
  or private.is_aal2_admin()
);

create policy "owners update editable revisions"
on public.property_revisions for update to authenticated
using (private.revision_is_editable(id))
with check (private.revision_is_editable(id));

create policy "owners delete editable revisions"
on public.property_revisions for delete to authenticated
using (private.revision_is_editable(id));

create policy "users read permitted image metadata"
on public.property_images for select to anon, authenticated
using (
  exists (
    select 1
    from public.property_revisions r
    join public.properties p on p.id = r.property_id
    where r.id = property_images.revision_id
      and p.archived_at is null
      and p.published_revision_id = r.id
      and r.status = 'published'
  )
  or exists (
    select 1
    from public.property_revisions r
    join public.properties p on p.id = r.property_id
    where r.id = property_images.revision_id
      and p.owner_id = (select auth.uid())
  )
  or private.is_aal2_admin()
);

create policy "owners insert editable image metadata"
on public.property_images for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.revision_is_editable(revision_id)
);

create policy "owners update editable image metadata"
on public.property_images for update to authenticated
using (private.revision_is_editable(revision_id))
with check (
  created_by = (select auth.uid())
  and private.revision_is_editable(revision_id)
);

create policy "owners delete editable image metadata"
on public.property_images for delete to authenticated
using (private.revision_is_editable(revision_id));

create policy "authenticated users create enquiries"
on public.enquiries for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.properties p
    join public.property_revisions r on r.id = p.published_revision_id
    where p.id = enquiries.property_id
      and p.archived_at is null
      and r.id = enquiries.property_revision_id_at_submission
      and r.status = 'published'
  )
);

create policy "participants read enquiries"
on public.enquiries for select to authenticated
using (
  sender_id = (select auth.uid())
  or exists (
    select 1 from public.properties p
    where p.id = enquiries.property_id and p.owner_id = (select auth.uid())
  )
  or private.is_aal2_admin()
);

create policy "owners and aal2 admins update enquiry status"
on public.enquiries for update to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = enquiries.property_id and p.owner_id = (select auth.uid())
  )
  or private.is_aal2_admin()
)
with check (
  exists (
    select 1 from public.properties p
    where p.id = enquiries.property_id and p.owner_id = (select auth.uid())
  )
  or private.is_aal2_admin()
);

create policy "owners read listing approvals"
on public.listing_approvals for select to authenticated
using (private.owns_property(property_id) or private.is_aal2_admin());

create policy "aal2 admins read role audit"
on public.role_audit_log for select to authenticated
using (private.is_aal2_admin());

create policy "aal2 admins read legal holds"
on public.legal_holds for select to authenticated
using (private.is_aal2_admin());

create policy "aal2 admins read retention audit"
on public.retention_audit_log for select to authenticated
using (private.is_aal2_admin());

grant select on public.profiles to authenticated;
grant update (full_name, phone, agency_name, avatar_path) on public.profiles to authenticated;
grant select on public.properties, public.property_revisions, public.property_images to anon, authenticated;
grant update (
  title, description, listing_intent, property_type, price_inr, locality, city,
  state, postal_code, latitude, longitude, bedrooms, bathrooms, area_sq_ft,
  construction_status, rera_approved, rera_number
) on public.property_revisions to authenticated;
grant delete on public.property_revisions to authenticated;
grant insert (revision_id, storage_path, alt_text, position, width, height, size_bytes, mime_type, source_kind, created_by),
  update (storage_path, alt_text, position, width, height, size_bytes, mime_type),
  delete on public.property_images to authenticated;
grant insert (property_id, property_revision_id_at_submission, sender_id, name, email, phone, message),
  select, update (status, closed_at) on public.enquiries to authenticated;
grant select on public.listing_approvals, public.role_audit_log, public.legal_holds, public.retention_audit_log to authenticated;

create function public.create_draft_listing(p_listing jsonb)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property public.properties;
  v_revision public.property_revisions;
begin
  if not private.is_owner_agent() then
    raise exception using errcode = '42501', message = 'SAT12_OWNER_REQUIRED';
  end if;

  insert into public.properties (owner_id, slug)
  values ((select auth.uid()), p_listing ->> 'slug')
  returning * into v_property;

  insert into public.property_revisions (
    property_id, revision_number, title, description, listing_intent,
    property_type, price_inr, locality, city, state, postal_code, latitude,
    longitude, bedrooms, bathrooms, area_sq_ft, construction_status,
    rera_approved, rera_number, created_by
  ) values (
    v_property.id, 1, p_listing ->> 'title', coalesce(p_listing ->> 'description', ''),
    (p_listing ->> 'listing_intent')::public.listing_intent,
    (p_listing ->> 'property_type')::public.property_type,
    (p_listing ->> 'price_inr')::bigint, p_listing ->> 'locality',
    coalesce(p_listing ->> 'city', 'Nagpur'), coalesce(p_listing ->> 'state', 'Maharashtra'),
    nullif(p_listing ->> 'postal_code', ''), (p_listing ->> 'latitude')::double precision,
    (p_listing ->> 'longitude')::double precision, (p_listing ->> 'bedrooms')::smallint,
    (p_listing ->> 'bathrooms')::smallint, (p_listing ->> 'area_sq_ft')::integer,
    (p_listing ->> 'construction_status')::public.construction_status,
    coalesce((p_listing ->> 'rera_approved')::boolean, false),
    nullif(p_listing ->> 'rera_number', ''), (select auth.uid())
  ) returning * into v_revision;
  return v_revision;
end;
$$;

create function public.create_listing_revision(p_property_id uuid)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property public.properties;
  v_source public.property_revisions;
  v_revision public.property_revisions;
begin
  if not private.is_owner_agent() then
    raise exception using errcode = '42501', message = 'SAT12_OWNER_REQUIRED';
  end if;
  select * into v_property from public.properties where id = p_property_id for update;
  if not found or v_property.owner_id <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'SAT12_PROPERTY_FORBIDDEN';
  end if;
  if v_property.published_revision_id is null then
    raise exception using errcode = 'P0001', message = 'SAT12_NO_PUBLISHED_REVISION';
  end if;
  select * into strict v_source from public.property_revisions
    where id = v_property.published_revision_id and status = 'published';

  insert into public.property_revisions (
    property_id, revision_number, replaces_revision_id, title, description,
    listing_intent, property_type, price_inr, locality, city, state, postal_code,
    latitude, longitude, bedrooms, bathrooms, area_sq_ft, construction_status,
    rera_approved, rera_number, created_by
  ) values (
    v_property.id,
    (select coalesce(max(revision_number), 0) + 1 from public.property_revisions where property_id = v_property.id),
    v_source.id, v_source.title, v_source.description, v_source.listing_intent,
    v_source.property_type, v_source.price_inr, v_source.locality, v_source.city,
    v_source.state, v_source.postal_code, v_source.latitude, v_source.longitude,
    v_source.bedrooms, v_source.bathrooms, v_source.area_sq_ft,
    v_source.construction_status, v_source.rera_approved, v_source.rera_number,
    (select auth.uid())
  ) returning * into v_revision;

  return v_revision;
end;
$$;

create function public.submit_listing(p_revision_id uuid)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_revision public.property_revisions;
begin
  select r.* into v_revision
  from public.property_revisions r
  join public.properties p on p.id = r.property_id
  where r.id = p_revision_id and p.owner_id = (select auth.uid())
  for update of r;
  if not found or not private.is_owner_agent() then
    raise exception using errcode = '42501', message = 'SAT12_REVISION_FORBIDDEN';
  end if;
  if v_revision.status not in ('draft', 'rejected') then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_REVISION_STATE';
  end if;
  if char_length(trim(v_revision.description)) < 10
    or not exists (select 1 from public.property_images where revision_id = p_revision_id)
  then
    raise exception using errcode = '23514', message = 'SAT12_LISTING_INCOMPLETE';
  end if;
  update public.property_revisions set status = 'submitted', submitted_at = now(),
    approved_at = null, rejection_reason = null
  where id = p_revision_id returning * into v_revision;
  return v_revision;
end;
$$;

create function public.approve_listing(p_revision_id uuid, p_notes text default null)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_revision public.property_revisions;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  select * into v_revision from public.property_revisions where id = p_revision_id for update;
  if not found or v_revision.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_REVISION_STATE';
  end if;
  insert into public.listing_approvals (property_id, revision_id, reviewer_id, decision, notes, property_snapshot)
  values (v_revision.property_id, v_revision.id, (select auth.uid()), 'approved', nullif(trim(p_notes), ''), to_jsonb(v_revision));
  update public.property_revisions set status = 'approved', approved_at = now(), rejection_reason = null
    where id = p_revision_id returning * into v_revision;
  return v_revision;
end;
$$;

create function public.reject_listing(p_revision_id uuid, p_notes text)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_revision public.property_revisions;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  if p_notes is null or char_length(trim(p_notes)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_REJECTION_NOTES_REQUIRED';
  end if;
  select * into v_revision from public.property_revisions where id = p_revision_id for update;
  if not found or v_revision.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_REVISION_STATE';
  end if;
  insert into public.listing_approvals (property_id, revision_id, reviewer_id, decision, notes, property_snapshot)
  values (v_revision.property_id, v_revision.id, (select auth.uid()), 'rejected', trim(p_notes), to_jsonb(v_revision));
  update public.property_revisions set status = 'rejected', rejection_reason = trim(p_notes), approved_at = null
    where id = p_revision_id returning * into v_revision;
  return v_revision;
end;
$$;

create function public.publish_listing(p_revision_id uuid)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.property_revisions;
  v_property public.properties;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  select * into v_revision from public.property_revisions where id = p_revision_id for update;
  if not found or v_revision.status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_REVISION_STATE';
  end if;
  select * into strict v_property from public.properties where id = v_revision.property_id for update;
  if v_property.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'SAT12_PROPERTY_ARCHIVED';
  end if;
  if v_property.published_revision_id is not null then
    update public.property_revisions set status = 'superseded'
      where id = v_property.published_revision_id and status = 'published';
  end if;
  update public.property_revisions set status = 'published', published_at = now()
    where id = p_revision_id returning * into v_revision;
  update public.properties set published_revision_id = p_revision_id where id = v_property.id;
  return v_revision;
end;
$$;

create function public.archive_listing(p_property_id uuid)
returns public.properties
language plpgsql
security definer
set search_path = ''
as $$
declare v_property public.properties;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  update public.properties set archived_at = now()
    where id = p_property_id and archived_at is null
    returning * into v_property;
  if not found then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROPERTY_STATE';
  end if;
  return v_property;
end;
$$;

create function public.set_user_role(p_target_id uuid, p_role public.app_role, p_reason text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_previous public.app_role;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_ROLE_REASON_REQUIRED';
  end if;
  select role into v_previous from public.profiles where id = p_target_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SAT12_PROFILE_NOT_FOUND';
  end if;
  update public.profiles set role = p_role where id = p_target_id returning * into v_profile;
  insert into public.role_audit_log (target_profile_id, previous_role, new_role, actor_id, actor_kind, reason)
  values (p_target_id, v_previous, p_role, (select auth.uid()), 'admin', trim(p_reason));
  return v_profile;
end;
$$;

create function public.bootstrap_first_admin(p_target_id uuid, p_reason text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare v_profile public.profiles;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'SAT12_SERVICE_ROLE_REQUIRED';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_ROLE_REASON_REQUIRED';
  end if;
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception using errcode = 'P0001', message = 'SAT12_ADMIN_ALREADY_EXISTS';
  end if;
  if not exists (select 1 from auth.users where id = p_target_id and email_confirmed_at is not null) then
    raise exception using errcode = 'P0002', message = 'SAT12_CONFIRMED_USER_REQUIRED';
  end if;
  update public.profiles set role = 'admin' where id = p_target_id returning * into v_profile;
  if not found then
    raise exception using errcode = 'P0002', message = 'SAT12_PROFILE_NOT_FOUND';
  end if;
  insert into public.role_audit_log (target_profile_id, previous_role, new_role, actor_id, actor_kind, reason)
  values (p_target_id, 'user', 'admin', null, 'bootstrap', trim(p_reason));
  return v_profile;
end;
$$;

revoke all on function public.create_draft_listing(jsonb) from public, anon;
revoke all on function public.create_listing_revision(uuid) from public, anon;
revoke all on function public.submit_listing(uuid) from public, anon;
revoke all on function public.approve_listing(uuid, text) from public, anon;
revoke all on function public.reject_listing(uuid, text) from public, anon;
revoke all on function public.publish_listing(uuid) from public, anon;
revoke all on function public.archive_listing(uuid) from public, anon;
revoke all on function public.set_user_role(uuid, public.app_role, text) from public, anon;
revoke all on function public.bootstrap_first_admin(uuid, text) from public, anon, authenticated;

grant execute on function public.create_draft_listing(jsonb) to authenticated;
grant execute on function public.create_listing_revision(uuid) to authenticated;
grant execute on function public.submit_listing(uuid) to authenticated;
grant execute on function public.approve_listing(uuid, text) to authenticated;
grant execute on function public.reject_listing(uuid, text) to authenticated;
grant execute on function public.publish_listing(uuid) to authenticated;
grant execute on function public.archive_listing(uuid) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role, text) to authenticated;
grant execute on function public.bootstrap_first_admin(uuid, text) to service_role;
