\set ON_ERROR_STOP on

-- Direct UPDATE of a cost assigned to an active distribution must be blocked.
DO $test$
DECLARE v_marker integer;
BEGIN
  BEGIN
    UPDATE public.finance SET marker = marker + 1
    WHERE id = '00000000-0000-0000-0000-000000000011';
    RAISE EXCEPTION 'TEST FAILED: direct cost UPDATE was not blocked';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  SELECT marker INTO v_marker FROM public.finance
  WHERE id = '00000000-0000-0000-0000-000000000011';
  IF v_marker <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: direct UPDATE changed allocated cost';
  END IF;
END;
$test$;

-- DELETE of an allocated payment must be blocked.
DO $test$
DECLARE v_count integer;
BEGIN
  BEGIN
    DELETE FROM public.job_payments
    WHERE id = '00000000-0000-0000-0000-000000000021';
    RAISE EXCEPTION 'TEST FAILED: allocated payment DELETE was not blocked';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  SELECT count(*) INTO v_count FROM public.job_payments
  WHERE id = '00000000-0000-0000-0000-000000000021';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: allocated payment was deleted';
  END IF;
END;
$test$;

-- A nested trigger must not bypass the guard. The outer statement is rolled back.
DO $test$
DECLARE v_marker integer;
BEGIN
  BEGIN
    UPDATE public.test_trigger_source SET marker = marker + 1
    WHERE id = '00000000-0000-0000-0000-000000000099';
    RAISE EXCEPTION 'TEST FAILED: nested finance UPDATE was not blocked';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  SELECT marker INTO v_marker FROM public.finance
  WHERE id = '00000000-0000-0000-0000-000000000011';
  IF v_marker <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: nested trigger changed allocated cost';
  END IF;
END;
$test$;

-- Reversal removes the active-allocation protection.
UPDATE public.profit_distributions SET status = 'reversed'
WHERE id = '00000000-0000-0000-0000-000000000031';
UPDATE public.finance SET marker = marker + 1
WHERE id = '00000000-0000-0000-0000-000000000011';

DO $test$
DECLARE v_marker integer;
BEGIN
  SELECT marker INTO v_marker FROM public.finance
  WHERE id = '00000000-0000-0000-0000-000000000011';
  IF v_marker <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: UPDATE after reversal did not succeed';
  END IF;
END;
$test$;

-- A cost from another organization is not accidentally blocked.
UPDATE public.finance SET marker = marker + 1
WHERE id = '00000000-0000-0000-0000-000000000012';

DO $test$
DECLARE v_marker integer;
BEGIN
  SELECT marker INTO v_marker FROM public.finance
  WHERE id = '00000000-0000-0000-0000-000000000012';
  IF v_marker <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: unrelated organization cost was blocked';
  END IF;
END;
$test$;

\echo 'All synthetic financial guard tests passed.'
