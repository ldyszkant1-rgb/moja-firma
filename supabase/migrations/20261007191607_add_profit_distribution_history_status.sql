-- Compatibility migration for the version already recorded in production.
-- The canonical fresh-install migration includes these fields; on older installations,
-- ensure lifecycle metadata exists without overwriting explicit reversal state.
BEGIN;

ALTER TABLE public.profit_distributions
  ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.profit_distributions
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE public.profit_distributions
  ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE public.profit_distributions
  ADD COLUMN IF NOT EXISTS reversed_from_id uuid;

UPDATE public.profit_distributions
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.profit_distributions
  ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.profit_distributions
  ALTER COLUMN status SET NOT NULL;

DO $lifecycle_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profit_distributions'::regclass
      AND conname = 'profit_distributions_status_check'
  ) THEN
    ALTER TABLE public.profit_distributions
      ADD CONSTRAINT profit_distributions_status_check
      CHECK (status IN ('active', 'reversed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profit_distributions'::regclass
      AND conname = 'profit_distributions_reversed_from_id_fkey'
      AND contype = 'f'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.profit_distributions child
      LEFT JOIN public.profit_distributions parent
        ON parent.id = child.reversed_from_id
      WHERE child.reversed_from_id IS NOT NULL
        AND parent.id IS NULL
    ) THEN
      RAISE EXCEPTION
        'Cannot add reversal self-FK: orphan reversal references exist; review them before retrying';
    END IF;

    ALTER TABLE public.profit_distributions
      ADD CONSTRAINT profit_distributions_reversed_from_id_fkey
      FOREIGN KEY (reversed_from_id)
      REFERENCES public.profit_distributions(id)
      ON DELETE NO ACTION;
  END IF;
END;
$lifecycle_constraints$;

COMMIT;
