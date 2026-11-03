-- SAT12 Stage 5G: versioned Projects and administrator-curated Locations.
-- Forward-only. No existing property revision is backfilled or rewritten.

create type public.location_revision_status as enum ('draft', 'published', 'superseded');
create type public.project_audit_event as enum ('created', 'submitted', 'approved', 'rejected', 'published', 'archived');
create type public.location_audit_event as enum ('created', 'published', 'archived');
create type public.rera_review_decision as enum ('verified', 'not_applicable', 'correction_required');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  published_revision_id uuid,
  archived_at timestamptz,
  retention_notice_sent_at timestamptz,
  retention_not_before timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  published_revision_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.location_revisions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  replaces_revision_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null check (char_length(trim(description)) between 20 and 4000),
  city text not null default 'Nagpur' check (lower(trim(city)) = 'nagpur'),
  state text not null default 'Maharashtra' check (lower(trim(state)) = 'maharashtra'),
  centre_latitude double precision not null check (centre_latitude between 20.75 and 21.45),
  centre_longitude double precision not null check (centre_longitude between 78.75 and 79.45),
  centre_point extensions.geography(point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(centre_longitude, centre_latitude), 4326)::extensions.geography
  ) stored,
  boundary extensions.geometry(multipolygon, 4326),
  boundary_source text,
  seo_title text not null check (char_length(trim(seo_title)) between 10 and 70),
  seo_description text not null check (char_length(trim(seo_description)) between 40 and 180),
  status public.location_revision_status not null default 'draft',
  created_by uuid not null references public.profiles (id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, revision_number),
  unique (id, location_id),
  check (
    (boundary is null and boundary_source is null)
    or (
      boundary is not null
      and char_length(trim(boundary_source)) between 3 and 500
      and extensions.st_isvalid(boundary)
      and not extensions.st_isempty(boundary)
      and extensions.st_xmin(boundary::box3d) >= 78.75
      and extensions.st_xmax(boundary::box3d) <= 79.45
      and extensions.st_ymin(boundary::box3d) >= 20.75
      and extensions.st_ymax(boundary::box3d) <= 21.45
    )
  )
);

alter table public.locations
  add constraint locations_published_revision_fk
  foreign key (published_revision_id, id)
  references public.location_revisions (id, location_id) on delete restrict;

alter table public.location_revisions
  add constraint location_revisions_replaces_same_location_fk
  foreign key (replaces_revision_id, location_id)
  references public.location_revisions (id, location_id) on delete restrict;

create table public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  replaces_revision_id uuid,
  name text not null check (char_length(trim(name)) between 3 and 140),
  builder_name text not null check (char_length(trim(builder_name)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 8000),
  construction_status public.construction_status not null,
  price_min_inr bigint check (price_min_inr is null or price_min_inr > 0),
  price_max_inr bigint check (price_max_inr is null or price_max_inr > 0),
  possession_month date,
  maharera_number text check (maharera_number is null or char_length(trim(maharera_number)) between 3 and 100),
  location_id uuid references public.locations (id) on delete restrict,
  locality_text text not null default '' check (char_length(locality_text) <= 120),
  address_line text check (address_line is null or char_length(trim(address_line)) <= 240),
  city text not null default 'Nagpur' check (lower(trim(city)) = 'nagpur'),
  state text not null default 'Maharashtra' check (lower(trim(state)) = 'maharashtra'),
  postal_code text check (postal_code is null or postal_code ~ '^[1-9][0-9]{5}$'),
  latitude double precision check (latitude is null or latitude between 20.75 and 21.45),
  longitude double precision check (longitude is null or longitude between 78.75 and 79.45),
  location_point extensions.geography(point, 4326) generated always as (
    case when latitude is null or longitude is null then null else
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    end
  ) stored,
  rights_attested_at timestamptz,
  rights_attestation_version text check (
    rights_attestation_version is null
    or char_length(trim(rights_attestation_version)) between 3 and 100
  ),
  status public.revision_status not null default 'draft',
  rejection_reason text check (
    rejection_reason is null or char_length(trim(rejection_reason)) between 3 and 2000
  ),
  retention_notice_sent_at timestamptz,
  retention_not_before timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, revision_number),
  unique (id, project_id),
  check (price_max_inr is null or price_min_inr is not null),
  check (price_max_inr is null or price_max_inr >= price_min_inr),
  check (possession_month is null or extract(day from possession_month) = 1),
  check (construction_status <> 'ready_to_move' or possession_month is null),
  check ((latitude is null) = (longitude is null)),
  check ((rights_attested_at is null) = (rights_attestation_version is null))
);

alter table public.projects
  add constraint projects_published_revision_fk
  foreign key (published_revision_id, id)
  references public.project_revisions (id, project_id) on delete restrict;

alter table public.project_revisions
  add constraint project_revisions_replaces_same_project_fk
  foreign key (replaces_revision_id, project_id)
  references public.project_revisions (id, project_id) on delete restrict;

create table public.project_images (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.project_revisions (id) on delete restrict,
  storage_path text not null unique,
  alt_text text not null check (char_length(trim(alt_text)) between 3 and 240),
  position smallint not null check (position between 0 and 19),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  source_kind text not null default 'owner_uploaded' check (source_kind = 'owner_uploaded'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (revision_id, position)
);

create table public.project_rera_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  revision_id uuid not null,
  claimed_number text,
  official_source_url text check (
    official_source_url is null
    or (
      char_length(official_source_url) between 12 and 1000
      and official_source_url ~ '^https://'
    )
  ),
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  decision public.rera_review_decision,
  reviewer_id uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  review_reason text check (review_reason is null or char_length(trim(review_reason)) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id),
  foreign key (revision_id, project_id)
    references public.project_revisions (id, project_id) on delete restrict,
  check ((reviewer_id is null) = (reviewed_at is null)),
  check (decision is null or reviewer_id is not null),
  check (decision not in ('not_applicable', 'correction_required') or review_reason is not null)
);

