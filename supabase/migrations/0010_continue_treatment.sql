-- 0010_continue_treatment.sql — "המשך טיפול": an internal per-item override next to each
-- checkbox. Keeps the client's month showing as incomplete even once everything is checked,
-- until someone explicitly clears it — for work that's received from the client but not yet
-- actually closed out on the office's end.
alter table public.checklist_items add column if not exists continue_treatment boolean not null default false;
