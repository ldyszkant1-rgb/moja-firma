-- Keep partner transfers tied to settlements in the same organization and reject invalid transfers.
CREATE OR REPLACE FUNCTION public.validate_partner_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Organizacja przelewu jest wymagana.' USING ERRCODE = '22023';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Kwota przelewu musi być dodatnia i prawidłowa.' USING ERRCODE = '22023';
  END IF;

  IF NEW.from_person IS NULL OR NEW.to_person IS NULL OR NEW.from_person = NEW.to_person THEN
    RAISE EXCEPTION 'Nadawca i odbiorca przelewu muszą być różni.' USING ERRCODE = '22023';
  END IF;

  IF NEW.settlement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.partner_settlements s
    WHERE s.id = NEW.settlement_id
      AND s.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Rozliczenie przelewu nie należy do tej organizacji.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_partner_transfer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_partner_transfer() FROM anon;
REVOKE ALL ON FUNCTION public.validate_partner_transfer() FROM authenticated;

DROP TRIGGER IF EXISTS validate_partner_transfer_before_write ON public.partner_transfers;
CREATE TRIGGER validate_partner_transfer_before_write
BEFORE INSERT OR UPDATE OF organization_id, settlement_id, from_person, to_person, amount
ON public.partner_transfers
FOR EACH ROW
EXECUTE FUNCTION public.validate_partner_transfer();
