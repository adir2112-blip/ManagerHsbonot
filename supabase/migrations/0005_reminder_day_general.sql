-- 0005_reminder_day_general.sql — reverts the per-client overdue-day override (0004): it's
-- one shared setting for the whole office, not per client. Also opens app_settings updates to
-- any authenticated user (previously admin-only), matching the "any bookkeeper touches
-- everything except the catalog/user management" rule already used everywhere else.
alter table public.clients drop column if exists behind_threshold_day;

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated using (true);
