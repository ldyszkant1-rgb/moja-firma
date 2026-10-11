-- Enforce tenant consistency for financial records that reference other tables.
-- Existing orphan references are tolerated for backwards compatibility, but a
-- reference that resolves to a row must point to the same organization.

drop policy if exists tenant_insert_authenticated on public.invoices;
create policy tenant_insert_authenticated on public.invoices
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (job_id is null or not exists (select 1 from public.jobs j where j.id = invoices.job_id)
       or exists (select 1 from public.jobs j where j.id = invoices.job_id and j.organization_id = invoices.organization_id))
  and (client_id is null or not exists (select 1 from public.clients c where c.id = invoices.client_id)
       or exists (select 1 from public.clients c where c.id = invoices.client_id and c.organization_id = invoices.organization_id))
);

drop policy if exists tenant_update_authenticated on public.invoices;
create policy tenant_update_authenticated on public.invoices
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and (job_id is null or not exists (select 1 from public.jobs j where j.id = invoices.job_id)
       or exists (select 1 from public.jobs j where j.id = invoices.job_id and j.organization_id = invoices.organization_id))
  and (client_id is null or not exists (select 1 from public.clients c where c.id = invoices.client_id)
       or exists (select 1 from public.clients c where c.id = invoices.client_id and c.organization_id = invoices.organization_id))
);

drop policy if exists "job costs insert current organization" on public.job_costs;
create policy "job costs insert current organization" on public.job_costs
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and exists (select 1 from public.jobs j where j.id = job_costs.job_id and j.organization_id = job_costs.organization_id)
);

drop policy if exists "job costs update current organization" on public.job_costs;
create policy "job costs update current organization" on public.job_costs
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and exists (select 1 from public.jobs j where j.id = job_costs.job_id and j.organization_id = job_costs.organization_id)
);

drop policy if exists tenant_insert_authenticated on public.job_payments;
create policy tenant_insert_authenticated on public.job_payments
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and exists (select 1 from public.jobs j where j.id = job_payments.job_id and j.organization_id = job_payments.organization_id)
  and (invoice_id is null or not exists (select 1 from public.invoices i where i.id = job_payments.invoice_id)
       or exists (select 1 from public.invoices i where i.id = job_payments.invoice_id and i.organization_id = job_payments.organization_id))
);

drop policy if exists tenant_update_authenticated on public.job_payments;
create policy tenant_update_authenticated on public.job_payments
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and exists (select 1 from public.jobs j where j.id = job_payments.job_id and j.organization_id = job_payments.organization_id)
  and (invoice_id is null or not exists (select 1 from public.invoices i where i.id = job_payments.invoice_id)
       or exists (select 1 from public.invoices i where i.id = job_payments.invoice_id and i.organization_id = job_payments.organization_id))
);

drop policy if exists tenant_insert_authenticated on public.partner_transfers;
create policy tenant_insert_authenticated on public.partner_transfers
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (settlement_id is null or not exists (select 1 from public.partner_settlements s where s.id = partner_transfers.settlement_id)
       or exists (select 1 from public.partner_settlements s where s.id = partner_transfers.settlement_id and s.organization_id = partner_transfers.organization_id))
);

drop policy if exists tenant_update_authenticated on public.partner_transfers;
create policy tenant_update_authenticated on public.partner_transfers
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (
  organization_id = (select private.current_organization_id())
  and (settlement_id is null or not exists (select 1 from public.partner_settlements s where s.id = partner_transfers.settlement_id)
       or exists (select 1 from public.partner_settlements s where s.id = partner_transfers.settlement_id and s.organization_id = partner_transfers.organization_id))
);

-- The offer-number RPC is SECURITY DEFINER, so validate referenced entities here
-- as well as in the table policies.
create or replace function public.create_offer_with_number(p_offer jsonb)
returns public.offers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_year integer := extract(year from now())::integer;
  v_offer_number text;
  v_next_number integer;
  v_client_id uuid;
  v_source_job_id uuid;
  v_converted_job_id uuid;
  v_offer public.offers;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_offer is null or jsonb_typeof(p_offer) <> 'object' then
    raise exception 'Offer data is required';
  end if;

  v_org_id := coalesce(nullif(p_offer->>'organization_id', '')::uuid, private.current_organization_id());
  if v_org_id is null or not exists (
    select 1 from public.organization_members om
    where om.organization_id = v_org_id and om.user_id = v_user_id
  ) then
    raise exception 'Organization access denied';
  end if;

  v_client_id := nullif(p_offer->>'client_id', '')::uuid;
  v_source_job_id := nullif(p_offer->>'source_job_id', '')::uuid;
  v_converted_job_id := nullif(p_offer->>'converted_job_id', '')::uuid;

  if v_client_id is not null and exists (
    select 1 from public.clients c where c.id = v_client_id and c.organization_id <> v_org_id
  ) then raise exception 'Client belongs to another organization'; end if;
  if v_source_job_id is not null and exists (
    select 1 from public.jobs j where j.id = v_source_job_id and j.organization_id <> v_org_id
  ) then raise exception 'Source job belongs to another organization'; end if;
  if v_converted_job_id is not null and exists (
    select 1 from public.jobs j where j.id = v_converted_job_id and j.organization_id <> v_org_id
  ) then raise exception 'Converted job belongs to another organization'; end if;

  v_offer_number := nullif(btrim(coalesce(p_offer->>'offer_number', '')), '');
  if v_offer_number is null then
    perform pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':' || v_year::text || ':offer-number', 0));
    select coalesce(max(((regexp_match(o.offer_number, '^OF-' || v_year::text || '-([0-9]+)$'))[1])::integer), 0) + 1
      into v_next_number
    from public.offers o
    where o.organization_id = v_org_id
      and o.offer_number ~ ('^OF-' || v_year::text || '-[0-9]+$');
    v_offer_number := 'OF-' || v_year::text || '-' || lpad(v_next_number::text, 3, '0');
  end if;

  insert into public.offers (
    organization_id, client_id, document_type, offer_number, name, location, status,
    valid_until, quantity_mb, quantity_m2, quantity_kg, rate_mb, rate_m2, rate_kg,
    scope, notes, total, source_job_id, converted_job_id, updated_at
  ) values (
    v_org_id, v_client_id,
    coalesce(nullif(p_offer->>'document_type', ''), 'Oferta dla klienta'),
    v_offer_number, btrim(coalesce(p_offer->>'name', '')),
    nullif(btrim(coalesce(p_offer->>'location', '')), ''),
    coalesce(nullif(p_offer->>'status', ''), 'Nowa'),
    nullif(p_offer->>'valid_until', '')::date,
    coalesce(nullif(p_offer->>'quantity_mb', '')::numeric, 0),
    coalesce(nullif(p_offer->>'quantity_m2', '')::numeric, 0),
    coalesce(nullif(p_offer->>'quantity_kg', '')::numeric, 0),
    coalesce(nullif(p_offer->>'rate_mb', '')::numeric, 0),
    coalesce(nullif(p_offer->>'rate_m2', '')::numeric, 0),
    coalesce(nullif(p_offer->>'rate_kg', '')::numeric, 0),
    nullif(p_offer->>'scope', ''), nullif(p_offer->>'notes', ''),
    coalesce(nullif(p_offer->>'total', '')::numeric, 0),
    v_source_job_id, v_converted_job_id, now()
  ) returning * into v_offer;

  return v_offer;
end;
$$;

revoke all privileges on function public.create_offer_with_number(jsonb) from public, anon;
grant execute on function public.create_offer_with_number(jsonb) to authenticated;
