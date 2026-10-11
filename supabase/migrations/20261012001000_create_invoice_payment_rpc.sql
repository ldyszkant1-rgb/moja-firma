-- Create invoice payments atomically and prevent concurrent overpayments.
CREATE OR REPLACE FUNCTION public.create_invoice_payment(
  p_job_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_paid_at date DEFAULT CURRENT_DATE,
  p_note text DEFAULT NULL
)
RETURNS public.job_payments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid;
  v_invoice public.invoices%ROWTYPE;
  v_job_org_id uuid;
  v_existing_paid numeric;
  v_remaining numeric;
  v_payment public.job_payments%ROWTYPE;
BEGIN
  v_org_id := private.current_organization_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Brak aktywnej organizacji.' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'Robota i faktura są wymagane.' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Kwota wpłaty musi być dodatnia i prawidłowa.' USING ERRCODE = '22023';
  END IF;

  SELECT i.*
    INTO v_invoice
    FROM public.invoices AS i
   WHERE i.id = p_invoice_id
     AND i.organization_id = v_org_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono faktury w aktywnej organizacji.' USING ERRCODE = 'P0002';
  END IF;

  IF v_invoice.job_id IS DISTINCT FROM p_job_id THEN
    RAISE EXCEPTION 'Wybrana faktura nie należy do wskazanej roboty.' USING ERRCODE = '22023';
  END IF;

  SELECT j.organization_id
    INTO v_job_org_id
    FROM public.jobs AS j
   WHERE j.id = p_job_id
     AND j.organization_id = v_org_id;

  IF NOT FOUND OR v_job_org_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Nie znaleziono roboty w aktywnej organizacji.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
    INTO v_existing_paid
    FROM public.job_payments AS p
   WHERE p.invoice_id = p_invoice_id
     AND p.organization_id = v_org_id;

  v_remaining := GREATEST(
    0,
    COALESCE(v_invoice.gross_amount, 0)
      - v_existing_paid
      - COALESCE(v_invoice.vat_settled_amount, 0)
  );

  IF p_amount > v_remaining + 0.01 THEN
    RAISE EXCEPTION 'Wpłata przekracza pozostałą kwotę faktury. Pozostało: %', v_remaining
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.job_payments (
    organization_id, job_id, invoice_id, amount, paid_at, note
  )
  VALUES (
    v_org_id,
    p_job_id,
    p_invoice_id,
    p_amount,
    COALESCE(p_paid_at, CURRENT_DATE),
    NULLIF(pg_catalog.btrim(COALESCE(p_note, '')), '')
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_invoice_payment(uuid, uuid, numeric, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_invoice_payment(uuid, uuid, numeric, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_payment(uuid, uuid, numeric, date, text) TO authenticated;
