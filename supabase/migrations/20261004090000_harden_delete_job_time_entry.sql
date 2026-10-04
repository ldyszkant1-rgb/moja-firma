-- Harden the time-entry delete RPC.
-- Only signed-in users may call it; the function still enforces the current organization.

create or replace function public.delete_job_time_entry(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_org uuid;
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Brak autoryzacji';
  end if;

  v_org := private.current_organization_id();

  if v_org is null then
    raise exception 'Brak organizacji';
  end if;

  delete from public.job_time_entries
  where id = p_id
    and organization_id = v_org;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

revoke all on function public.delete_job_time_entry(uuid) from public, anon;
grant execute on function public.delete_job_time_entry(uuid) to authenticated;
