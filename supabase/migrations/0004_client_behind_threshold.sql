-- 0004_client_behind_threshold.sql — per-client override of "which day of the month counts
-- as overdue" (app_settings.reminder_day_of_month stays as the org-wide default; a client
-- with this set uses its own value instead). Any bookkeeper can set it, same as everything
-- else about a client — not admin-gated.
alter table public.clients add column if not exists behind_threshold_day int;
