-- Prevent offers from referencing records owned by another organization.
-- Missing legacy references are tolerated so historical offers remain editable;
-- references that resolve to an existing row must belong to the offer's organization.

drop policy if exists tenant_insert_authenticated on public.offers;
create policy tenant_insert_authenticated
on public.offers for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (client_id is null or not exists (
    select 1 from public.clients c where c.id = offers.client_id
  ) or exists (
    select 1 from public.clients c
    where c.id = offers.client_id and c.organization_id = offers.organization_id
  ))
  and (source_job_id is null or not exists (
    select 1 from public.jobs j where j.id = offers.source_job_id
  ) or exists (
    select 1 from public.jobs j
    where j.id = offers.source_job_id and j.organization_id = offers.organization_id
  ))
  and (converted_job_id is null or not exists (
    select 1 from public.jobs j where j.id = offers.converted_job_id
  ) or exists (
    select 1 from public.jobs j
    where j.id = offers.converted_job_id and j.organization_id = offers.organization_id
  ))
);

drop policy if exists tenant_update_authenticated on public.offers;
create policy tenant_update_authenticated
on public.offers for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and (client_id is null or not exists (
    select 1 from public.clients c where c.id = offers.client_id
  ) or exists (
    select 1 from public.clients c
    where c.id = offers.client_id and c.organization_id = offers.organization_id
  ))
  and (source_job_id is null or not exists (
    select 1 from public.jobs j where j.id = offers.source_job_id
  ) or exists (
    select 1 from public.jobs j
    where j.id = offers.source_job_id and j.organization_id = offers.organization_id
  ))
  and (converted_job_id is null or not exists (
    select 1 from public.jobs j where j.id = offers.converted_job_id
  ) or exists (
    select 1 from public.jobs j
    where j.id = offers.converted_job_id and j.organization_id = offers.organization_id
  ))
);