create table public.project_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  revision_id uuid not null,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision public.approval_decision not null,
  notes text,
  project_snapshot jsonb not null,
  rera_evidence_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (revision_id, project_id)
    references public.project_revisions (id, project_id) on delete restrict,
  check (decision <> 'rejected' or char_length(trim(notes)) between 3 and 2000)
);

create table public.project_audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  revision_id uuid references public.project_revisions (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  event public.project_audit_event not null,
  reason text check (reason is null or char_length(trim(reason)) between 3 and 2000),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.location_audit_log (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  revision_id uuid references public.location_revisions (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  event public.location_audit_event not null,
  reason text not null check (char_length(trim(reason)) between 3 and 2000),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.property_revisions
  add column location_id uuid references public.locations (id) on delete restrict,
  add column project_id uuid references public.projects (id) on delete restrict,
  add column project_revision_id uuid,
  add constraint property_revisions_project_pair_check check (
    (project_id is null and project_revision_id is null)
    or (project_id is not null and project_revision_id is not null)
  ),
  add constraint property_revisions_project_revision_fk
    foreign key (project_revision_id, project_id)
    references public.project_revisions (id, project_id) on delete restrict;

alter table public.legal_holds drop constraint legal_holds_entity_kind_check;
alter table public.legal_holds add constraint legal_holds_entity_kind_check check (
  entity_kind in (
    'property', 'revision', 'image', 'enquiry', 'approval',
    'project', 'project_revision', 'project_image', 'project_approval',
    'location', 'location_revision'
  )
);

create index projects_owner_id_idx on public.projects (owner_id);
create index project_revisions_project_status_updated_idx
  on public.project_revisions (project_id, status, updated_at desc);
create unique index project_revisions_one_working_idx
  on public.project_revisions (project_id)
  where status in ('draft', 'submitted', 'approved', 'rejected');
create index project_revisions_location_idx on public.project_revisions (location_id);
create index project_revisions_point_idx on public.project_revisions using gist (location_point);
create index project_images_revision_idx on public.project_images (revision_id, position);
create index project_approvals_project_idx on public.project_approvals (project_id, created_at desc);
create index project_audit_project_idx on public.project_audit_log (project_id, created_at desc);
create unique index location_revisions_one_draft_idx
  on public.location_revisions (location_id) where status = 'draft';
create index location_revisions_centre_idx on public.location_revisions using gist (centre_point);
create index location_revisions_boundary_idx on public.location_revisions using gist (boundary)
  where boundary is not null;
create index location_audit_location_idx on public.location_audit_log (location_id, created_at desc);
create index property_revisions_curated_location_idx on public.property_revisions (location_id)
  where location_id is not null;
create index property_revisions_project_idx on public.property_revisions (project_id, project_revision_id)
  where project_id is not null;

create trigger projects_set_updated_at before update on public.projects
for each row execute function private.set_updated_at();
create trigger project_revisions_set_updated_at before update on public.project_revisions
for each row execute function private.set_updated_at();
create trigger project_rera_evidence_set_updated_at before update on public.project_rera_evidence
for each row execute function private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
for each row execute function private.set_updated_at();
create trigger location_revisions_set_updated_at before update on public.location_revisions
for each row execute function private.set_updated_at();

alter table public.projects enable row level security;
alter table public.project_revisions enable row level security;
alter table public.project_images enable row level security;
alter table public.project_rera_evidence enable row level security;
alter table public.project_approvals enable row level security;
alter table public.project_audit_log enable row level security;
alter table public.locations enable row level security;
alter table public.location_revisions enable row level security;
alter table public.location_audit_log enable row level security;

revoke all on public.projects from anon, authenticated;
revoke all on public.project_revisions from anon, authenticated;
revoke all on public.project_images from anon, authenticated;
revoke all on public.project_rera_evidence from anon, authenticated;
revoke all on public.project_approvals from anon, authenticated;
revoke all on public.project_audit_log from anon, authenticated;
revoke all on public.locations from anon, authenticated;
revoke all on public.location_revisions from anon, authenticated;
revoke all on public.location_audit_log from anon, authenticated;

grant select on public.projects, public.project_revisions, public.project_images,
  public.locations, public.location_revisions to anon, authenticated;
grant select on public.project_rera_evidence, public.project_approvals,
  public.project_audit_log, public.location_audit_log to authenticated;
grant insert on public.project_images, public.project_rera_evidence to authenticated;
grant update (alt_text, position) on public.project_images to authenticated;
grant update (claimed_number, official_source_url) on public.project_rera_evidence to authenticated;
grant delete on public.project_images, public.project_rera_evidence to authenticated;
grant update (
  name, builder_name, description, construction_status, price_min_inr, price_max_inr,
  possession_month, maharera_number, location_id, locality_text, address_line, city,
  state, postal_code, latitude, longitude
) on public.project_revisions to authenticated;

revoke insert, update, delete on public.projects from anon, authenticated;
revoke insert, delete on public.project_revisions from anon, authenticated;
revoke insert, update, delete on public.project_approvals from anon, authenticated;
revoke insert, update, delete on public.project_audit_log from anon, authenticated;
revoke insert, update, delete on public.locations, public.location_revisions,
  public.location_audit_log from anon, authenticated;

create function private.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.owner_id = (select auth.uid())
  );
$$;

create function private.project_revision_is_editable(p_revision_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_revisions r
    join public.projects p on p.id = r.project_id
    where r.id = p_revision_id
      and p.owner_id = (select auth.uid())
      and p.archived_at is null
      and r.status in ('draft', 'rejected')
      and private.is_owner_agent()
  );
$$;

revoke all on function private.owns_project(uuid) from public, anon, authenticated;
revoke all on function private.project_revision_is_editable(uuid) from public, anon, authenticated;
grant execute on function private.owns_project(uuid) to authenticated;
grant execute on function private.project_revision_is_editable(uuid) to authenticated;

create policy "public reads published projects"
on public.projects for select to anon, authenticated
using (
  archived_at is null
  and exists (
    select 1 from public.project_revisions
    where projects.published_revision_id = project_revisions.id
      and project_revisions.project_id = projects.id
      and project_revisions.status = 'published'
  )
);

create policy "owners read own projects"
on public.projects for select to authenticated
using (owner_id = (select auth.uid()));

create policy "aal2 admins read projects"
on public.projects for select to authenticated
using (private.is_aal2_admin());

create policy "public reads published project revisions"
on public.project_revisions for select to anon, authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_revisions.project_id
      and p.archived_at is null
      and p.published_revision_id = project_revisions.id
      and project_revisions.status = 'published'
  )
);

