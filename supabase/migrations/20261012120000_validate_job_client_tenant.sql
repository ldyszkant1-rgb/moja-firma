-- Keep a job's optional client inside the same organization.
-- Production integrity audit found no cross-organization references.

drop policy if exists "tenant_insert_authenticated" on public.jobs;
create policy "tenant_insert_authenticated" on public.jobs
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (
    client_id is null
    or exists (
      select 1
      from public.clients c
      where c.id = jobs.client_id
        and c.organization_id = jobs.organization_id
    )
  )
);

drop policy if exists "tenant_update_authenticated" on public.jobs;
create policy "tenant_update_authenticated" on public.jobs
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and (
    client_id is null
    or exists (
      select 1
      from public.clients c
      where c.id = jobs.client_id
        and c.organization_id = jobs.organization_id
    )
  )
);
