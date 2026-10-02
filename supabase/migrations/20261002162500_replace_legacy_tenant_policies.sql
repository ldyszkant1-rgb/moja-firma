do $$
declare
  r record;
  t text;
begin
  foreach t in array array['jobs','finance','general_reminders','job_payments','partner_settlements','partner_transfers','clients','offers','invoices','invoice_number_counters'] loop
    for r in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;

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
