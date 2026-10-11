-- Prevent the same payment or cost from being allocated to multiple active profit distributions.
-- Serialize writes per organization so concurrent requests cannot bypass the uniqueness check.
CREATE OR REPLACE FUNCTION public.validate_profit_distribution_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payment_id text;
  v_cost_id text;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Organizacja podziału jest wymagana.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.organization_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements_text(COALESCE(NEW.payment_ids, '[]'::jsonb)) AS x(value)
    GROUP BY x.value HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ta sama wpłata została wybrana więcej niż raz.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements_text(COALESCE(NEW.cost_ids, '[]'::jsonb)) AS x(value)
    GROUP BY x.value HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ten sam koszt został wybrany więcej niż raz.' USING ERRCODE = '22023';
  END IF;

  FOR v_payment_id IN
    SELECT DISTINCT x.value
    FROM pg_catalog.jsonb_array_elements_text(COALESCE(NEW.payment_ids, '[]'::jsonb)) AS x(value)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.job_payments p
      WHERE p.id::text = v_payment_id AND p.organization_id <> NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Wpłata nie należy do organizacji podziału.' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  FOR v_cost_id IN
    SELECT DISTINCT x.value
    FROM pg_catalog.jsonb_array_elements_text(COALESCE(NEW.cost_ids, '[]'::jsonb)) AS x(value)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.finance f
      WHERE f.id::text = v_cost_id AND f.organization_id <> NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Koszt nie należy do organizacji podziału.' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NEW.status = 'active' THEN
    IF EXISTS (
      SELECT 1
      FROM public.profit_distributions d
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(COALESCE(d.payment_ids, '[]'::jsonb)) AS existing_payment(value)
      WHERE d.organization_id = NEW.organization_id
        AND d.status = 'active'
        AND d.id IS DISTINCT FROM NEW.id
        AND existing_payment.value IN (
          SELECT x.value FROM pg_catalog.jsonb_array_elements_text(COALESCE(NEW.payment_ids, '[]'::jsonb)) AS x(value)
        )
    ) THEN
      RAISE EXCEPTION 'Co najmniej jedna wpłata jest już przypisana do innego aktywnego podziału.' USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.profit_distributions d
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(COALESCE(d.cost_ids, '[]'::jsonb)) AS existing_cost(value)
      WHERE d.organization_id = NEW.organization_id
        AND d.status = 'active'
        AND d.id IS DISTINCT FROM NEW.id
        AND existing_cost.value IN (
          SELECT x.value FROM pg_catalog.jsonb_array_elements_text(COALESCE(NEW.cost_ids, '[]'::jsonb)) AS x(value)
        )
    ) THEN
      RAISE EXCEPTION 'Co najmniej jeden koszt jest już przypisany do innego aktywnego podziału.' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_profit_distribution_allocation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_profit_distribution_allocation() FROM anon;
REVOKE ALL ON FUNCTION public.validate_profit_distribution_allocation() FROM authenticated;

DROP TRIGGER IF EXISTS validate_profit_distribution_allocation_before_write ON public.profit_distributions;
CREATE TRIGGER validate_profit_distribution_allocation_before_write
BEFORE INSERT OR UPDATE OF organization_id, status, payment_ids, cost_ids
ON public.profit_distributions
FOR EACH ROW
EXECUTE FUNCTION public.validate_profit_distribution_allocation();
