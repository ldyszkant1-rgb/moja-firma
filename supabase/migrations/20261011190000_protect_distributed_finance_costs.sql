-- Protect costs referenced by an active profit distribution from edits/deletion.
-- This is a database-level guard; the UI guard remains useful for a clearer message.
-- Reversed distributions intentionally do not block changes.

CREATE OR REPLACE FUNCTION public.prevent_mutation_of_distributed_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.type = 'cost' AND EXISTS (
    SELECT 1
    FROM public.profit_distributions AS d
    WHERE d.organization_id = OLD.organization_id
      AND d.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements_text(
          COALESCE(d.cost_ids, '[]'::jsonb)
        ) AS cost_id(value)
        WHERE cost_id.value = OLD.id::text
      )
  ) THEN
    RAISE EXCEPTION
      'Nie można edytować ani usunąć kosztu uwzględnionego w aktywnym rozliczeniu. Najpierw cofnij to rozliczenie w historii.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_mutation_of_distributed_cost() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_mutation_of_distributed_cost() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_mutation_of_distributed_cost() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_mutation_of_distributed_cost ON public.finance;
CREATE TRIGGER prevent_mutation_of_distributed_cost
BEFORE UPDATE OR DELETE ON public.finance
FOR EACH ROW
EXECUTE FUNCTION public.prevent_mutation_of_distributed_cost();
