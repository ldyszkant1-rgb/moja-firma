\set ON_ERROR_STOP on

-- Active distributions must prevent organization deletion before FK cascades run.
DO $test$
DECLARE v_count integer;
BEGIN
  BEGIN
    DELETE FROM public.organizations
    WHERE id = '00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'TEST FAILED: organization with active distribution was deleted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  SELECT count(*) INTO v_count FROM public.organizations
  WHERE id = '00000000-0000-0000-0000-000000000001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: organization disappeared after blocked delete';
  END IF;
END;
$test$;

-- Once the distribution is reversed, the organization and its dependent rows may cascade.
UPDATE public.profit_distributions SET status = 'reversed'
WHERE id = '00000000-0000-0000-0000-000000000031';

DELETE FROM public.organizations
WHERE id = '00000000-0000-0000-0000-000000000001';

DO $test$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.organizations
  WHERE id = '00000000-0000-0000-0000-000000000001';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: organization deletion after reversal did not proceed';
  END IF;
END;
$test$;

\echo 'Synthetic organization deletion guard tests passed.'
