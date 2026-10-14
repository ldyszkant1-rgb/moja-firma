-- Synthetic legacy schema for the additive migration upgrade test only.
CREATE TABLE public.profit_distributions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  cost_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

INSERT INTO public.profit_distributions (id, organization_id)
VALUES ('10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002');
