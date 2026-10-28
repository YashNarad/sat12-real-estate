do $migration_guard$
begin
  if exists (select 1 from public.enquiries) then
    raise exception using
      errcode = '55000',
      message = 'SAT12_ENQUIRY_HISTORIC_RECIPIENT_REVIEW_REQUIRED';
  end if;
end;
$migration_guard$;

alter table public.enquiries
  add column recipient_id uuid not null references public.profiles (id) on delete restrict;

alter table public.enquiries
  alter column sender_id drop not null;

create index enquiries_recipient_status_created_idx
  on public.enquiries (recipient_id, status, created_at desc);

drop policy "authenticated users create enquiries" on public.enquiries;
drop policy "participants read enquiries" on public.enquiries;
drop policy "owners and aal2 admins update enquiry status" on public.enquiries;

revoke insert on public.enquiries from authenticated, anon;
revoke update on public.enquiries from authenticated, anon;

create policy "recipients and aal2 admins read enquiries"
on public.enquiries for select to authenticated
using (
  sender_id = (select auth.uid())
  or (
    recipient_id = (select auth.uid())
    and private.is_owner_agent()
  )
  or private.is_aal2_admin()
);

create function public.submit_property_enquiry(
  p_property_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property public.properties;
  v_revision public.property_revisions;
  v_email text := lower(trim(p_email));
  v_enquiry_id uuid;
begin
  if coalesce(current_setting('app.settings.enquiry_submissions_enabled', true), 'off') <> 'on' then
    raise exception using errcode = '55000', message = 'SAT12_ENQUIRY_BACKEND_UNAVAILABLE';
  end if;
  if p_name is null or p_email is null or p_message is null
     or char_length(trim(p_name)) not between 2 and 100
     or char_length(v_email) not between 3 and 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or (nullif(trim(p_phone), '') is not null and char_length(trim(p_phone)) not between 7 and 20)
     or (nullif(trim(p_phone), '') is not null and trim(p_phone) !~ '^[-0-9+().[:space:]]+$')
     or char_length(trim(p_message)) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'SAT12_ENQUIRY_INVALID';
  end if;

  select p.* into v_property
  from public.properties p
  where p.id = p_property_id
  for update;
  if not found or v_property.archived_at is not null or v_property.published_revision_id is null then
    raise exception using errcode = 'P0002', message = 'SAT12_ENQUIRY_PROPERTY_UNAVAILABLE';
  end if;

  select r.* into v_revision
  from public.properties p
  join public.property_revisions r on p.published_revision_id = r.id
  where p.id = p_property_id and p.archived_at is null and r.status = 'published'
  for update of p, r;
  if not found then
    raise exception using errcode = 'P0002', message = 'SAT12_ENQUIRY_PROPERTY_UNAVAILABLE';
  end if;

  -- A single normalized-email lock serializes both the global hourly threshold
  -- and the narrower property/email duplicate check. Hash collisions can only
  -- serialize unrelated callers; they cannot weaken either limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  if exists (
    select 1 from public.enquiries e
    where e.property_id = p_property_id and lower(e.email) = v_email
      and e.created_at >= statement_timestamp() - interval '15 minutes'
  ) then
    raise exception using errcode = '23505', message = 'SAT12_ENQUIRY_DUPLICATE';
  end if;
  if (select count(*) from public.enquiries e where lower(e.email) = v_email and e.created_at >= statement_timestamp() - interval '1 hour') >= 3 then
    raise exception using errcode = '54000', message = 'SAT12_ENQUIRY_RATE_LIMITED';
  end if;

  insert into public.enquiries (
    property_id, property_revision_id_at_submission, sender_id, recipient_id,
    name, email, phone, message
  ) values (
    v_property.id, v_revision.id, (select auth.uid()), v_property.owner_id,
    trim(p_name), v_email, nullif(trim(p_phone), ''), trim(p_message)
  ) returning id into v_enquiry_id;
  return v_enquiry_id;
end;
$$;

create function public.update_enquiry_status(p_enquiry_id uuid, p_status public.enquiry_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enquiry public.enquiries;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'SAT12_AUTH_REQUIRED';
  end if;
  if p_status not in ('new', 'contacted', 'closed') then
    raise exception using errcode = '22023', message = 'SAT12_ENQUIRY_STATUS_INVALID';
  end if;
  select * into v_enquiry from public.enquiries where id = p_enquiry_id for update;
  if not found or not (
    (
      v_enquiry.recipient_id = (select auth.uid())
      and private.is_owner_agent()
    )
    or private.is_aal2_admin()
  ) then
    raise exception using errcode = '42501', message = 'SAT12_ENQUIRY_FORBIDDEN';
  end if;
  update public.enquiries set status = p_status,
    closed_at = case when p_status = 'closed' then statement_timestamp() else null end
  where id = p_enquiry_id;
end;
$$;

revoke all on function public.submit_property_enquiry(uuid, text, text, text, text) from public;
revoke all on function public.update_enquiry_status(uuid, public.enquiry_status) from public, anon;
grant execute on function public.submit_property_enquiry(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.update_enquiry_status(uuid, public.enquiry_status) to authenticated;
