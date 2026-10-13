-- Keep FK cascades from bypassing financial-allocation integrity.
-- An organization with active profit distributions must be reversed first.
CREATE OR REPLACE FUNCTION public.prevent_delete_org_with_active_distributions()
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
      AND d.status = 'active'
  ) THEN
    RAISE EXCEPTION
      'Nie można usunąć organizacji z aktywnym rozliczeniem. Najpierw cofnij rozliczenie.'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_delete_org_with_active_distributions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_delete_org_with_active_distributions() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_delete_org_with_active_distributions() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_delete_org_with_active_distributions ON public.organizations;
CREATE TRIGGER prevent_delete_org_with_active_distributions
BEFORE DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_org_with_active_distributions();
