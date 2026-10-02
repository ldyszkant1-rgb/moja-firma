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

create policy "organization admins can read invitations"
on public.organization_invitations for select to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.is_organization_admin(organization_id)));

create policy "organization admins can create invitations"
on public.organization_invitations for insert to authenticated
with check (organization_id = (select private.current_organization_id()) and invited_by = (select auth.uid()) and (select private.is_organization_admin(organization_id)));

create policy "organization admins can update invitations"
on public.organization_invitations for update to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.is_organization_admin(organization_id)))
with check (organization_id = (select private.current_organization_id()) and (select private.is_organization_admin(organization_id)));
