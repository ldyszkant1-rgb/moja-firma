-- Preserve the audit trail: organizations with any profit-distribution history
-- must not be deleted, even after distributions are reversed.
CREATE OR REPLACE FUNCTION public.prevent_delete_org_with_distribution_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD.id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.profit_distributions AS d
    WHERE d.organization_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Nie można usunąć organizacji z historią rozliczeń wspólników. Zachowaj historię albo skorzystaj z osobnej procedury archiwizacji.'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_delete_org_with_distribution_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_delete_org_with_distribution_history() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_delete_org_with_distribution_history() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_delete_org_with_active_distributions ON public.organizations;
DROP TRIGGER IF EXISTS prevent_delete_org_with_distribution_history ON public.organizations;
CREATE TRIGGER prevent_delete_org_with_distribution_history
BEFORE DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_org_with_distribution_history();
