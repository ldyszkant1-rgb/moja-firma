-- Append a job photo atomically to avoid losing concurrent updates.
-- The caller must be a member of the job's organization.
create or replace function public.append_job_photo(
  p_job_id uuid,
  p_photo jsonb
)
returns public.jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.jobs;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_job_id is null or p_photo is null then
    raise exception 'Job ID and photo are required';
  end if;

  update public.jobs as j
  set photos =
    (case
      when jsonb_typeof(j.photos) = 'array' then j.photos
      else '[]'::jsonb
    end) || jsonb_build_array(p_photo)
  where j.id = p_job_id
    and exists (
      select 1
      from public.organization_members as om
      where om.organization_id = j.organization_id
        and om.user_id = v_user_id
    )
  returning j.* into v_job;

  if not found then
    raise exception 'Job not found or access denied';
  end if;

  return v_job;
end;
$$;

revoke all privileges on function public.append_job_photo(uuid, jsonb) from public, anon;
grant execute on function public.append_job_photo(uuid, jsonb) to authenticated;
