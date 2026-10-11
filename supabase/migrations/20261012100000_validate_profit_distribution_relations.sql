-- Enforce tenant consistency for profit-share jobs and distribution reversals.
-- Historical orphan references are tolerated, but references resolving to another
-- organization's row are rejected.

drop policy if exists "job profit shares insert current organization" on public.job_profit_shares;
create policy "job profit shares insert current organization" on public.job_profit_shares
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and exists (
    select 1 from public.jobs j
    where j.id = job_profit_shares.job_id
      and j.organization_id = job_profit_shares.organization_id
  )
);

drop policy if exists "job profit shares update current organization" on public.job_profit_shares;
create policy "job profit shares update current organization" on public.job_profit_shares
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and exists (
    select 1 from public.jobs j
    where j.id = job_profit_shares.job_id
      and j.organization_id = job_profit_shares.organization_id
  )
);

drop policy if exists tenant_insert_authenticated on public.profit_distributions;
create policy tenant_insert_authenticated on public.profit_distributions
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (
    reversed_from_id is null
    or not exists (
      select 1 from public.profit_distributions original
      where original.id = profit_distributions.reversed_from_id
    )
    or exists (
      select 1 from public.profit_distributions original
      where original.id = profit_distributions.reversed_from_id
        and original.organization_id = profit_distributions.organization_id
    )
  )
);

drop policy if exists tenant_update_authenticated on public.profit_distributions;
create policy tenant_update_authenticated on public.profit_distributions
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and (
    reversed_from_id is null
    or not exists (
      select 1 from public.profit_distributions original
      where original.id = profit_distributions.reversed_from_id
    )
    or exists (
      select 1 from public.profit_distributions original
      where original.id = profit_distributions.reversed_from_id
        and original.organization_id = profit_distributions.organization_id
    )
  )
);
