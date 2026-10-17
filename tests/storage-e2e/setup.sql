-- Minimal isolated schema for testing the real local Supabase Auth + Storage APIs.
-- This database is disposable and contains only synthetic fixtures.
create schema if not exists private;

create table public.organization_members (
  organization_id uuid not null,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.jobs (
  id uuid primary key,
  organization_id uuid not null,
  name text not null default '',
  photos jsonb not null default '[]'::jsonb
);

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id = (select auth.uid())
  order by case om.role when 'owner' then 0 when 'admin' then 1 else 2 end, om.created_at
  limit 1;
$$;

revoke all on function private.current_organization_id() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_organization_id() to authenticated;

alter table public.jobs enable row level security;
create policy "storage e2e jobs scoped to current organization"
on public.jobs for select to authenticated
using (organization_id = (select private.current_organization_id()));

grant select on public.jobs to authenticated;

-- Policies are applied from the repository's real migration by the workflow:
-- supabase/migrations/20261014162000_fix_storage_policy_outer_name.sql
