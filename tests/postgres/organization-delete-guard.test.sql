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

-- Reversing a distribution must not erase the audit history or permit a cascade delete.
UPDATE public.profit_distributions
SET status = 'reversed', reversed_at = now(), reversal_reason = 'test reversal'
WHERE id = '00000000-0000-0000-0000-000000000031';

DO $test$
DECLARE v_org_count integer;
DECLARE v_distribution_count integer;
BEGIN
  BEGIN
    DELETE FROM public.organizations
    WHERE id = '00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'TEST FAILED: organization with reversed history was deleted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  SELECT count(*) INTO v_org_count FROM public.organizations
  WHERE id = '00000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO v_distribution_count FROM public.profit_distributions
  WHERE id = '00000000-0000-0000-0000-000000000031';

  IF v_org_count <> 1 OR v_distribution_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: organization or distribution history was deleted';
  END IF;
END;
$test$;

-- Direct deletion of a reversed distribution must not erase the audit trail.
DO $test$
DECLARE v_count integer;
BEGIN
  BEGIN
    DELETE FROM public.profit_distributions
    WHERE id = '00000000-0000-0000-0000-000000000031';
    RAISE EXCEPTION 'TEST FAILED: reversed distribution history was deleted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  SELECT count(*) INTO v_count FROM public.profit_distributions
  WHERE id = '00000000-0000-0000-0000-000000000031';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: reversed distribution history did not survive DELETE';
  END IF;
END;
$test$;

\echo 'Synthetic organization and distribution deletion history guard tests passed.'
