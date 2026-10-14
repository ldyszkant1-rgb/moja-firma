-- Rebuild all Aeroinstal Storage policies with explicit outer object path qualification.
-- This avoids resolving "name" to public.jobs.name inside EXISTS subqueries.

drop policy if exists "Aeroinstal files - select" on storage.objects;
drop policy if exists "Aeroinstal files - upload" on storage.objects;
drop policy if exists "Aeroinstal files - update" on storage.objects;
drop policy if exists "Aeroinstal files - delete" on storage.objects;

create policy "Aeroinstal files - select"
on storage.objects for select to authenticated
using (
  bucket_id = 'aeroinstal-files'
  and (storage.foldername(objects.name))[1] = 'jobs'
  and exists (
    select 1 from public.jobs j
    where j.id::text = (storage.foldername(objects.name))[2]
      and j.organization_id = (select private.current_organization_id())
  )
);

create policy "Aeroinstal files - upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'aeroinstal-files'
  and (storage.foldername(objects.name))[1] = 'jobs'
  and exists (
    select 1 from public.jobs j
    where j.id::text = (storage.foldername(objects.name))[2]
      and j.organization_id = (select private.current_organization_id())
  )
);

create policy "Aeroinstal files - update"
on storage.objects for update to authenticated
using (
  bucket_id = 'aeroinstal-files'
  and (storage.foldername(objects.name))[1] = 'jobs'
  and exists (
    select 1 from public.jobs j
    where j.id::text = (storage.foldername(objects.name))[2]
      and j.organization_id = (select private.current_organization_id())
  )
)
with check (
  bucket_id = 'aeroinstal-files'
  and (storage.foldername(objects.name))[1] = 'jobs'
  and exists (
    select 1 from public.jobs j
    where j.id::text = (storage.foldername(objects.name))[2]
      and j.organization_id = (select private.current_organization_id())
  )
);

create policy "Aeroinstal files - delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'aeroinstal-files'
  and (storage.foldername(objects.name))[1] = 'jobs'
  and exists (
    select 1 from public.jobs j
    where j.id::text = (storage.foldername(objects.name))[2]
      and j.organization_id = (select private.current_organization_id())
  )
);
