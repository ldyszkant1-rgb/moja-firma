-- Synthetic isolated schema only. Never run against production.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
END;
$roles$;

CREATE TABLE public.organizations (id uuid PRIMARY KEY);

CREATE TABLE public.finance (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  marker integer NOT NULL DEFAULT 0
);

CREATE TABLE public.job_payments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  marker integer NOT NULL DEFAULT 0
);

CREATE TABLE public.profit_distributions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reversed')),
  reversed_at timestamptz,
  reversal_reason text,
  reversed_from_id uuid,
  cost_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE public.test_trigger_source (id uuid PRIMARY KEY, marker integer NOT NULL DEFAULT 0);

-- Placeholder function is replaced by the migration under test.
CREATE FUNCTION public.prevent_mutation_of_allocated_financial_rows()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_allocated_finance_mutation
BEFORE UPDATE OR DELETE ON public.finance
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation_of_allocated_financial_rows();

CREATE TRIGGER prevent_allocated_job_payment_mutation
BEFORE UPDATE OR DELETE ON public.job_payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation_of_allocated_financial_rows();

CREATE FUNCTION public.test_nested_finance_update()
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

INSERT INTO public.organizations(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');

INSERT INTO public.finance(id, organization_id, marker) VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',0),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002',0);

INSERT INTO public.job_payments(id, organization_id, marker) VALUES
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001',0);

INSERT INTO public.profit_distributions(id, organization_id, status, cost_ids, payment_ids) VALUES
 ('00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000001','active',
  '["00000000-0000-0000-0000-000000000011"]'::jsonb,
  '["00000000-0000-0000-0000-000000000021"]'::jsonb);

INSERT INTO public.test_trigger_source(id, marker)
VALUES ('00000000-0000-0000-0000-000000000099',0);