create policy "owners read own project revisions"
on public.project_revisions for select to authenticated
using (private.owns_project(project_id));

create policy "aal2 admins read project revisions"
on public.project_revisions for select to authenticated
using (private.is_aal2_admin());

create policy "owners update editable project revisions"
on public.project_revisions for update to authenticated
using (private.project_revision_is_editable(id))
with check (private.project_revision_is_editable(id));

create policy "public reads published project images"
on public.project_images for select to anon, authenticated
using (
  exists (
    select 1
    from public.project_revisions r
    join public.projects p on p.id = r.project_id
    where r.id = project_images.revision_id
      and p.archived_at is null
      and p.published_revision_id = r.id
      and r.status = 'published'
  )
);

create policy "owners read own project images"
on public.project_images for select to authenticated
using (private.project_revision_is_editable(revision_id) or exists (
  select 1 from public.project_revisions r
  join public.projects p on p.id = r.project_id
  where r.id = project_images.revision_id and p.owner_id = (select auth.uid())
));

create policy "aal2 admins read project images"
on public.project_images for select to authenticated
using (private.is_aal2_admin());

create policy "owners insert editable project image metadata"
on public.project_images for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.project_revision_is_editable(revision_id)
);

create policy "owners update editable project image metadata"
on public.project_images for update to authenticated
using (private.project_revision_is_editable(revision_id))
with check (
  created_by = (select auth.uid())
  and private.project_revision_is_editable(revision_id)
);

create policy "owners delete editable project image metadata"
on public.project_images for delete to authenticated
using (private.project_revision_is_editable(revision_id));

create policy "owners read own project evidence"
on public.project_rera_evidence for select to authenticated
using (private.owns_project(project_id));

create policy "aal2 admins read project evidence"
on public.project_rera_evidence for select to authenticated
using (private.is_aal2_admin());

create policy "owners insert editable project evidence"
on public.project_rera_evidence for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and decision is null and reviewer_id is null and reviewed_at is null
  and private.project_revision_is_editable(revision_id)
  and private.owns_project(project_id)
);

create policy "owners update editable unreviewed project evidence"
on public.project_rera_evidence for update to authenticated
using (decision is null and private.project_revision_is_editable(revision_id))
with check (
  submitted_by = (select auth.uid())
  and decision is null and reviewer_id is null and reviewed_at is null
  and private.project_revision_is_editable(revision_id)
);

create policy "owners delete editable unreviewed project evidence"
on public.project_rera_evidence for delete to authenticated
using (decision is null and private.project_revision_is_editable(revision_id));

create policy "owners read own project approvals"
on public.project_approvals for select to authenticated
using (private.owns_project(project_id));
create policy "aal2 admins read project approvals"
on public.project_approvals for select to authenticated
using (private.is_aal2_admin());
create policy "owners read own project audit"
on public.project_audit_log for select to authenticated
using (private.owns_project(project_id));
create policy "aal2 admins read project audit"
on public.project_audit_log for select to authenticated
using (private.is_aal2_admin());

create policy "public reads published locations"
on public.locations for select to anon, authenticated
using (
  archived_at is null
  and exists (
    select 1 from public.location_revisions r
    where r.id = locations.published_revision_id
      and r.location_id = locations.id
      and r.status = 'published'
  )
);
create policy "aal2 admins read locations"
on public.locations for select to authenticated
using (private.is_aal2_admin());
create policy "public reads published location revisions"
on public.location_revisions for select to anon, authenticated
using (
  exists (
    select 1 from public.locations l
    where l.id = location_revisions.location_id
      and l.archived_at is null
      and l.published_revision_id = location_revisions.id
      and location_revisions.status = 'published'
  )
);
create policy "aal2 admins read location revisions"
on public.location_revisions for select to authenticated
using (private.is_aal2_admin());
create policy "aal2 admins read location audit"
on public.location_audit_log for select to authenticated
using (private.is_aal2_admin());

create function public.create_draft_project(p_input jsonb)
returns public.project_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_revision public.project_revisions;
  v_name text := trim(coalesce(p_input ->> 'name', ''));
  v_slug text;
