-- Validate photo metadata inside the database RPC as well as in the client.
-- Direct RPC callers must not be able to persist public/foreign URLs or paths
-- that point outside the photo folder for the job being updated.
CREATE OR REPLACE FUNCTION public.append_job_photo(
  p_job_id uuid,
  p_photo jsonb
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_path text;
  v_photo jsonb;
  v_job public.jobs;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_job_id IS NULL OR p_photo IS NULL OR pg_catalog.jsonb_typeof(p_photo) <> 'object' THEN
    RAISE EXCEPTION 'Job ID and photo object are required';
  END IF;

  v_path := p_photo ->> 'path';
  IF v_path IS NULL
     OR v_path !~ ('^jobs/' || p_job_id::text || '/photos/[^/]+$')
     OR pg_catalog.strpos(v_path, pg_catalog.chr(92)) > 0
     OR pg_catalog.split_part(v_path, '/', 4) IN ('.', '..') THEN
    RAISE EXCEPTION 'Photo path must point to the photo folder for this job';
  END IF;

  -- URL is never canonical metadata; the application obtains a fresh URL from path.
  v_photo := p_photo - 'url';

  UPDATE public.jobs AS j
  SET photos =
    (CASE
      WHEN pg_catalog.jsonb_typeof(j.photos) = 'array' THEN j.photos
      ELSE '[]'::jsonb
    END) || pg_catalog.jsonb_build_array(v_photo)
  WHERE j.id = p_job_id
    AND EXISTS (
      SELECT 1
      FROM public.organization_members AS om
      WHERE om.organization_id = j.organization_id
        AND om.user_id = v_user_id
    )
  RETURNING j.* INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or access denied';
  END IF;

  RETURN v_job;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.append_job_photo(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_job_photo(uuid, jsonb) TO authenticated;
