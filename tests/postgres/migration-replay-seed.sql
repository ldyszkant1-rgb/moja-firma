-- Test data is loaded only after the migrations under test have been replayed.
INSERT INTO public.organizations(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');

INSERT INTO public.finance(id, organization_id, type, marker) VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','cost',0),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','cost',0);

INSERT INTO public.job_payments(id, organization_id, paid_at, marker) VALUES
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001',now(),0);

INSERT INTO public.profit_distributions
  (id, organization_id, status, cost_ids, payment_ids)
VALUES
 ('00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000001','active',
  '["00000000-0000-0000-0000-000000000011"]'::jsonb,
  '["00000000-0000-0000-0000-000000000021"]'::jsonb);

CREATE OR REPLACE FUNCTION public.test_nested_finance_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.finance SET marker = marker + 1
  WHERE id = '00000000-0000-0000-0000-000000000011';
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_nested_finance_update
AFTER UPDATE ON public.test_trigger_source
FOR EACH ROW EXECUTE FUNCTION public.test_nested_finance_update();

INSERT INTO public.test_trigger_source(id, marker)
VALUES ('00000000-0000-0000-0000-000000000099',0);
