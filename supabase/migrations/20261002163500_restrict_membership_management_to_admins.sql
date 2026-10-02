create or replace function private.is_organization_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  );
$$;

revoke all on function private.is_organization_admin(uuid) from public, anon, authenticated;
grant execute on function private.is_organization_admin(uuid) to authenticated;

drop policy if exists organization_members_insert on public.organization_members;
drop policy if exists organization_members_update on public.organization_members;
drop policy if exists organization_members_delete on public.organization_members;

create policy organization_members_insert
on public.organization_members for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (select private.is_organization_admin(organization_id))
);

create policy organization_members_update
on public.organization_members for update to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.is_organization_admin(organization_id))
)
with check (
  organization_id = (select private.current_organization_id())
  and (select private.is_organization_admin(organization_id))
);

create policy organization_members_delete
on public.organization_members for delete to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.is_organization_admin(organization_id))
);
