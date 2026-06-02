-- PYTHAS Event Admin + Dynamic Registration Fields
-- Run this in Supabase SQL Editor after the original SETUP-SUPABASE.md schema.

-- 0) Base tables, safe if the original setup has not been run yet.
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id text,
  event_title text,
  roblox_username text,
  discord_username text,
  device text,
  map text,
  notes text
);

create table if not exists public.admins (
  email text primary key,
  added_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

alter table public.registrations enable row level security;
alter table public.admins enable row level security;

-- 1) Admin roles: owner/admin can edit events; staff can only read admin data.
alter table public.admins
  add column if not exists role text not null default 'staff'
  check (role in ('owner', 'admin', 'staff'));

create or replace function public.admin_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select role
    from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
    limit 1
  ), '');
$$;

create or replace function public.can_edit_events()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.admin_role() in ('owner', 'admin');
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.admin_role() = 'owner';
$$;

-- 2) Events managed from admin panel.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  game text not null default 'Mount Agora',
  date date,
  start_date date,
  end_date date,
  time text,
  timezone text default 'WIB',
  status text not null default 'upcoming'
    check (status in ('live', 'upcoming', 'finished', 'coming-soon')),
  type text,
  image text,
  description text,
  broadcast_text text,
  rules jsonb not null default '[]'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  prize text,
  caster text,
  registration_enabled boolean not null default true,
  registration_link text,
  tags jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.event_registration_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sort_order int not null default 0,
  field_key text not null,
  label text not null,
  type text not null default 'text'
    check (type in ('text', 'textarea', 'select', 'number', 'date', 'url', 'checkbox')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  placeholder text,
  help_text text,
  unique (event_id, field_key)
);

-- 3) Backwards-compatible registrations table upgrade.
alter table public.registrations
  add column if not exists answers jsonb not null default '{}'::jsonb;

-- Existing imports/old registrations keep working with old columns.
alter table public.registrations
  alter column roblox_username drop not null,
  alter column discord_username drop not null;

-- Owner-only role management from the admin panel.
drop policy if exists "owners can read admins" on public.admins;
create policy "owners can read admins"
  on public.admins
  for select
  to authenticated
  using (public.is_owner());

drop policy if exists "owners can add admins" on public.admins;
create policy "owners can add admins"
  on public.admins
  for insert
  to authenticated
  with check (public.is_owner());

drop policy if exists "owners can update admins" on public.admins;
create policy "owners can update admins"
  on public.admins
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "owners can delete admins" on public.admins;
create policy "owners can delete admins"
  on public.admins
  for delete
  to authenticated
  using (public.is_owner());

-- 4) Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- 5) RLS.
alter table public.events enable row level security;
alter table public.event_registration_fields enable row level security;

drop policy if exists "public can read published events" on public.events;
create policy "public can read published events"
  on public.events for select
  to anon, authenticated
  using (published = true or public.is_admin());

drop policy if exists "event editors can insert events" on public.events;
create policy "event editors can insert events"
  on public.events for insert
  to authenticated
  with check (public.can_edit_events());

drop policy if exists "event editors can update events" on public.events;
create policy "event editors can update events"
  on public.events for update
  to authenticated
  using (public.can_edit_events())
  with check (public.can_edit_events());

drop policy if exists "event editors can delete events" on public.events;
create policy "event editors can delete events"
  on public.events for delete
  to authenticated
  using (public.can_edit_events());

drop policy if exists "public can read fields for published events" on public.event_registration_fields;
create policy "public can read fields for published events"
  on public.event_registration_fields for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.published = true or public.is_admin())
    )
  );

drop policy if exists "event editors can insert fields" on public.event_registration_fields;
create policy "event editors can insert fields"
  on public.event_registration_fields for insert
  to authenticated
  with check (public.can_edit_events());

drop policy if exists "event editors can update fields" on public.event_registration_fields;
create policy "event editors can update fields"
  on public.event_registration_fields for update
  to authenticated
  using (public.can_edit_events())
  with check (public.can_edit_events());

drop policy if exists "event editors can delete fields" on public.event_registration_fields;
create policy "event editors can delete fields"
  on public.event_registration_fields for delete
  to authenticated
  using (public.can_edit_events());

-- Admin/staff read registrations, only owner/admin delete remains via previous policy.
drop policy if exists "only admins can read" on public.registrations;
create policy "only admins can read"
  on public.registrations
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can delete" on public.registrations;
drop policy if exists "only admins can delete" on public.registrations;
drop policy if exists "only owners and admins can delete" on public.registrations;
create policy "only owners and admins can delete"
  on public.registrations
  for delete
  to authenticated
  using (public.can_edit_events());

-- 6) Storage bucket for event images.
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can read event images" on storage.objects;
create policy "public can read event images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'event-images');

drop policy if exists "event editors can upload event images" on storage.objects;
create policy "event editors can upload event images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-images' and public.can_edit_events());

drop policy if exists "event editors can update event images" on storage.objects;
create policy "event editors can update event images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'event-images' and public.can_edit_events())
  with check (bucket_id = 'event-images' and public.can_edit_events());

drop policy if exists "event editors can delete event images" on storage.objects;
create policy "event editors can delete event images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-images' and public.can_edit_events());

-- 7) Promote an admin by email:
-- update public.admins set role = 'owner' where email = 'your-email@example.com';
