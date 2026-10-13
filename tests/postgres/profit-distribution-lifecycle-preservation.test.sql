\set ON_ERROR_STOP on
DO $test$
BEGIN
  IF (SELECT status FROM public.profit_distributions
      WHERE id = '10000000-0000-0000-0000-000000000001') <> 'reversed' THEN
    RAISE EXCEPTION 'TEST FAILED: migration did not preserve explicit reversed status';
  END IF;
END;
$test$;
\echo 'Explicit reversed status preserved after migration rerun.'
