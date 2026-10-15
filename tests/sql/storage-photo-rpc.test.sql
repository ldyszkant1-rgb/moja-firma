\set ON_ERROR_STOP on
set request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

-- Function exists with least-privilege grants.
do $$
begin
  if not has_function_privilege('authenticated', 'public.append_job_photo(uuid,jsonb)', 'EXECUTE') then
    raise exception 'authenticated must be able to execute append_job_photo';
  end if;
  if has_function_privilege('anon', 'public.append_job_photo(uuid,jsonb)', 'EXECUTE') then
    raise exception 'anon must not be able to execute append_job_photo';
  end if;
end;
$$;

-- Helper requires the supplied validation error; unexpected success fails the test.
create function pg_temp.assert_photo_rejected(p_payload jsonb, p_expected text)
returns void language plpgsql as $$
declare
  v_error text;
begin
  begin
    perform public.append_job_photo(
      '11111111-1111-4111-8111-111111111111',
      p_payload
    );
    raise exception 'TEST_EXPECTED_REJECTION';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'TEST_EXPECTED_REJECTION' then
      raise exception 'Payload unexpectedly accepted: %', p_payload;
    end if;
    if position(p_expected in v_error) = 0 then
      raise exception 'Expected error containing %, got %', p_expected, v_error;
    end if;
  end;
end;
$$;

-- A valid authenticated photo is appended atomically.
select public.append_job_photo(
  '11111111-1111-4111-8111-111111111111',
  '{"id":"photo-1","name":"front.jpg","path":"jobs/11111111-1111-4111-8111-111111111111/photos/front.jpg","type":"image/jpeg","size":12}'::jsonb
);

do $$
begin
  if jsonb_array_length((select photos from public.jobs where id = '11111111-1111-4111-8111-111111111111')) <> 1 then
    raise exception 'Valid photo was not appended';
  end if;
end;
$$;

select pg_temp.assert_photo_rejected('[]'::jsonb, 'JSON object');
select pg_temp.assert_photo_rejected('{"name":"x.jpg","path":"jobs/11111111-1111-4111-8111-111111111111/photos/x.jpg","size":1}'::jsonb, 'Photo ID');
select pg_temp.assert_photo_rejected('{"id":"photo-2","name":"x.jpg","path":"jobs/22222222-2222-4222-8222-222222222222/photos/x.jpg","type":"image/jpeg","size":1}'::jsonb, 'Photo path');
select pg_temp.assert_photo_rejected('{"id":"photo-2","name":"x.jpg","path":"jobs/11111111-1111-4111-8111-111111111111/photos/x.jpg","type":"application/pdf","size":1}'::jsonb, 'content type');
select pg_temp.assert_photo_rejected('{"id":"photo-2","name":"x.jpg","path":"jobs/11111111-1111-4111-8111-111111111111/photos/x.jpg","type":"image/jpeg","size":-1}'::jsonb, 'non-negative number');
select pg_temp.assert_photo_rejected('{"id":"photo-2","name":"x.jpg","path":"jobs/11111111-1111-4111-8111-111111111111/photos/x.jpg","type":"image/jpeg"}'::jsonb, 'non-negative number');
select pg_temp.assert_photo_rejected('{"id":"photo-2","name":"x.jpg","path":"jobs/11111111-1111-4111-8111-111111111111/photos/sub/x.jpg","type":"image/jpeg","size":1}'::jsonb, 'Photo path');
select pg_temp.assert_photo_rejected('{"id":"photo-1","name":"duplicate.jpg","path":"jobs/11111111-1111-4111-8111-111111111111/photos/duplicate.jpg","type":"image/jpeg","size":1}'::jsonb, 'duplicate photo ID');

-- Membership is enforced even for a structurally valid payload.
do $$
declare
  v_error text;
begin
  begin
    perform public.append_job_photo(
      '22222222-2222-4222-8222-222222222222',
      '{"id":"other-org-photo","name":"x.jpg","path":"jobs/22222222-2222-4222-8222-222222222222/photos/x.jpg","type":"image/jpeg","size":1}'::jsonb
    );
    raise exception 'TEST_EXPECTED_REJECTION';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'TEST_EXPECTED_REJECTION' then
      raise exception 'Cross-organization photo append unexpectedly succeeded';
    end if;
    if position('access denied' in v_error) = 0 and position('Job not found' in v_error) = 0 then
      raise exception 'Unexpected cross-organization rejection: %', v_error;
    end if;
  end;
end;
$$;

select 'storage photo RPC integration tests passed' as result;
