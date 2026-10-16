-- Break the properties/property_revisions SELECT-policy cycle without weakening RLS.
-- These helpers read authoritative rows as the function owner so policy evaluation
-- never re-enters either table's RLS policy.

create function private.can_read_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.properties p
    join public.property_revisions r
      on r.id = p.published_revision_id
     and r.property_id = p.id
    where p.id = p_property_id
      and p.archived_at is null
      and r.status = 'published'
  )
  or exists (
    select 1
    from public.properties p
    where p.id = p_property_id
      and p.owner_id = (select auth.uid())
  )
  or private.is_aal2_admin();
$$;

create function private.can_read_property_revision(p_revision_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.property_revisions r
    join public.properties p
      on p.id = r.property_id
     and p.published_revision_id = r.id
    where r.id = p_revision_id
      and p.archived_at is null
      and r.status = 'published'
  )
  or exists (
    select 1
    from public.property_revisions r
    join public.properties p on p.id = r.property_id
    where r.id = p_revision_id
      and p.owner_id = (select auth.uid())
  )
  or private.is_aal2_admin();
$$;

revoke all on function private.can_read_property(uuid) from public;
revoke all on function private.can_read_property_revision(uuid) from public;
grant execute on function private.can_read_property(uuid) to anon, authenticated;
grant execute on function private.can_read_property_revision(uuid) to anon, authenticated;

drop policy "public reads active properties" on public.properties;
create policy "public reads active properties"
on public.properties for select to anon, authenticated
using (private.can_read_property(id));

drop policy "public reads current published revisions" on public.property_revisions;
create policy "public reads current published revisions"
on public.property_revisions for select to anon, authenticated
using (private.can_read_property_revision(id));
