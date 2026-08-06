-- 0001_init.sql — initial schema for מעקב טפסים חודשי
-- Single-tenant, 2 roles (admin / bookkeeper). Role lives in the JWT app_metadata
-- (set by admin/users provisioning via the service-role Admin API), not looked up from a
-- table inside policies — avoids the classic RLS-recursion trap on a `profiles` self-check.

-- Safe to re-run: drops any partially-created objects from a previous failed attempt first.
drop table if exists public.reminder_events cascade;
drop table if exists public.checklist_items cascade;
drop table if exists public.clients cascade;
drop table if exists public.form_types cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.profiles cascade;
drop function if exists public.is_admin();

-- ============================================================================
-- profiles — mirrors auth.users, adds role/display name/notification email.
-- Row is created by the admin/users provisioning route (server, service-role) right after
-- auth.admin.createUser succeeds — not by a DB trigger, so the route can roll back
-- (delete the auth user) if this insert fails, keeping the two in sync.
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  notification_email text,
  full_name text not null,
  role text not null check (role in ('admin', 'bookkeeper')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

create or replace function public.is_admin() returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (is_admin());
create policy profiles_update on public.profiles for update to authenticated using (is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (is_admin());

-- ============================================================================
-- form_types — the checklist catalog. Real admin CRUD, but no hard delete: deactivating
-- (active=false) is the only removal path, so history never loses a form-type it referenced.
-- effective_from gates which months a type counts toward (see lib/checklist.ts) — this is
-- what stops adding a new type today from retroactively marking old completed months
-- "incomplete".
-- ============================================================================
create table public.form_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.form_types enable row level security;
create policy form_types_select on public.form_types for select to authenticated using (true);
create policy form_types_insert on public.form_types for insert to authenticated with check (is_admin());
create policy form_types_update on public.form_types for update to authenticated using (is_admin());
-- no delete policy — soft-delete only (active=false)

-- ============================================================================
-- clients — created once. cycle_start_date anchors bimonthly parity (lib/checklist.ts);
-- editable later if the bookkeeper picked the wrong date. assigned_employee_id routes
-- reminders only — it is NOT an access-control boundary (any bookkeeper can edit any client).
-- ============================================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cycle text not null check (cycle in ('monthly', 'bimonthly')),
  cycle_start_date date not null,
  assigned_employee_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create index clients_assigned_employee_idx on public.clients (assigned_employee_id);

alter table public.clients enable row level security;
create policy clients_select on public.clients for select to authenticated using (true);
create policy clients_insert on public.clients for insert to authenticated with check (true);
create policy clients_update on public.clients for update to authenticated using (true);
-- no delete policy — soft-delete only (active=false)

-- ============================================================================
-- checklist_items — sparse: a row exists only once a form is checked or gets a note, for a
-- given client+form_type+month. Un-checking is an UPDATE (checked=false), never a DELETE, so
-- the note/checked_by/checked_at history is preserved. "Month complete" is computed by the
-- app (lib/checklist.ts), not stored, by comparing checked rows against applicable form_types.
-- ============================================================================
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  form_type_id uuid not null references public.form_types(id),
  year int not null,
  month int not null check (month between 1 and 12),
  checked boolean not null default false,
  note text,
  checked_by uuid references public.profiles(id),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, form_type_id, year, month)
);
create index checklist_items_client_month_idx on public.checklist_items (client_id, year, month);

alter table public.checklist_items enable row level security;
create policy checklist_items_select on public.checklist_items for select to authenticated using (true);
create policy checklist_items_insert on public.checklist_items for insert to authenticated with check (true);
create policy checklist_items_update on public.checklist_items for update to authenticated using (true);
-- no delete policy — uncheck is an update, never a row deletion

-- ============================================================================
-- reminder_events — one row per reminder actually sent (or attempted). No unique-per-month
-- constraint: the nag-until-complete design (lib/checklist.ts shouldSendReminder) sends
-- again every reminder_interval_days while a month stays incomplete, so history is a log,
-- not a single flag. Written only by the cron endpoint using the service-role key (bypasses
-- RLS) — regular users get read-only access, no write policy exists for them.
-- ============================================================================
create table public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  employee_id uuid references public.profiles(id),
  year int not null,
  month int not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index reminder_events_client_month_idx on public.reminder_events (client_id, year, month, sent_at desc);

alter table public.reminder_events enable row level security;
create policy reminder_events_select on public.reminder_events for select to authenticated using (true);
-- no insert/update/delete policy for regular users — only the service-role (cron) writes here

-- ============================================================================
-- app_settings — singleton row, admin-editable reminder cadence.
-- ============================================================================
create table public.app_settings (
  id boolean primary key default true check (id),
  reminder_day_of_month int not null default 10,
  reminder_interval_days int not null default 3,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;
create policy app_settings_select on public.app_settings for select to authenticated using (true);
create policy app_settings_update on public.app_settings for update to authenticated using (is_admin());
