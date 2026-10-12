-- Harden Storage object mutations without changing the bucket's public-read behavior.
-- Keep the existing policy names and do not drop/recreate any read policy.
-- The application currently stores and renders public URLs; changing bucket visibility
-- requires a separate application migration to signed URLs.

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE storage.objects
  FROM anon, authenticated;

DROP POLICY IF EXISTS "Aeroinstal files - upload" ON storage.objects;
CREATE POLICY "Aeroinstal files - upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'aeroinstal-files'
  AND (storage.foldername(name))[1] = 'jobs'
  AND EXISTS (
    SELECT 1
    FROM public.jobs AS j
    WHERE j.id::text = (storage.foldername(name))[2]
      AND j.organization_id = private.current_organization_id()
  )
);

DROP POLICY IF EXISTS "Aeroinstal files - update" ON storage.objects;
CREATE POLICY "Aeroinstal files - update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'aeroinstal-files'
  AND (storage.foldername(name))[1] = 'jobs'
  AND EXISTS (
    SELECT 1
    FROM public.jobs AS j
    WHERE j.id::text = (storage.foldername(name))[2]
      AND j.organization_id = private.current_organization_id()
  )
)
WITH CHECK (
  bucket_id = 'aeroinstal-files'
  AND (storage.foldername(name))[1] = 'jobs'
  AND EXISTS (
    SELECT 1
    FROM public.jobs AS j
    WHERE j.id::text = (storage.foldername(name))[2]
      AND j.organization_id = private.current_organization_id()
  )
);

DROP POLICY IF EXISTS "Aeroinstal files - delete" ON storage.objects;
CREATE POLICY "Aeroinstal files - delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'aeroinstal-files'
  AND (storage.foldername(name))[1] = 'jobs'
  AND EXISTS (
    SELECT 1
    FROM public.jobs AS j
    WHERE j.id::text = (storage.foldername(name))[2]
      AND j.organization_id = private.current_organization_id()
  )
);
