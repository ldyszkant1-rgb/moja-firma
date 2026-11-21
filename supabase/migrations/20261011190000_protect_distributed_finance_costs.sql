-- Keep the existing financial-allocation guard, but allow rows to be removed
-- by FK cascades (for example, deleting an organization). Direct UPDATE/DELETE
-- statements still cannot mutate rows referenced by active profit distributions.
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

  -- pg_trigger_depth() is 1 for a direct statement and greater than 1 when
  -- this row operation is invoked from another trigger (including FK cascades).
  IF pg_catalog.pg_trigger_depth() = 1 THEN
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
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
