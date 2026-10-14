-- Apply only after the signed-URL frontend has been deployed and verified.
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
  set public = false
  where id = 'aeroinstal-files';
end;
$$;
