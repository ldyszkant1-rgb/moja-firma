-- Validate photo metadata and bind every uploaded photo path to its target job.
-- Existing stored photos are untouched; validation applies to new RPC calls.
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
  v_photo_id text;
  v_photo_name text;
  v_photo_path text;
  v_photo_type text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_job_id is null or p_photo is null then
    raise exception 'Job ID and photo are required';
  end if;

  if jsonb_typeof(p_photo) is distinct from 'object' then
    raise exception 'Photo payload must be a JSON object';
  end if;

  v_photo_id := nullif(btrim(p_photo->>'id'), '');
  v_photo_name := nullif(btrim(p_photo->>'name'), '');
  v_photo_path := nullif(btrim(p_photo->>'path'), '');
  v_photo_type := nullif(btrim(p_photo->>'type'), '');

  if v_photo_id is null or length(v_photo_id) > 128 then
    raise exception 'Photo ID is required and must be at most 128 characters';
  end if;

  if v_photo_name is null or length(v_photo_name) > 255 then
    raise exception 'Photo name is required and must be at most 255 characters';
  end if;

  if v_photo_path is null
     or v_photo_path !~ ('^jobs/' || p_job_id::text || '/photos/[^/]+$') then
    raise exception 'Photo path must belong to the target job photos folder';
  end if;

  if v_photo_type is not null and v_photo_type not like 'image/%' then
    raise exception 'Photo content type must be an image';
  end if;

  if jsonb_typeof(p_photo->'size') is distinct from 'number'
     or (p_photo->>'size')::numeric < 0 then
    raise exception 'Photo size must be a non-negative number';
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
    and not exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(j.photos) = 'array' then j.photos
          else '[]'::jsonb
        end
      ) as photo_row(photo)
      where photo->>'id' = v_photo_id
    )
  returning j.* into v_job;

  if not found then
    raise exception 'Job not found, access denied, or duplicate photo ID';
  end if;

  return v_job;
end;
$$;

revoke all privileges on function public.append_job_photo(uuid, jsonb) from public, anon;
grant execute on function public.append_job_photo(uuid, jsonb) to authenticated;
