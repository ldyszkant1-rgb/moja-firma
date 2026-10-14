-- Keep the allocation guard active for direct and trigger-nested mutations.
-- Organization deletion/cascade behavior is handled as a separate design decision;
-- do not bypass the guard globally based on pg_trigger_depth().
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
    RAISE EXCEPTION 'Nieobsługiwana tabela finansowa.'
      USING ERRCODE = '22023';
  END IF;

  IF v_is_allocated THEN
    RAISE EXCEPTION
      'Nie można edytować ani usuwać pozycji przypisanej do aktywnego podziału zysku. Najpierw cofnij podział.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
