create schema if not exists private;

alter table public.organization_members add column if not exists email text;
update public.organization_members om set email=u.email from auth.users u where u.id=om.user_id and om.email is null;
create index if not exists organization_members_email_idx on public.organization_members(lower(email));

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'employee' check (role in ('admin','employee')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists organization_invitations_org_idx on public.organization_invitations(organization_id,status);
create index if not exists organization_invitations_email_idx on public.organization_invitations(lower(email),status);

alter table public.organization_invitations enable row level security;
revoke all on table public.organization_invitations from anon;
grant select,insert,update on table public.organization_invitations to authenticated;

create or replace function private.is_organization_owner(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
select exists(select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=(select auth.uid()) and om.role='owner');
$$;

revoke all on function private.is_organization_owner(uuid) from public,anon,authenticated;
grant execute on function private.is_organization_owner(uuid) to authenticated;

drop policy if exists organization_invitations_select on public.organization_invitations;
drop policy if exists organization_invitations_insert on public.organization_invitations;
drop policy if exists organization_invitations_update on public.organization_invitations;

create policy organization_invitations_select on public.organization_invitations for select to authenticated
using (organization_id=(select private.current_organization_id()) and (select private.is_organization_admin(organization_id)));

create policy organization_invitations_insert on public.organization_invitations for insert to authenticated
with check (organization_id=(select private.current_organization_id()) and invited_by=(select auth.uid()) and (select private.is_organization_admin(organization_id)));

create policy organization_invitations_update on public.organization_invitations for update to authenticated
using (organization_id=(select private.current_organization_id()) and (select private.is_organization_admin(organization_id)))
with check (organization_id=(select private.current_organization_id()) and (select private.is_organization_admin(organization_id)));

drop policy if exists organization_members_insert on public.organization_members;
drop policy if exists organization_members_update on public.organization_members;
drop policy if exists organization_members_delete on public.organization_members;

create policy organization_members_insert on public.organization_members for insert to authenticated
with check (
  organization_id=(select private.current_organization_id())
  and ((select private.is_organization_owner(organization_id)) or (role='employee' and (select private.is_organization_admin(organization_id))))
);

create policy organization_members_update on public.organization_members for update to authenticated
using (
  organization_id=(select private.current_organization_id())
  and ((select private.is_organization_owner(organization_id)) or ((select private.is_organization_admin(organization_id)) and role<>'owner'))
)
with check (
  organization_id=(select private.current_organization_id())
  and ((select private.is_organization_owner(organization_id)) or ((select private.is_organization_admin(organization_id)) and role<>'owner'))
);

create policy organization_members_delete on public.organization_members for delete to authenticated
using (
  organization_id=(select private.current_organization_id())
  and (((select private.is_organization_owner(organization_id)) and user_id<>(select auth.uid())) or ((select private.is_organization_admin(organization_id)) and role='employee'))
);

revoke all on function public.create_organization(text,text,text) from public,anon,authenticated;

alter table public.jobs alter column organization_id set default private.current_organization_id();
alter table public.finance alter column organization_id set default private.current_organization_id();
alter table public.general_reminders alter column organization_id set default private.current_organization_id();
alter table public.job_payments alter column organization_id set default private.current_organization_id();
alter table public.partner_settlements alter column organization_id set default private.current_organization_id();
alter table public.partner_transfers alter column organization_id set default private.current_organization_id();
alter table public.clients alter column organization_id set default private.current_organization_id();
alter table public.offers alter column organization_id set default private.current_organization_id();
alter table public.invoices alter column organization_id set default private.current_organization_id();
