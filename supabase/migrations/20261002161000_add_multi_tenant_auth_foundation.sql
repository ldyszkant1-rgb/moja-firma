create schema if not exists private;

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner','admin','employee')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists organization_members_org_id_idx on public.organization_members(organization_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists short_name text,
  add column if not exists nip text,
  add column if not exists regon text,
  add column if not exists address text,
  add column if not exists email text,
  add column if not exists bank_account text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do update
    set display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
      order by case om.role when 'owner' then 0 when 'admin' then 1 else 2 end, om.created_at
      limit 1
    ),
    case when (select auth.uid()) is null
      then 'c6565617-8988-41aa-899a-e0c21327d8fe'::uuid
      else null
    end
  );
$$;

revoke all on function private.current_organization_id() from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.current_organization_id() to anon, authenticated;

create or replace function public.create_organization(
  p_name text,
  p_slug text default null,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_slug text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_name := nullif(trim(p_name), '');
  if v_name is null then raise exception 'ORGANIZATION_NAME_REQUIRED'; end if;
  v_slug := nullif(trim(both '-' from lower(regexp_replace(coalesce(p_slug, v_name), '[^a-zA-Z0-9]+', '-', 'g'))), '');
  if v_slug is null or v_slug = '' then v_slug := 'firma-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10); end if;
  if exists (select 1 from public.organization_members where user_id = auth.uid()) then raise exception 'USER_ALREADY_HAS_ORGANIZATION'; end if;

  insert into public.organizations (name, slug, plan, short_name)
  values (v_name, v_slug, 'free', v_name)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role, display_name)
  values (v_org_id, auth.uid(), 'owner', nullif(trim(p_display_name), ''));

  return v_org_id;
exception
  when unique_violation then raise exception 'ORGANIZATION_SLUG_TAKEN';
end;
$$;

revoke all on function public.create_organization(text,text,text) from public, anon;
grant execute on function public.create_organization(text,text,text) to authenticated;

alter table public.organization_members enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;

create policy organization_members_select on public.organization_members
for select to authenticated using (organization_id = (select private.current_organization_id()));

create policy organization_members_insert on public.organization_members
for insert to authenticated with check (organization_id = (select private.current_organization_id()));

create policy organization_members_update on public.organization_members
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (organization_id = (select private.current_organization_id()));

create policy organization_members_delete on public.organization_members
for delete to authenticated using (organization_id = (select private.current_organization_id()));

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

create policy organizations_select_legacy on public.organizations
for select to anon using (id = 'c6565617-8988-41aa-899a-e0c21327d8fe'::uuid);

create policy organizations_select_member on public.organizations
for select to authenticated using (id = (select private.current_organization_id()));

create policy organizations_update_member on public.organizations
for update to authenticated
using (
  id = (select private.current_organization_id())
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = public.organizations.id
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
)
with check (id = (select private.current_organization_id()));

do $$
declare t text;
begin
  foreach t in array array['jobs','finance','general_reminders','job_payments','partner_settlements','partner_transfers','clients','offers','invoices','invoice_number_counters'] loop
    alter table public.jobs enable row level security;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_select_anon on public.%I', t);
    execute format('drop policy if exists tenant_insert_anon on public.%I', t);
    execute format('drop policy if exists tenant_update_anon on public.%I', t);
    execute format('drop policy if exists tenant_delete_anon on public.%I', t);
    execute format('drop policy if exists tenant_select_authenticated on public.%I', t);
    execute format('drop policy if exists tenant_insert_authenticated on public.%I', t);
    execute format('drop policy if exists tenant_update_authenticated on public.%I', t);
    execute format('drop policy if exists tenant_delete_authenticated on public.%I', t);
    execute format('create policy tenant_select_anon on public.%I for select to anon using (organization_id = (select private.current_organization_id()))', t);
    execute format('create policy tenant_insert_anon on public.%I for insert to anon with check (organization_id = (select private.current_organization_id()))', t);
    execute format('create policy tenant_update_anon on public.%I for update to anon using (organization_id = (select private.current_organization_id())) with check (organization_id = (select private.current_organization_id()))', t);
    execute format('create policy tenant_delete_anon on public.%I for delete to anon using (organization_id = (select private.current_organization_id()))', t);
    execute format('create policy tenant_select_authenticated on public.%I for select to authenticated using (organization_id = (select private.current_organization_id()))', t);
    execute format('create policy tenant_insert_authenticated on public.%I for insert to authenticated with check (organization_id = (select private.current_organization_id()))', t);
    execute format('create policy tenant_update_authenticated on public.%I for update to authenticated using (organization_id = (select private.current_organization_id())) with check (organization_id = (select private.current_organization_id()))', t);
    execute format('create policy tenant_delete_authenticated on public.%I for delete to authenticated using (organization_id = (select private.current_organization_id()))', t);
  end loop;
end $$;

alter table public.device_users enable row level security;
drop policy if exists device_users_insert on public.device_users;
drop policy if exists device_users_select on public.device_users;
create policy device_users_insert on public.device_users for insert to anon
with check (organization_id = 'c6565617-8988-41aa-899a-e0c21327d8fe'::uuid and user_name = any(array['Łukasz'::text,'Paweł'::text]));
create policy device_users_select on public.device_users for select to anon
using (organization_id = 'c6565617-8988-41aa-899a-e0c21327d8fe'::uuid);

revoke all on table public.organization_members, public.profiles from anon;
grant select on table public.organization_members to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select on table public.organizations to anon, authenticated;
grant update on table public.organizations to authenticated;
