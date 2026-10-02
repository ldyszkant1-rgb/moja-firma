-- Moja Firma: po przejściu na konta użytkowników nie używamy już anonimowego dostępu
-- ani domyślnej organizacji Aeroinstal. Każdy odczyt/zapis danych firmowych
-- wymaga zalogowanego użytkownika będącego członkiem organizacji.

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

do $$
declare
  t text;
begin
  foreach t in array array[
    'jobs','finance','general_reminders','job_payments','partner_settlements',
    'partner_transfers','clients','offers','invoices','invoice_number_counters'
  ] loop
    execute format('drop policy if exists tenant_select_anon on public.%I', t);
    execute format('drop policy if exists tenant_insert_anon on public.%I', t);
    execute format('drop policy if exists tenant_update_anon on public.%I', t);
    execute format('drop policy if exists tenant_delete_anon on public.%I', t);
  end loop;
end $$;

drop policy if exists organizations_select_legacy on public.organizations;
drop policy if exists device_users_insert on public.device_users;
drop policy if exists device_users_select on public.device_users;

revoke all on table public.device_users from anon, authenticated;
