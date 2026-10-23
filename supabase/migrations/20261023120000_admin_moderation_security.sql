create table public.listing_badge_audit_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  revision_id uuid not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  previous_badge text check (previous_badge is null or previous_badge in ('featured', 'new')),
  new_badge text check (new_badge is null or new_badge in ('featured', 'new')),
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  created_at timestamptz not null default now(),
  foreign key (revision_id, property_id)
    references public.property_revisions (id, property_id) on delete restrict
);

create index listing_badge_audit_revision_idx
  on public.listing_badge_audit_log (revision_id, created_at desc);

alter table public.listing_badge_audit_log enable row level security;

revoke all on table public.listing_badge_audit_log from public, anon, authenticated;

create policy "aal2 admins read listing badge audit"
on public.listing_badge_audit_log for select to authenticated
using (private.is_aal2_admin());

grant select on public.listing_badge_audit_log to authenticated;

create function public.set_listing_badge(
  p_revision_id uuid,
  p_badge text,
  p_reason text
)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.property_revisions;
  v_property public.properties;
  v_previous_badge text;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_BADGE_REASON_REQUIRED';
  end if;
  if p_badge is not null and p_badge not in ('featured', 'new') then
    raise exception using errcode = '23514', message = 'SAT12_BADGE_INVALID';
  end if;

  select * into v_revision
  from public.property_revisions
  where id = p_revision_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SAT12_REVISION_NOT_FOUND';
  end if;

  select * into strict v_property
  from public.properties
  where id = v_revision.property_id
  for update;

  if v_property.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROPERTY_STATE';
  end if;
  if v_revision.status not in ('approved', 'published') then
    raise exception using errcode = 'P0001', message = 'SAT12_BADGE_STATE_INVALID';
  end if;
  if v_revision.status = 'published'
    and v_property.published_revision_id is distinct from v_revision.id then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_REVISION_STATE';
  end if;
  if v_revision.badge is not distinct from p_badge then
    raise exception using errcode = 'P0001', message = 'SAT12_BADGE_UNCHANGED';
  end if;

  v_previous_badge := v_revision.badge;
  update public.property_revisions
  set badge = p_badge
  where id = p_revision_id
  returning * into v_revision;

  insert into public.listing_badge_audit_log (
    property_id, revision_id, actor_id, previous_badge, new_badge, reason
  ) values (
    v_revision.property_id, v_revision.id, (select auth.uid()),
    v_previous_badge, p_badge, trim(p_reason)
  );

  return v_revision;
end;
$$;
revoke all on function public.set_listing_badge(uuid, text, text) from public, anon;
grant execute on function public.set_listing_badge(uuid, text, text) to authenticated;

create or replace function public.set_user_role(
  p_target_id uuid,
  p_role public.app_role,
  p_reason text
)
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
  if p_target_id = (select auth.uid()) then
    raise exception using errcode = '42501', message = 'SAT12_SELF_ROLE_CHANGE_FORBIDDEN';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_ROLE_REASON_REQUIRED';
  end if;
  select role into v_previous
  from public.profiles
  where id = p_target_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SAT12_PROFILE_NOT_FOUND';
  end if;
  update public.profiles
  set role = p_role
  where id = p_target_id
  returning * into v_profile;
  insert into public.role_audit_log (
    target_profile_id, previous_role, new_role, actor_id, actor_kind, reason
  ) values (
    p_target_id, v_previous, p_role, (select auth.uid()), 'admin', trim(p_reason)
  );
  return v_profile;
end;
$$;
