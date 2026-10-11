-- Validate employee and job assignment in the legacy five-argument calendar RPC.
-- This overload remains used by older clients, so keep it compatible while
-- enforcing the same organization boundaries as update_calendar_plan_details.
create or replace function public.update_calendar_plan(
  p_plan_id uuid,
  p_job_id uuid,
  p_user_id uuid,
  p_hours_worked numeric,
  p_note text
)
returns public.calendar_plans
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_org uuid;
  v_row public.calendar_plans;
begin
  if auth.uid() is null then
    raise exception 'Brak autoryzacji';
  end if;

  v_org := private.current_organization_id();
  if v_org is null then
    raise exception 'Brak organizacji';
  end if;

  if p_hours_worked is not null and (p_hours_worked < 0 or p_hours_worked > 24) then
    raise exception 'Liczba godzin musi być między 0 a 24';
  end if;

  if p_user_id is not null and not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = p_user_id
  ) then
    raise exception 'Wybrany pracownik nie należy do firmy';
  end if;

  if p_job_id is not null and not exists (
    select 1 from public.jobs
    where id = p_job_id and organization_id = v_org
  ) then
    raise exception 'Wybrana robota nie należy do firmy';
  end if;

  update public.calendar_plans
  set job_id = case when plan_type = 'job' then p_job_id else null end,
      user_id = p_user_id,
      title = case
        when plan_type = 'job' then coalesce(
          (select j.name from public.jobs j where j.id = p_job_id and j.organization_id = v_org),
          title
        )
        else title
      end,
      hours_worked = p_hours_worked,
      note = p_note
  where id = p_plan_id and organization_id = v_org
  returning * into v_row;

  if not found then
    raise exception 'Nie znaleziono wpisu albo brak dostępu';
  end if;

  return v_row;
end;
$$;

revoke all privileges on function public.update_calendar_plan(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.update_calendar_plan(uuid, uuid, uuid, numeric, text) to authenticated;
