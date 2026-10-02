alter table public.organization_members add column if not exists email text;
update public.organization_members om
set email = u.email
from auth.users u
where u.id = om.user_id and om.email is null;
create index if not exists organization_members_email_idx on public.organization_members(lower(email));

create or replace function private.is_organization_owner(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'owner'
  );
$$;

revoke all on function private.is_organization_owner(uuid) from public, anon, authenticated;
grant execute on function private.is_organization_owner(uuid) to authenticated;

drop policy if exists organization_members_insert on public.organization_members;
drop policy if exists organization_members_update on public.organization_members;
drop policy if exists organization_members_delete on public.organization_members;

create policy organization_members_insert on public.organization_members
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (
    (select private.is_organization_owner(organization_id))
    or (role = 'employee' and (select private.is_organization_admin(organization_id)))
  )
);

create policy organization_members_update on public.organization_members
for update to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (
    (select private.is_organization_owner(organization_id))
    or ((select private.is_organization_admin(organization_id)) and role <> 'owner')
  )
)
with check (
  organization_id = (select private.current_organization_id())
  and (
    (select private.is_organization_owner(organization_id))
    or ((select private.is_organization_admin(organization_id)) and role <> 'owner')
  )
);

create policy organization_members_delete on public.organization_members
for delete to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (
    ((select private.is_organization_owner(organization_id)) and user_id <> (select auth.uid()))
    or ((select private.is_organization_admin(organization_id)) and role = 'employee')
  )
);

revoke all on function public.create_organization(text,text,text) from public, anon, authenticated;
