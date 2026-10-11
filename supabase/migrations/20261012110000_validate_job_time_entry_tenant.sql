-- Time entries must reference a job within the same tenant.
-- The production audit found no existing invalid/orphan job references.

drop policy if exists "job time insert current organization" on public.job_time_entries;
create policy "job time insert current organization" on public.job_time_entries
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and exists (
    select 1 from public.jobs j
    where j.id = job_time_entries.job_id
      and j.organization_id = job_time_entries.organization_id
  )
);

drop policy if exists "job time update current organization" on public.job_time_entries;
create policy "job time update current organization" on public.job_time_entries
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and exists (
    select 1 from public.jobs j
    where j.id = job_time_entries.job_id
      and j.organization_id = job_time_entries.organization_id
  )
);
