-- 0003_client_form_types.sql — per-client form selection + client email.
-- Bundled together since neither has been applied yet.

-- Client email — a real address to email the CLIENT directly once that reminder channel
-- exists (separate from profiles.notification_email, which is for the assigned employee).
alter table public.clients add column if not exists email text;

-- Until now every client used the full global catalog. Now a bookkeeper can add/remove
-- specific form types per client from the client card; the system remembers the selection.
-- This is a pure ADD-only selection table (not an audit trail like checklist_items), so real
-- deletes are fine here — removing a form from a client just means "stop tracking it for them
-- going forward", nothing historical to preserve.
create table public.client_form_types (
  client_id uuid not null references public.clients(id) on delete cascade,
  form_type_id uuid not null references public.form_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, form_type_id)
);

alter table public.client_form_types enable row level security;
create policy client_form_types_select on public.client_form_types for select to authenticated using (true);
create policy client_form_types_insert on public.client_form_types for insert to authenticated with check (true);
create policy client_form_types_delete on public.client_form_types for delete to authenticated using (true);

-- Backfill: every existing client gets every currently-active form type selected, so nothing
-- changes for clients created before this feature until someone customizes them.
insert into public.client_form_types (client_id, form_type_id)
select c.id, ft.id from public.clients c cross join public.form_types ft where ft.active
on conflict (client_id, form_type_id) do nothing;
