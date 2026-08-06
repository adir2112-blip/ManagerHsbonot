-- 0006_client_delete.sql — allows permanently deleting a client (explicit user request,
-- overriding the original soft-delete-only design for this one table). checklist_items,
-- client_form_types, and reminder_events all reference clients(id) on delete cascade, so
-- deleting a client wipes its entire report history in the same transaction — Postgres
-- doesn't apply RLS to cascaded FK deletes, so no policy is needed on those child tables.
create policy clients_delete on public.clients for delete to authenticated using (true);
