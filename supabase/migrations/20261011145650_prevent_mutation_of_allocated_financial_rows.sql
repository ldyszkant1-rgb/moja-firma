-- Protect financial rows referenced by active profit distributions.
CREATE OR REPLACE FUNCTION public.prevent_mutation_of_allocated_financial_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row_id text := OLD.id::text;
  v_org_id uuid := OLD.organization_id;
  v_is_allocated boolean := false;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_org_id::text, 0)
  );

  IF TG_TABLE_NAME = 'finance' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profit_distributions AS d
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(
        COALESCE(d.cost_ids, '[]'::jsonb)
      ) AS x(value)
      WHERE d.organization_id = v_org_id
        AND d.status = 'active'
        AND x.value = v_row_id
    ) INTO v_is_allocated;
  ELSIF TG_TABLE_NAME = 'job_payments' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profit_distributions AS d
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(
        COALESCE(d.payment_ids, '[]'::jsonb)
      ) AS x(value)
      WHERE d.organization_id = v_org_id
        AND d.status = 'active'
        AND x.value = v_row_id
    ) INTO v_is_allocated;
  ELSE
    RAISE EXCEPTION 'Nieobsługiwana tabela finansowa.' USING ERRCODE = '22023';
  END IF;

  IF v_is_allocated THEN
    RAISE EXCEPTION 'Nie można edytować ani usuwać pozycji przypisanej do aktywnego podziału zysku. Najpierw cofnij podział.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_mutation_of_allocated_financial_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_mutation_of_allocated_financial_rows() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_mutation_of_allocated_financial_rows() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_allocated_finance_mutation ON public.finance;
CREATE TRIGGER prevent_allocated_finance_mutation
BEFORE UPDATE OR DELETE ON public.finance
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation_of_allocated_financial_rows();

DROP TRIGGER IF EXISTS prevent_allocated_job_payment_mutation ON public.job_payments;
CREATE TRIGGER prevent_allocated_job_payment_mutation
BEFORE UPDATE OR DELETE ON public.job_payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation_of_allocated_financial_rows();
