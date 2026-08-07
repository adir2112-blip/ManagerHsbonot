-- 0009_cron_health.sql — lets the daily reminders cron record that it actually ran, so a
-- second cron (reminders-healthcheck) can detect both failure modes: the job ran but errored,
-- and the job never fired at all (e.g. Vercel Cron itself skipped it) — the latter is only
-- detectable by an outside observer noticing last_run_at went stale.
alter table public.app_settings add column if not exists last_reminder_run_at timestamptz;
alter table public.app_settings add column if not exists last_reminder_run_status text;
alter table public.app_settings add column if not exists last_reminder_run_summary text;
