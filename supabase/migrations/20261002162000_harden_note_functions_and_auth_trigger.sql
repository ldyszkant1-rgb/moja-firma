alter function public.append_job_note(uuid,jsonb) security invoker set search_path = public, pg_catalog;
alter function public.update_job_note(uuid,text,jsonb) security invoker set search_path = public, pg_catalog;
alter function public.delete_job_note(uuid,text) security invoker set search_path = public, pg_catalog;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
