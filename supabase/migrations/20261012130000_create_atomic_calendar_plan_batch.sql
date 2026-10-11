-- Save a multi-day calendar range in one PostgreSQL transaction.
-- Reuse the existing per-day RPC so organization, assignment, and hours
-- validation stays consistent with single-day saves.
create or replace function public.create_calendar_plans_batch(p_rows jsonb)
returns setof public.calendar_plans
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item jsonb;
  v_row public.calendar_plans;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Brak autoryzacji';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Nieprawidłowe dane zakresu dni';
  end if;

  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 1000 then
    raise exception 'Zakres musi zawierać od 1 do 1000 dni';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Nieprawidłowy wpis w zakresie dni';
    end if;

    v_row := public.create_calendar_plan(
      nullif(v_item ->> 'user_id', '')::uuid,
      nullif(v_item ->> 'job_id', '')::uuid,
      v_item ->> 'plan_type',
      (v_item ->> 'plan_date')::date,
      v_item ->> 'title',
      nullif(v_item ->> 'note', ''),
      nullif(v_item ->> 'hours_worked', '')::numeric
    );

    return next v_row;
  end loop;

  return;
end;
$$;

revoke all privileges on function public.create_calendar_plans_batch(jsonb) from public, anon;
grant execute on function public.create_calendar_plans_batch(jsonb) to authenticated;
