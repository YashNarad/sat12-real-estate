-- Keep anonymous policy evaluation independent of private-schema helpers.
-- PostgreSQL combines permissive policies with OR, so authenticated callers
-- retain the published, ownership, and AAL2-admin paths without broad grants.

drop policy "users read permitted image metadata" on public.property_images;

create policy "public reads published image metadata"
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
);

create policy "owners read own image metadata"
on public.property_images for select to authenticated
using (
  exists (
    select 1
    from public.property_revisions r
    join public.properties p on p.id = r.property_id
    where r.id = property_images.revision_id
      and p.owner_id = (select auth.uid())
  )
);

create policy "aal2 admins read image metadata"
on public.property_images for select to authenticated
using (private.is_aal2_admin());