begin
  if (select auth.uid()) is null or not private.is_owner_agent() then
    raise exception using errcode = '42501', message = 'SAT12_OWNER_AGENT_REQUIRED';
  end if;
  if char_length(v_name) not between 3 and 140 then
    raise exception using errcode = '23514', message = 'SAT12_PROJECT_NAME_INVALID';
  end if;
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'project'; end if;
  v_slug := left(v_slug, 70) || '-' || left(extensions.gen_random_uuid()::text, 8);

  insert into public.projects (owner_id, slug)
  values ((select auth.uid()), v_slug) returning * into v_project;
  insert into public.project_revisions (
    project_id, revision_number, name, builder_name, description,
    construction_status, price_min_inr, price_max_inr, possession_month,
    maharera_number, locality_text, address_line, city, state, postal_code,
    latitude, longitude, created_by
  ) values (
    v_project.id, 1, v_name, trim(coalesce(p_input ->> 'builder_name', '')),
    coalesce(p_input ->> 'description', ''),
    coalesce((p_input ->> 'construction_status')::public.construction_status, 'under_construction'),
    (p_input ->> 'price_min_inr')::bigint, (p_input ->> 'price_max_inr')::bigint,
    (p_input ->> 'possession_month')::date, nullif(trim(p_input ->> 'maharera_number'), ''),
    coalesce(p_input ->> 'locality_text', ''), nullif(trim(p_input ->> 'address_line'), ''),
    coalesce(nullif(trim(p_input ->> 'city'), ''), 'Nagpur'),
    coalesce(nullif(trim(p_input ->> 'state'), ''), 'Maharashtra'),
    nullif(trim(p_input ->> 'postal_code'), ''),
    (p_input ->> 'latitude')::double precision, (p_input ->> 'longitude')::double precision,
    (select auth.uid())
  ) returning * into v_revision;
  insert into public.project_audit_log (project_id, revision_id, actor_id, event, snapshot)
  values (v_project.id, v_revision.id, (select auth.uid()), 'created', to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.create_project_revision(p_project_id uuid)
returns public.project_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_project public.projects; v_source public.project_revisions; v_revision public.project_revisions;
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.owner_id <> (select auth.uid()) or not private.is_owner_agent() then
    raise exception using errcode = '42501', message = 'SAT12_PROJECT_FORBIDDEN';
  end if;
  if v_project.archived_at is not null or v_project.published_revision_id is null then
    raise exception using errcode = 'P0001', message = 'SAT12_PROJECT_NOT_REVISIONABLE';
  end if;
  select * into strict v_source from public.project_revisions
    where id = v_project.published_revision_id and project_id = v_project.id and status = 'published';
  insert into public.project_revisions (
    project_id, revision_number, replaces_revision_id, name, builder_name, description,
    construction_status, price_min_inr, price_max_inr, possession_month, maharera_number,
    location_id, locality_text, address_line, city, state, postal_code, latitude, longitude, created_by
  ) values (
    v_project.id,
    (select coalesce(max(revision_number), 0) + 1 from public.project_revisions where project_id = v_project.id),
    v_source.id, v_source.name, v_source.builder_name, v_source.description,
    v_source.construction_status, v_source.price_min_inr, v_source.price_max_inr,
    v_source.possession_month, v_source.maharera_number, v_source.location_id,
    v_source.locality_text, v_source.address_line, v_source.city, v_source.state,
    v_source.postal_code, v_source.latitude, v_source.longitude, (select auth.uid())
  ) returning * into v_revision;
  insert into public.project_audit_log (project_id, revision_id, actor_id, event, snapshot)
  values (v_project.id, v_revision.id, (select auth.uid()), 'created', to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.submit_project(
  p_revision_id uuid,
  p_attestation_version text
)
returns public.project_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_revision public.project_revisions; v_project public.projects; v_location public.locations;
begin
  select p, r into v_project, v_revision
  from public.projects p join public.project_revisions r on r.project_id = p.id
  where r.id = p_revision_id for update of p, r;
  if not found or v_project.owner_id <> (select auth.uid()) or not private.is_owner_agent() then
    raise exception using errcode = '42501', message = 'SAT12_PROJECT_REVISION_FORBIDDEN';
  end if;
  if v_project.archived_at is not null or v_revision.status not in ('draft', 'rejected') then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROJECT_STATE';
  end if;
  if char_length(trim(v_revision.description)) < 20
    or v_revision.location_id is null or v_revision.latitude is null or v_revision.longitude is null
    or p_attestation_version is null or char_length(trim(p_attestation_version)) < 3
    or not exists (select 1 from public.project_images where revision_id = p_revision_id and position = 0)
    or (select count(*) from public.project_images where revision_id = p_revision_id) not between 1 and 20
  then
    raise exception using errcode = '23514', message = 'SAT12_PROJECT_INCOMPLETE';
  end if;
  select * into v_location from public.locations where id = v_revision.location_id for update;
  if not found or v_location.archived_at is not null or v_location.published_revision_id is null then
    raise exception using errcode = '23514', message = 'SAT12_LOCATION_NOT_PUBLISHED';
  end if;
  if not exists (
    select 1 from public.location_revisions lr
    where lr.id = v_location.published_revision_id and lr.location_id = v_location.id and lr.status = 'published'
  ) then raise exception using errcode = '23514', message = 'SAT12_LOCATION_NOT_PUBLISHED'; end if;
  if not exists (
    select 1 from public.project_rera_evidence e
    where e.revision_id = p_revision_id and e.project_id = v_project.id
      and e.claimed_number is not distinct from v_revision.maharera_number
  ) then raise exception using errcode = '23514', message = 'SAT12_PROJECT_RERA_EVIDENCE_REQUIRED'; end if;
  update public.project_revisions set status = 'submitted', submitted_at = now(),
    approved_at = null, rejection_reason = null, rights_attested_at = now(),
    rights_attestation_version = trim(p_attestation_version)
  where id = p_revision_id returning * into v_revision;
  insert into public.project_audit_log (project_id, revision_id, actor_id, event, snapshot)
  values (v_project.id, v_revision.id, (select auth.uid()), 'submitted', to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.review_project_rera_evidence(
  p_revision_id uuid,
  p_decision public.rera_review_decision,
  p_reason text
)
returns public.project_rera_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare v_evidence public.project_rera_evidence; v_revision public.project_revisions;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  if p_decision in ('not_applicable', 'correction_required')
    and (p_reason is null or char_length(trim(p_reason)) < 3)
  then raise exception using errcode = '23514', message = 'SAT12_RERA_REVIEW_REASON_REQUIRED'; end if;
  select * into v_revision from public.project_revisions where id = p_revision_id for update;
  if not found or v_revision.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROJECT_STATE';
  end if;
  select * into v_evidence from public.project_rera_evidence
    where revision_id = p_revision_id and project_id = v_revision.project_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'SAT12_PROJECT_RERA_EVIDENCE_REQUIRED'; end if;
  if p_decision = 'verified' and (
    v_revision.maharera_number is null
    or v_evidence.claimed_number is distinct from v_revision.maharera_number
    or v_evidence.official_source_url is null
  ) then raise exception using errcode = '23514', message = 'SAT12_PROJECT_RERA_EVIDENCE_INVALID'; end if;
  update public.project_rera_evidence set decision = p_decision,
    reviewer_id = (select auth.uid()), reviewed_at = now(), review_reason = nullif(trim(p_reason), '')
  where id = v_evidence.id returning * into v_evidence;
  return v_evidence;
end;
$$;

create function public.approve_project(p_revision_id uuid, p_notes text default null)
returns public.project_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_revision public.project_revisions; v_evidence public.project_rera_evidence;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  select * into v_revision from public.project_revisions where id = p_revision_id for update;
  if not found or v_revision.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROJECT_STATE';
  end if;
  select * into v_evidence from public.project_rera_evidence
    where revision_id = p_revision_id and project_id = v_revision.project_id for update;
  if not found or v_revision.maharera_number is null
    or v_evidence.claimed_number is distinct from v_revision.maharera_number
    or v_evidence.decision <> 'verified'
  then raise exception using errcode = '23514', message = 'SAT12_PROJECT_RERA_NOT_VERIFIED'; end if;
  insert into public.project_approvals (
    project_id, revision_id, reviewer_id, decision, notes, project_snapshot, rera_evidence_snapshot
  ) values (
    v_revision.project_id, v_revision.id, (select auth.uid()), 'approved', nullif(trim(p_notes), ''),
    to_jsonb(v_revision), to_jsonb(v_evidence)
  );
  update public.project_revisions set status = 'approved', approved_at = now(), rejection_reason = null
    where id = p_revision_id returning * into v_revision;
  insert into public.project_audit_log (project_id, revision_id, actor_id, event, reason, snapshot)
  values (v_revision.project_id, v_revision.id, (select auth.uid()), 'approved', nullif(trim(p_notes), ''), to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.reject_project(p_revision_id uuid, p_notes text)
returns public.project_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_revision public.project_revisions; v_evidence jsonb;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  if p_notes is null or char_length(trim(p_notes)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_REJECTION_NOTES_REQUIRED';
  end if;
  select * into v_revision from public.project_revisions where id = p_revision_id for update;
  if not found or v_revision.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROJECT_STATE';
  end if;
  select coalesce(to_jsonb(e), '{}'::jsonb) into v_evidence
    from public.project_rera_evidence e where e.revision_id = p_revision_id for update;
  insert into public.project_approvals (
    project_id, revision_id, reviewer_id, decision, notes, project_snapshot, rera_evidence_snapshot
  ) values (
    v_revision.project_id, v_revision.id, (select auth.uid()), 'rejected', trim(p_notes),
    to_jsonb(v_revision), coalesce(v_evidence, '{}'::jsonb)
  );
  update public.project_revisions set status = 'rejected', approved_at = null, rejection_reason = trim(p_notes)
    where id = p_revision_id returning * into v_revision;
  insert into public.project_audit_log (project_id, revision_id, actor_id, event, reason, snapshot)
  values (v_revision.project_id, v_revision.id, (select auth.uid()), 'rejected', trim(p_notes), to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.publish_project(p_revision_id uuid, p_reason text)
returns public.project_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_revision public.project_revisions; v_project public.projects; v_evidence public.project_rera_evidence;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_PUBLISH_REASON_REQUIRED';
  end if;
  select * into v_revision from public.project_revisions where id = p_revision_id for update;
  if not found or v_revision.status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROJECT_STATE';
  end if;
  select * into v_project from public.projects where id = v_revision.project_id for update;
  select * into v_evidence from public.project_rera_evidence where revision_id = p_revision_id for update;
  if v_project.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'SAT12_PROJECT_ARCHIVED';
  end if;
  if not found or v_revision.maharera_number is null
    or v_evidence.claimed_number is distinct from v_revision.maharera_number
    or v_evidence.decision <> 'verified'
  then raise exception using errcode = '23514', message = 'SAT12_PROJECT_RERA_NOT_VERIFIED'; end if;
  if v_project.published_revision_id is not null then
    update public.project_revisions set status = 'superseded'
      where id = v_project.published_revision_id and status = 'published';
  end if;
  update public.project_revisions set status = 'published', published_at = now()
    where id = p_revision_id returning * into v_revision;
  update public.projects set published_revision_id = p_revision_id where id = v_project.id;
  insert into public.project_audit_log (project_id, revision_id, actor_id, event, reason, snapshot)
  values (v_project.id, v_revision.id, (select auth.uid()), 'published', trim(p_reason), to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.archive_project(p_project_id uuid, p_reason text)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare v_project public.projects;
begin
  if not private.is_aal2_admin() then
    raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception using errcode = '23514', message = 'SAT12_ARCHIVE_REASON_REQUIRED';
  end if;
  update public.projects set archived_at = now()
    where id = p_project_id and archived_at is null returning * into v_project;
  if not found then raise exception using errcode = 'P0001', message = 'SAT12_STALE_PROJECT_STATE'; end if;
  insert into public.project_audit_log (project_id, revision_id, actor_id, event, reason, snapshot)
  values (v_project.id, v_project.published_revision_id, (select auth.uid()), 'archived', trim(p_reason), to_jsonb(v_project));
  return v_project;
end;
$$;

create function public.create_location(p_input jsonb, p_reason text)
returns public.location_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_location public.locations; v_revision public.location_revisions; v_slug text;
begin
  if not private.is_aal2_admin() then raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception using errcode = '23514', message = 'SAT12_LOCATION_REASON_REQUIRED'; end if;
  v_slug := lower(trim(coalesce(p_input ->> 'slug', '')));
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception using errcode = '23514', message = 'SAT12_LOCATION_SLUG_INVALID'; end if;
  insert into public.locations (slug) values (v_slug) returning * into v_location;
  insert into public.location_revisions (
    location_id, revision_number, name, description, city, state,
    centre_latitude, centre_longitude, boundary, boundary_source,
    seo_title, seo_description, created_by
  ) values (
    v_location.id, 1, trim(p_input ->> 'name'), trim(p_input ->> 'description'),
    coalesce(nullif(trim(p_input ->> 'city'), ''), 'Nagpur'),
    coalesce(nullif(trim(p_input ->> 'state'), ''), 'Maharashtra'),
    (p_input ->> 'centre_latitude')::double precision,
    (p_input ->> 'centre_longitude')::double precision,
    case when nullif(trim(p_input ->> 'boundary_wkt'), '') is null then null
      else extensions.st_multi(extensions.st_geomfromtext(p_input ->> 'boundary_wkt', 4326)) end,
    nullif(trim(p_input ->> 'boundary_source'), ''), trim(p_input ->> 'seo_title'),
    trim(p_input ->> 'seo_description'), (select auth.uid())
  ) returning * into v_revision;
  insert into public.location_audit_log (location_id, revision_id, actor_id, event, reason, snapshot)
  values (v_location.id, v_revision.id, (select auth.uid()), 'created', trim(p_reason), to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.create_location_revision(p_location_id uuid, p_reason text)
returns public.location_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_location public.locations; v_source public.location_revisions; v_revision public.location_revisions;
begin
  if not private.is_aal2_admin() then raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception using errcode = '23514', message = 'SAT12_LOCATION_REASON_REQUIRED'; end if;
  select * into v_location from public.locations where id = p_location_id for update;
  if not found or v_location.archived_at is not null or v_location.published_revision_id is null then
    raise exception using errcode = 'P0001', message = 'SAT12_LOCATION_NOT_REVISIONABLE';
  end if;
  select * into strict v_source from public.location_revisions where id = v_location.published_revision_id and status = 'published';
  insert into public.location_revisions (
    location_id, revision_number, replaces_revision_id, name, description, city, state,
    centre_latitude, centre_longitude, boundary, boundary_source, seo_title, seo_description, created_by
  ) values (
    v_location.id,
    (select coalesce(max(revision_number), 0) + 1 from public.location_revisions where location_id = v_location.id),
    v_source.id, v_source.name, v_source.description, v_source.city, v_source.state,
    v_source.centre_latitude, v_source.centre_longitude, v_source.boundary,
    v_source.boundary_source, v_source.seo_title, v_source.seo_description, (select auth.uid())
  ) returning * into v_revision;
  insert into public.location_audit_log (location_id, revision_id, actor_id, event, reason, snapshot)
  values (v_location.id, v_revision.id, (select auth.uid()), 'created', trim(p_reason), to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.publish_location(p_revision_id uuid, p_reason text)
returns public.location_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare v_location public.locations; v_revision public.location_revisions;
begin
  if not private.is_aal2_admin() then raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception using errcode = '23514', message = 'SAT12_LOCATION_REASON_REQUIRED'; end if;
  select l, r into v_location, v_revision
  from public.locations l join public.location_revisions r on r.location_id = l.id
  where r.id = p_revision_id for update of l, r;
  if not found or v_location.archived_at is not null or v_revision.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_LOCATION_STATE';
  end if;
  if v_location.published_revision_id is not null then
    update public.location_revisions set status = 'superseded'
      where id = v_location.published_revision_id and status = 'published';
  end if;
  update public.location_revisions set status = 'published', published_at = now()
    where id = p_revision_id returning * into v_revision;
  update public.locations set published_revision_id = p_revision_id where id = v_location.id;
  insert into public.location_audit_log (location_id, revision_id, actor_id, event, reason, snapshot)
  values (v_location.id, v_revision.id, (select auth.uid()), 'published', trim(p_reason), to_jsonb(v_revision));
  return v_revision;
end;
$$;

create function public.archive_location(p_location_id uuid, p_reason text)
returns public.locations
language plpgsql
security definer
set search_path = ''
as $$
declare v_location public.locations;
begin
  if not private.is_aal2_admin() then raise exception using errcode = '42501', message = 'SAT12_AAL2_ADMIN_REQUIRED'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception using errcode = '23514', message = 'SAT12_LOCATION_REASON_REQUIRED'; end if;
  update public.locations set archived_at = now()
    where id = p_location_id and archived_at is null returning * into v_location;
  if not found then raise exception using errcode = 'P0001', message = 'SAT12_STALE_LOCATION_STATE'; end if;
  insert into public.location_audit_log (location_id, revision_id, actor_id, event, reason, snapshot)
  values (v_location.id, v_location.published_revision_id, (select auth.uid()), 'archived', trim(p_reason), to_jsonb(v_location));
  return v_location;
end;
$$;

-- Preserve the existing listing workflow while validating optional curated
-- associations. Existing rows remain null and continue to submit unchanged.
create or replace function public.submit_listing(p_revision_id uuid)
returns public.property_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.property_revisions;
  v_property public.properties;
begin
  select p, r into v_property, v_revision
  from public.property_revisions r
  join public.properties p on p.id = r.property_id
  where r.id = p_revision_id and p.owner_id = (select auth.uid())
  for update of p, r;
  if not found or not private.is_owner_agent() then
    raise exception using errcode = '42501', message = 'SAT12_REVISION_FORBIDDEN';
  end if;
  if v_revision.status not in ('draft', 'rejected') then
    raise exception using errcode = 'P0001', message = 'SAT12_STALE_REVISION_STATE';
  end if;
  if char_length(trim(v_revision.description)) < 10
    or not exists (select 1 from public.property_images where revision_id = p_revision_id)
  then raise exception using errcode = '23514', message = 'SAT12_LISTING_INCOMPLETE'; end if;
  if v_revision.location_id is not null and not exists (
    select 1 from public.locations l
    join public.location_revisions lr on lr.id = l.published_revision_id and lr.location_id = l.id
    where l.id = v_revision.location_id and l.archived_at is null and lr.status = 'published'
  ) then raise exception using errcode = '23514', message = 'SAT12_LOCATION_NOT_PUBLISHED'; end if;
  if v_revision.project_id is not null and not exists (
    select 1 from public.projects pr
    join public.project_revisions rr on rr.id = pr.published_revision_id and rr.project_id = pr.id
    where pr.id = v_revision.project_id
      and pr.owner_id = v_property.owner_id
      and pr.archived_at is null
      and pr.published_revision_id = v_revision.project_revision_id
      and rr.status = 'published'
  ) then raise exception using errcode = '23514', message = 'SAT12_PROJECT_ASSOCIATION_INVALID'; end if;
  update public.property_revisions set status = 'submitted', submitted_at = now(),
    approved_at = null, rejection_reason = null
  where id = p_revision_id returning * into v_revision;
  return v_revision;
end;
$$;

revoke all on function public.create_draft_project(jsonb) from public, anon;
revoke all on function public.create_project_revision(uuid) from public, anon;
revoke all on function public.submit_project(uuid, text) from public, anon;
revoke all on function public.review_project_rera_evidence(uuid, public.rera_review_decision, text) from public, anon;
revoke all on function public.approve_project(uuid, text) from public, anon;
revoke all on function public.reject_project(uuid, text) from public, anon;
revoke all on function public.publish_project(uuid, text) from public, anon;
revoke all on function public.archive_project(uuid, text) from public, anon;
revoke all on function public.create_location(jsonb, text) from public, anon;
revoke all on function public.create_location_revision(uuid, text) from public, anon;
revoke all on function public.publish_location(uuid, text) from public, anon;
revoke all on function public.archive_location(uuid, text) from public, anon;

grant execute on function public.create_draft_project(jsonb) to authenticated;
grant execute on function public.create_project_revision(uuid) to authenticated;
grant execute on function public.submit_project(uuid, text) to authenticated;
grant execute on function public.review_project_rera_evidence(uuid, public.rera_review_decision, text) to authenticated;
grant execute on function public.approve_project(uuid, text) to authenticated;
grant execute on function public.reject_project(uuid, text) to authenticated;
grant execute on function public.publish_project(uuid, text) to authenticated;
grant execute on function public.archive_project(uuid, text) to authenticated;
grant execute on function public.create_location(jsonb, text) to authenticated;
grant execute on function public.create_location_revision(uuid, text) to authenticated;
grant execute on function public.publish_location(uuid, text) to authenticated;
grant execute on function public.archive_location(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images', 'project-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);

create function private.parse_project_image_path(p_name text)
returns table (owner_id uuid, project_id uuid, revision_id uuid, image_id uuid, extension text)
language plpgsql
immutable
set search_path = ''
as $$
declare v_parts text[]; v_file_match text[];
begin
  v_parts := string_to_array(p_name, '/');
  if array_length(v_parts, 1) <> 4
    or v_parts[1] = '' or v_parts[2] = '' or v_parts[3] = '' or v_parts[4] = ''
  then return; end if;
  v_file_match := regexp_match(
    v_parts[4],
    '^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|jpeg|png|webp)$',
    'i'
  );
  if v_file_match is null then return; end if;
  begin
    return query select v_parts[1]::uuid, v_parts[2]::uuid, v_parts[3]::uuid,
      v_file_match[1]::uuid, lower(v_file_match[2]);
  exception when invalid_text_representation then return;
  end;
end;
$$;

create function private.can_insert_project_image_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_path record;
begin
  select * into v_path from private.parse_project_image_path(p_name);
  if not found or v_path.owner_id <> (select auth.uid()) or not private.is_owner_agent() then return false; end if;
  return exists (
    select 1 from public.projects p join public.project_revisions r on r.project_id = p.id
    where p.id = v_path.project_id and p.owner_id = v_path.owner_id
      and p.archived_at is null and r.id = v_path.revision_id
      and r.status in ('draft', 'rejected')
      and not exists (
        select 1 from public.legal_holds h where h.released_at is null and (
          (h.entity_kind = 'project' and h.entity_id = p.id)
          or (h.entity_kind = 'project_revision' and h.entity_id = r.id)
          or (h.entity_kind = 'project_image' and h.entity_id = v_path.image_id)
        )
      )
  );
end;
$$;

create function private.can_read_project_image_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_path record;
begin
  select * into v_path from private.parse_project_image_path(p_name);
  if not found then return false; end if;
  return exists (
    select 1 from public.project_images i
    join public.project_revisions r on r.id = i.revision_id
    join public.projects p on p.id = r.project_id
    where i.id = v_path.image_id and i.storage_path = p_name
      and i.revision_id = v_path.revision_id and p.id = v_path.project_id
      and p.owner_id = v_path.owner_id and (
        (p.archived_at is null and p.published_revision_id = r.id and r.status = 'published')
        or p.owner_id = (select auth.uid()) or private.is_aal2_admin()
      )
  );
end;
$$;

create function private.can_delete_project_image_metadata(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_path record;
begin
  select * into v_path from private.parse_project_image_path(p_name);
  if not found or v_path.owner_id <> (select auth.uid()) or not private.is_owner_agent() then return false; end if;
  return exists (
    select 1 from public.projects p join public.project_revisions r on r.project_id = p.id
    where p.id = v_path.project_id and p.owner_id = v_path.owner_id
      and p.archived_at is null and r.id = v_path.revision_id and r.status in ('draft', 'rejected')
      and not exists (
        select 1 from public.legal_holds h where h.released_at is null and (
          (h.entity_kind = 'project' and h.entity_id = p.id)
          or (h.entity_kind = 'project_revision' and h.entity_id = r.id)
          or (h.entity_kind = 'project_image' and h.entity_id = v_path.image_id)
        )
      )
  );
end;
$$;

create function private.can_delete_project_image_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_delete_project_image_metadata(p_name)
    and not exists (select 1 from public.project_images i where i.storage_path = p_name);
$$;

revoke all on function private.parse_project_image_path(text) from public, anon, authenticated;
revoke all on function private.can_insert_project_image_object(text) from public, anon, authenticated;
revoke all on function private.can_read_project_image_object(text) from public, anon, authenticated;
revoke all on function private.can_delete_project_image_metadata(text) from public, anon, authenticated;
revoke all on function private.can_delete_project_image_object(text) from public, anon, authenticated;
grant execute on function private.can_insert_project_image_object(text) to authenticated;
grant execute on function private.can_read_project_image_object(text) to anon, authenticated;
grant execute on function private.can_delete_project_image_metadata(text) to authenticated;
grant execute on function private.can_delete_project_image_object(text) to authenticated;

create policy "owners upload editable project images"
on storage.objects for insert to authenticated
with check (bucket_id = 'project-images' and private.can_insert_project_image_object(name));
create policy "permitted users read project images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'project-images' and private.can_read_project_image_object(name));
create policy "owners delete editable project images"
on storage.objects for delete to authenticated
using (bucket_id = 'project-images' and private.can_delete_project_image_object(name));

create function private.validate_project_image_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner_id uuid; v_project_id uuid; v_path record; v_expected_extensions text[];
begin
  select p.owner_id, p.id into v_owner_id, v_project_id
  from public.project_revisions r join public.projects p on p.id = r.project_id
  where r.id = new.revision_id;
  if not found then raise exception using errcode = '23503', message = 'SAT12_PROJECT_IMAGE_REVISION_MISSING'; end if;
  select * into v_path from private.parse_project_image_path(new.storage_path);
  if not found or v_path.owner_id <> v_owner_id or v_path.project_id <> v_project_id
    or v_path.revision_id <> new.revision_id or v_path.image_id <> new.id
  then raise exception using errcode = '23514', message = 'SAT12_PROJECT_IMAGE_PATH_MISMATCH'; end if;
  v_expected_extensions := case new.mime_type
    when 'image/jpeg' then array['jpg', 'jpeg']::text[]
    when 'image/png' then array['png']::text[]
    when 'image/webp' then array['webp']::text[] else array[]::text[] end;
  if not v_path.extension = any(v_expected_extensions) then
    raise exception using errcode = '23514', message = 'SAT12_PROJECT_IMAGE_EXTENSION_MISMATCH';
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'project-images' and o.name = new.storage_path
      and lower(coalesce(o.metadata ->> 'mimetype', '')) = new.mime_type
      and case when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (o.metadata ->> 'size')::bigint else null end = new.size_bytes
  ) then raise exception using errcode = '23514', message = 'SAT12_PROJECT_IMAGE_OBJECT_MISSING'; end if;
  return new;
end;
$$;

revoke all on function private.validate_project_image_object() from public, anon, authenticated;
create trigger validate_project_image_object before insert or update on public.project_images
for each row execute function private.validate_project_image_object();
