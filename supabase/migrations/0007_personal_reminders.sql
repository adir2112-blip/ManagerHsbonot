-- 0007_personal_reminders.sql — personal, per-task reminders ("client asked to be called back
-- tomorrow at 10 about the VAT form"). Pops up only for the employee who created it; a
-- personal calendar page lists them (admin can switch to see everyone's).
create table public.personal_reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  form_type_id uuid references public.form_types(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  remind_at timestamptz not null,
  note text,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index personal_reminders_due_idx on public.personal_reminders (created_by, is_done, remind_at);

alter table public.personal_reminders enable row level security;
-- Select is permissive at the RLS layer — "mine vs everyone" is enforced in the API route
-- (popups always query created_by = self; the calendar page restricts non-admins to their own
-- rows regardless of what scope they ask for), same pattern as the rest of this schema.
create policy personal_reminders_select on public.personal_reminders for select to authenticated using (true);
create policy personal_reminders_insert on public.personal_reminders for insert to authenticated with check (true);
create policy personal_reminders_update on public.personal_reminders for update to authenticated using (true);
