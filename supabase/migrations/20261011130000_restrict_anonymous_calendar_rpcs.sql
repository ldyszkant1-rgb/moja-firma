-- These SECURITY DEFINER calendar mutation RPCs must not be callable by the
-- PostgREST anon role. Authenticated sessions remain supported by the app.
revoke all privileges on function public.delete_calendar_job_day(uuid, uuid, date) from public, anon;
grant execute on function public.delete_calendar_job_day(uuid, uuid, date) to authenticated;

revoke all privileges on function public.update_calendar_plan(uuid, numeric, text) from public, anon;
grant execute on function public.update_calendar_plan(uuid, numeric, text) to authenticated;

revoke all privileges on function public.update_calendar_plan(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.update_calendar_plan(uuid, uuid, uuid, numeric, text) to authenticated;

revoke all privileges on function public.update_calendar_plan_details(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.update_calendar_plan_details(uuid, uuid, uuid, numeric, text) to authenticated;
