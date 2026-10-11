create or replace function public.rename_job_photo(
  p_job_id uuid,
  p_photo_id text,
  p_new_name text
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
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_job_id is null or nullif(btrim(p_photo_id), '') is null then
    raise exception 'Job ID and photo ID are required';
  end if;
  if nullif(btrim(p_new_name), '') is null then raise exception 'Photo name is required'; end if;

  update public.jobs j
  set photos = (
    select coalesce(jsonb_agg(
      case when elem->>'id' = p_photo_id
        then elem || jsonb_build_object('name', btrim(p_new_name))
        else elem end
      order by ord
    ), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(j.photos) = 'array' then j.photos else '[]'::jsonb end)
      with ordinality as x(elem, ord)
  )
  where j.id = p_job_id
    and exists (select 1 from public.organization_members om
      where om.organization_id = j.organization_id and om.user_id = v_user_id)
    and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(j.photos) = 'array' then j.photos else '[]'::jsonb end) elem
      where elem->>'id' = p_photo_id)
  returning j.* into v_job;

  if not found then raise exception 'Photo not found or access denied'; end if;
  return v_job;
end;
$$;

create or replace function public.remove_job_photo(
  p_job_id uuid,
  p_photo_id text
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
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_job_id is null or nullif(btrim(p_photo_id), '') is null then
    raise exception 'Job ID and photo ID are required';
  end if;

  update public.jobs j
  set photos = (
    select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(j.photos) = 'array' then j.photos else '[]'::jsonb end)
      with ordinality as x(elem, ord)
    where elem->>'id' <> p_photo_id
  )
  where j.id = p_job_id
    and exists (select 1 from public.organization_members om
      where om.organization_id = j.organization_id and om.user_id = v_user_id)
    and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(j.photos) = 'array' then j.photos else '[]'::jsonb end) elem
      where elem->>'id' = p_photo_id)
  returning j.* into v_job;

  if not found then raise exception 'Photo not found or access denied'; end if;
  return v_job;
end;
$$;

revoke all on function public.rename_job_photo(uuid, text, text) from public, anon;
revoke all on function public.remove_job_photo(uuid, text) from public, anon;
grant execute on function public.rename_job_photo(uuid, text, text) to authenticated;
grant execute on function public.remove_job_photo(uuid, text) to authenticated;
