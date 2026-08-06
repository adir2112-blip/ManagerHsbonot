-- 0008_reminder_stages.sql — admin-configurable multi-step client email schedule (e.g. "send
-- at day 5, send again at day 10") replacing the old single reminder_day_of_month for CLIENT
-- emails specifically. app_settings.reminder_day_of_month is untouched — it still drives the
-- dashboard's "who's behind" display, a separate concern from when emails actually go out.
create table public.reminder_stages (
  id uuid primary key default gen_random_uuid(),
  days_overdue int not null,
  created_at timestamptz not null default now()
);

alter table public.reminder_stages enable row level security;
create policy reminder_stages_select on public.reminder_stages for select to authenticated using (true);
create policy reminder_stages_insert on public.reminder_stages for insert to authenticated with check (is_admin());
create policy reminder_stages_update on public.reminder_stages for update to authenticated using (is_admin());
create policy reminder_stages_delete on public.reminder_stages for delete to authenticated using (is_admin());

insert into public.reminder_stages (days_overdue) values (5), (10);

-- Which stage an automatic send corresponds to (null = manual send from the client card).
-- Also drop the old unique-less design's implicit one-per-month assumption: a client can now
-- legitimately get multiple sent rows per month (one per stage), which the table already
-- supported (no unique constraint), so no schema change needed there.
alter table public.reminder_events add column if not exists stage_days_overdue int;

-- Editable email template (admin/settings page) — {{שם_לקוח}} and {{רשימת_טפסים}} are
-- substituted at send time. Same table/RLS as the rest of app_settings (any authenticated
-- user can update, per the existing reminder_day_of_month precedent).
alter table public.app_settings add column if not exists reminder_email_subject text
  not null default 'תזכורת: מסמכים נדרשים – {{שם_לקוח}}';
alter table public.app_settings add column if not exists reminder_email_body text
  not null default 'שלום {{שם_לקוח}},

בהתאם לרישומינו, טרם התקבלו המסמכים הבאים לחודש הנוכחי:
{{רשימת_טפסים}}

נבקש להעביר את המסמכים למשרדנו בהקדם האפשרי, לידי הנהלת החשבונות.

בברכה,
הנהלת החשבונות';
