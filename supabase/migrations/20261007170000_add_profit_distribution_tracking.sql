-- Profit distributions: each payout remembers exactly which payments and costs were already used.
-- This prevents a cost such as ZUS from being deducted again when another client payment arrives.
-- Existing costs are marked as already accounted for once; future costs are picked up by the next distribution.

begin;

create table if not exists public.profit_distributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  distribution_date date not null default current_date,
  received_net numeric(14,2) not null default 0,
  costs_net numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  lukasz_share numeric(14,2) not null default 0,
  pawel_share numeric(14,2) not null default 0,
  payment_ids jsonb not null default '[]'::jsonb,
  cost_ids jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profit_distributions enable row level security;

revoke all on table public.profit_distributions from anon, authenticated;
grant select, insert, update, delete on table public.profit_distributions to authenticated;

drop policy if exists tenant_select_authenticated on public.profit_distributions;
drop policy if exists tenant_insert_authenticated on public.profit_distributions;
drop policy if exists tenant_update_authenticated on public.profit_distributions;
drop policy if exists tenant_delete_authenticated on public.profit_distributions;

create policy tenant_select_authenticated
  on public.profit_distributions
  for select
  to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy tenant_insert_authenticated
  on public.profit_distributions
  for insert
  to authenticated
  with check (organization_id = (select private.current_organization_id()));

create policy tenant_update_authenticated
  on public.profit_distributions
  for update
  to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy tenant_delete_authenticated
  on public.profit_distributions
  for delete
  to authenticated
  using (organization_id = (select private.current_organization_id()));

create index if not exists profit_distributions_organization_date_idx
  on public.profit_distributions (organization_id, distribution_date, created_at);

insert into public.profit_distributions
  (organization_id, distribution_date, received_net, costs_net, profit, lukasz_share, pawel_share, payment_ids, cost_ids, note)
select
  o.id,
  current_date,
  0, 0, 0, 0, 0,
  coalesce(
    (
      select jsonb_agg(to_jsonb(p.id))
      from public.job_payments p
      where p.organization_id = o.id
        and p.paid_at < current_date
    ),
    '[]'::jsonb
  ),
  coalesce(
    (
      select jsonb_agg(to_jsonb(f.id))
      from public.finance f
      where f.organization_id = o.id
        and f.type = 'cost'
    ),
    '[]'::jsonb
  ),
  'Punkt startowy: istniejące koszty zostały uznane za już rozliczone przed uruchomieniem śledzenia kolejnych podziałów.'
from public.organizations o
where o.id = 'c6565617-8988-41aa-899a-e0c21327d8fe'
  and not exists (
    select 1
    from public.profit_distributions pd
    where pd.organization_id = o.id
  );

commit;

-- Rollback (manual, only if this feature must be reverted):
-- drop index if exists public.profit_distributions_organization_date_idx;
-- drop table if exists public.profit_distributions;
