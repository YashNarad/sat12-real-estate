create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgtap with schema extensions;

create type public.app_role as enum ('user', 'owner_agent', 'admin');
create type public.listing_intent as enum ('buy', 'rent');
create type public.property_type as enum ('apartment', 'villa', 'independent_house', 'plot');
create type public.construction_status as enum ('ready_to_move', 'under_construction');
create type public.revision_status as enum (
  'draft', 'submitted', 'approved', 'rejected', 'published', 'superseded'
);
create type public.approval_decision as enum ('approved', 'rejected');
create type public.enquiry_status as enum ('new', 'contacted', 'closed', 'spam');

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'user',
  full_name text check (full_name is null or char_length(trim(full_name)) between 2 and 100),
  phone text,
  agency_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
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

create table public.property_revisions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  replaces_revision_id uuid,
  title text not null check (char_length(trim(title)) between 3 and 140),
  description text not null default '' check (char_length(description) <= 5000),
  listing_intent public.listing_intent not null,
  property_type public.property_type not null,
  price_inr bigint not null check (price_inr > 0),
  locality text not null check (char_length(trim(locality)) between 2 and 120),
  city text not null default 'Nagpur' check (char_length(trim(city)) between 2 and 120),
  state text not null default 'Maharashtra' check (char_length(trim(state)) between 2 and 120),
  postal_code text check (postal_code is null or postal_code ~ '^[1-9][0-9]{5}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location extensions.geography(point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored,
  bedrooms smallint not null check (bedrooms >= 0),
  bathrooms smallint not null check (bathrooms >= 0),
  area_sq_ft integer not null check (area_sq_ft > 0),
  construction_status public.construction_status not null,
  rera_approved boolean not null default false,
  rera_number text,
  badge text check (badge is null or badge in ('featured', 'new')),
  status public.revision_status not null default 'draft',
  rejection_reason text,
  retention_notice_sent_at timestamptz,
  retention_not_before timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, revision_number),
  unique (id, property_id),
  check (property_type = 'plot' or bedrooms > 0),
  check (rejection_reason is null or char_length(trim(rejection_reason)) between 3 and 1000)
);

alter table public.properties
  add constraint properties_published_revision_fk
  foreign key (published_revision_id, id)
  references public.property_revisions (id, property_id) on delete restrict;

alter table public.property_revisions
  add constraint property_revisions_replaces_same_property_fk
  foreign key (replaces_revision_id, property_id)
  references public.property_revisions (id, property_id) on delete restrict;

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.property_revisions (id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null check (char_length(trim(alt_text)) between 3 and 240),
  position smallint not null check (position between 0 and 11),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  source_kind text not null check (source_kind in ('owner_uploaded', 'sat12_illustrative')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (revision_id, position)
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  property_revision_id_at_submission uuid not null,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 100),
  email text not null check (char_length(trim(email)) between 3 and 320),
  phone text check (phone is null or char_length(trim(phone)) between 7 and 20),
  message text not null check (char_length(trim(message)) between 10 and 2000),
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (property_revision_id_at_submission, property_id)
    references public.property_revisions (id, property_id) on delete restrict
);

create table public.listing_approvals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  revision_id uuid not null,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision public.approval_decision not null,
  notes text,
  property_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (decision <> 'rejected' or char_length(trim(notes)) between 3 and 1000),
  foreign key (revision_id, property_id)
    references public.property_revisions (id, property_id) on delete restrict
);

create table public.role_audit_log (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles (id) on delete restrict,
  previous_role public.app_role,
  new_role public.app_role not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  actor_kind text not null check (actor_kind in ('admin', 'bootstrap')),
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  created_at timestamptz not null default now()
);

create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null check (entity_kind in ('property', 'revision', 'image', 'enquiry', 'approval')),
  entity_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  released_by uuid references public.profiles (id) on delete restrict,
  released_at timestamptz,
  release_reason text,
  unique (entity_kind, entity_id)
);

create table public.retention_audit_log (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  entity_kind text not null,
  entity_id uuid not null,
  action text not null,
  result text not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index properties_owner_id_idx on public.properties (owner_id);
create index property_revisions_property_status_updated_idx
  on public.property_revisions (property_id, status, updated_at desc);
create index property_revisions_filter_idx
  on public.property_revisions (listing_intent, property_type, price_inr, bedrooms);
create index property_revisions_location_idx on public.property_revisions using gist (location);
create unique index property_revisions_one_working_idx
  on public.property_revisions (property_id)
  where status in ('draft', 'submitted', 'approved', 'rejected');
create index property_images_revision_idx on public.property_images (revision_id, position);
create index enquiries_property_idx on public.enquiries (property_id, created_at desc);
create index enquiries_sender_idx on public.enquiries (sender_id, created_at desc);
create index listing_approvals_property_idx on public.listing_approvals (property_id, created_at desc);
create index listing_approvals_revision_idx on public.listing_approvals (revision_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function private.set_updated_at();

create trigger property_revisions_set_updated_at
before update on public.property_revisions
for each row execute function private.set_updated_at();

create trigger enquiries_set_updated_at
before update on public.enquiries
for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_revisions enable row level security;
alter table public.property_images enable row level security;
alter table public.enquiries enable row level security;
alter table public.listing_approvals enable row level security;
alter table public.role_audit_log enable row level security;
alter table public.legal_holds enable row level security;
alter table public.retention_audit_log enable row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on table
  public.profiles,
  public.properties,
  public.property_revisions,
  public.property_images,
  public.enquiries,
  public.listing_approvals,
  public.role_audit_log,
  public.legal_holds,
  public.retention_audit_log
from anon, authenticated;
