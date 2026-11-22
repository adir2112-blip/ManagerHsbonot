-- 0011_client_portal.sql — client document portal.
-- Each client gets a personal, unguessable link (/portal/<portal_token>). The client signs in
-- with the last 4 digits of their ID number (clients.id_number) and uploads documents per
-- category (invoices, expenses, bank statements...) for a bimonthly VAT period. The office sees
-- a V + date / X per client per category on the uploads dashboard, and can open every file.
-- Portal visitors are NOT Supabase Auth users — every portal read/write goes through server
-- routes using the service-role key after verifying the signed portal session cookie.

alter table public.clients add column if not exists id_number text;
alter table public.clients add column if not exists portal_token text;
alter table public.clients add column if not exists portal_enabled boolean not null default true;
update public.clients
  set portal_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where portal_token is null;
alter table public.clients alter column portal_token
  set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table public.clients alter column portal_token set not null;
create unique index if not exists clients_portal_token_idx on public.clients (portal_token);

-- Office-defined categories a client uploads into. kind='upload' = files; kind='pickup' = the
-- client just confirms physical documents are ready for collection by the office.
create table if not exists public.upload_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '📄',
  kind text not null default 'upload' check (kind in ('upload', 'pickup')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.upload_categories enable row level security;
drop policy if exists upload_categories_select on public.upload_categories;
drop policy if exists upload_categories_insert on public.upload_categories;
drop policy if exists upload_categories_update on public.upload_categories;
create policy upload_categories_select on public.upload_categories for select to authenticated using (true);
create policy upload_categories_insert on public.upload_categories for insert to authenticated with check (is_admin());
create policy upload_categories_update on public.upload_categories for update to authenticated using (is_admin());

insert into public.upload_categories (name, icon, kind, sort_order)
select * from (values
  ('חשבוניות מכירה', '🧾', 'upload', 0),
  ('הוצאות וקבלות', '💸', 'upload', 1),
  ('דפי בנק ואשראי', '🏦', 'upload', 2),
  ('תלושי שכר', '👥', 'upload', 3),
  ('איסוף מסמכים למשרד', '📦', 'pickup', 4)
) as v(name, icon, kind, sort_order)
where not exists (select 1 from public.upload_categories);

-- Which categories apply to each client (office picks 4-5 per client).
create table if not exists public.client_upload_categories (
  client_id uuid not null references public.clients(id) on delete cascade,
  category_id uuid not null references public.upload_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, category_id)
);
alter table public.client_upload_categories enable row level security;
drop policy if exists client_upload_categories_select on public.client_upload_categories;
drop policy if exists client_upload_categories_insert on public.client_upload_categories;
drop policy if exists client_upload_categories_delete on public.client_upload_categories;
create policy client_upload_categories_select on public.client_upload_categories for select to authenticated using (true);
create policy client_upload_categories_insert on public.client_upload_categories for insert to authenticated with check (true);
create policy client_upload_categories_delete on public.client_upload_categories for delete to authenticated using (true);

-- Backfill: existing clients start with the 4 upload categories (not the pickup one).
insert into public.client_upload_categories (client_id, category_id)
select c.id, uc.id from public.clients c cross join public.upload_categories uc
where uc.active and uc.kind = 'upload'
on conflict do nothing;

-- One row per uploaded file, or per "no documents this period" / "ready for pickup" mark.
-- period_start_month is the first month of the bimonthly VAT period (1,3,5,7,9,11).
create table if not exists public.portal_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category_id uuid not null references public.upload_categories(id) on delete cascade,
  period_year int not null,
  period_start_month int not null check (period_start_month in (1, 3, 5, 7, 9, 11)),
  kind text not null check (kind in ('file', 'none', 'pickup')),
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  original_size bigint,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists portal_submissions_period_idx on public.portal_submissions (period_year, period_start_month, client_id);
alter table public.portal_submissions enable row level security;
drop policy if exists portal_submissions_select on public.portal_submissions;
drop policy if exists portal_submissions_delete on public.portal_submissions;
create policy portal_submissions_select on public.portal_submissions for select to authenticated using (true);
create policy portal_submissions_delete on public.portal_submissions for delete to authenticated using (true);
-- inserts come only from the portal routes (service role)

-- Brute-force protection for the 4-digit login (service role only, no policies).
create table if not exists public.portal_login_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_login_attempts_idx on public.portal_login_attempts (client_id, created_at desc);
alter table public.portal_login_attempts enable row level security;

-- Private storage bucket for the files (15MB per file cap; images are compressed client-side).
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-docs', 'client-docs', false, 15728640)
on conflict (id) do nothing;
