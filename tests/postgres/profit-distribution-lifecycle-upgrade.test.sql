\set ON_ERROR_STOP on

-- Simulate a database where the original tracking table exists but lifecycle columns do not.
CREATE TABLE public.profit_distributions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  cost_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

INSERT INTO public.profit_distributions (id, organization_id)
VALUES ('10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002');

\echo 'Legacy schema created; apply the additive migration twice from the workflow.'

-- The workflow invokes the additive migration twice before this file.
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
