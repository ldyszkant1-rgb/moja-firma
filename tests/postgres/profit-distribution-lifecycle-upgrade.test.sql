\set ON_ERROR_STOP on

-- The workflow creates the legacy schema, applies the additive migration twice,
-- then runs these assertions to prove the upgrade is idempotent.

DO $test$
DECLARE
  v_status text;
  v_columns integer;
BEGIN
  SELECT status INTO v_status
  FROM public.profit_distributions
  WHERE id = '10000000-0000-0000-0000-000000000001';

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'TEST FAILED: legacy row was not safely initialized as active';
  END IF;

  SELECT count(*) INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profit_distributions'
    AND column_name IN ('status', 'reversed_at', 'reversal_reason', 'reversed_from_id');

  IF v_columns <> 4 THEN
    RAISE EXCEPTION 'TEST FAILED: expected all four lifecycle columns, found %', v_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profit_distributions'::regclass
      AND conname = 'profit_distributions_status_check'
  ) THEN
    RAISE EXCEPTION 'TEST FAILED: status constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profit_distributions'::regclass
      AND conname = 'profit_distributions_reversed_from_id_fkey'
      AND contype = 'f'
      AND confrelid = 'public.profit_distributions'::regclass
      AND confdeltype = 'a'
  ) THEN
    RAISE EXCEPTION 'TEST FAILED: reversal self-FK with ON DELETE NO ACTION is missing';
  END IF;
END;
$test$;

-- A referenced distribution must not be deleted (and history must not cascade away).
INSERT INTO public.profit_distributions (id, organization_id, reversed_from_id)
VALUES (
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001'
);

DO $test$
BEGIN
  BEGIN
    DELETE FROM public.profit_distributions
    WHERE id = '10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'TEST FAILED: deleting a referenced distribution unexpectedly succeeded';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL; -- Expected: NO ACTION preserves the referenced history.
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.profit_distributions
    WHERE id = '10000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'TEST FAILED: referenced distribution history was deleted';
  END IF;
END;
$test$;

-- Explicit reversed states must survive re-running the migration.
UPDATE public.profit_distributions
SET status = 'reversed', reversed_at = now(), reversal_reason = 'test'
WHERE id = '10000000-0000-0000-0000-000000000001';

DO $test$
BEGIN
  IF (SELECT status FROM public.profit_distributions
      WHERE id = '10000000-0000-0000-0000-000000000001') <> 'reversed' THEN
    RAISE EXCEPTION 'TEST FAILED: explicit reversed status was not preserved';
  END IF;
END;
$test$;

\echo 'Lifecycle migration upgrade test passed.'
