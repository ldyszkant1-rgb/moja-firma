-- Restore the table privileges required by authenticated app flows.
-- Existing row-level security policies continue to constrain every row.
-- No grants are added to anon.

grant select, insert, update, delete
on table public.general_reminders
to authenticated;

grant select, insert, delete
on table public.teams, public.team_members
to authenticated;

-- Calendar writes use tenant-checked RPC functions; the app only reads these
-- rows directly for calendar and job details.
grant select
on table public.calendar_plans
to authenticated;
