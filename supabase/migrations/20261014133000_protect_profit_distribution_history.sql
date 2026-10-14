-- Profit distributions are an audit trail. Reversals must be represented by
-- status = 'reversed'; direct deletion must never erase the history.
CREATE OR REPLACE FUNCTION public.prevent_delete_profit_distribution_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION
    'Nie można usunąć historii rozliczenia wspólników. Użyj operacji cofnięcia rozliczenia.'
    USING ERRCODE = '23514';
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_delete_profit_distribution_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_delete_profit_distribution_history() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_delete_profit_distribution_history() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_delete_profit_distribution_history
  ON public.profit_distributions;
CREATE TRIGGER prevent_delete_profit_distribution_history
BEFORE DELETE ON public.profit_distributions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_profit_distribution_history();

-- Defense in depth: clients should not receive table-level DELETE permission.
REVOKE DELETE ON TABLE public.profit_distributions FROM PUBLIC, anon, authenticated;
