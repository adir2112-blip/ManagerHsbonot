-- 0002_client_phone.sql — adds a phone field to clients, used by the topbar client search
-- (search by name or phone). Safe to re-run.
alter table public.clients add column if not exists phone text;
