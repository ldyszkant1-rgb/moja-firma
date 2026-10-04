-- Stabilize tenant isolation for teams/team_members and make partner settlements tenant-scoped.
-- This migration records the database hardening already applied to production.

drop policy if exists "teams_select_same_org" on public.teams;
drop policy if exists "teams_insert_same_org" on public.teams;
drop policy if exists "teams_update_same_org" on public.teams;
drop policy if exists "teams_delete_same_org" on public.teams;

create policy "teams_select_same_org"
on public.teams
for select
using (organization_id = private.current_organization_id());

create policy "teams_insert_same_org"
on public.teams
for insert
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = private.current_organization_id()
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
);

create policy "teams_update_same_org"
on public.teams
for update
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = private.current_organization_id()
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
)
with check (organization_id = private.current_organization_id());

create policy "teams_delete_same_org"
on public.teams
for delete
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = private.current_organization_id()
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
);

drop policy if exists "team_members_select_same_org" on public.team_members;
drop policy if exists "team_members_insert_same_org" on public.team_members;
drop policy if exists "team_members_update_same_org" on public.team_members;
drop policy if exists "team_members_delete_same_org" on public.team_members;

create policy "team_members_select_same_org"
on public.team_members
for select
using (organization_id = private.current_organization_id());

create policy "team_members_insert_same_org"
on public.team_members
for insert
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = private.current_organization_id()
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
  and exists (
    select 1
    from public.teams t
    where t.id = team_id
      and t.organization_id = private.current_organization_id()
  )
);

create policy "team_members_update_same_org"
on public.team_members
for update
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = private.current_organization_id()
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
)
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1
    from public.teams t
    where t.id = team_id
      and t.organization_id = private.current_organization_id()
  )
);

create policy "team_members_delete_same_org"
on public.team_members
for delete
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = private.current_organization_id()
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
);

drop index if exists public.partner_settlements_month_key;

create unique index if not exists partner_settlements_organization_month_key
on public.partner_settlements (organization_id, month);
