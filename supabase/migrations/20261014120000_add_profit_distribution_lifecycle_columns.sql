-- Upgrade databases where the original tracking migration was already recorded.
-- Existing rows without lifecycle metadata are treated as active allocations so their
-- referenced costs/payments remain protected. Existing explicit 'reversed' values are preserved.
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

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profit_distributions'::regclass
      AND conname = 'profit_distributions_status_check'
  ) THEN
    ALTER TABLE public.profit_distributions
      ADD CONSTRAINT profit_distributions_status_check
      CHECK (status IN ('active', 'reversed'));
  END IF;
END;
$constraint$;

COMMIT;
