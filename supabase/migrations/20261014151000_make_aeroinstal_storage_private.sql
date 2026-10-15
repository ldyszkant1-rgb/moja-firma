-- Apply only after the signed-URL frontend has been deployed and verified,
-- and after legacy Storage objects and their references have been audited.
-- This migration is intentionally NOT applied automatically by the PR.
do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'aeroinstal-files'
  ) then
    raise exception 'Required Storage bucket aeroinstal-files does not exist';
  end if;

  update storage.buckets
  set
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/csv',
      'text/plain',
      'application/zip',
      'application/acad',
      'application/dxf'
    ]
  where id = 'aeroinstal-files';
end;
$$;
