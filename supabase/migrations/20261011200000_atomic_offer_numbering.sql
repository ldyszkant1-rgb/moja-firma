-- Allocate offer numbers and insert the offer in one transaction.
-- A transaction-scoped advisory lock prevents concurrent requests from reusing a number.
create unique index if not exists offers_org_offer_number_unique
  on public.offers (organization_id, offer_number)
  where offer_number is not null and btrim(offer_number) <> '';

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
    select 1
    from public.organization_members om
    where om.organization_id = v_org_id
      and om.user_id = v_user_id
  ) then
    raise exception 'Organization access denied';
  end if;

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
    v_org_id,
    nullif(p_offer->>'client_id', '')::uuid,
    coalesce(nullif(p_offer->>'document_type', ''), 'Oferta dla klienta'),
    v_offer_number,
    btrim(coalesce(p_offer->>'name', '')),
    nullif(btrim(coalesce(p_offer->>'location', '')), ''),
    coalesce(nullif(p_offer->>'status', ''), 'Nowa'),
    nullif(p_offer->>'valid_until', '')::date,
    coalesce(nullif(p_offer->>'quantity_mb', '')::numeric, 0),
    coalesce(nullif(p_offer->>'quantity_m2', '')::numeric, 0),
    coalesce(nullif(p_offer->>'quantity_kg', '')::numeric, 0),
    coalesce(nullif(p_offer->>'rate_mb', '')::numeric, 0),
    coalesce(nullif(p_offer->>'rate_m2', '')::numeric, 0),
    coalesce(nullif(p_offer->>'rate_kg', '')::numeric, 0),
    nullif(p_offer->>'scope', ''),
    nullif(p_offer->>'notes', ''),
    coalesce(nullif(p_offer->>'total', '')::numeric, 0),
    nullif(p_offer->>'source_job_id', '')::uuid,
    nullif(p_offer->>'converted_job_id', '')::uuid,
    now()
  )
  returning * into v_offer;

  return v_offer;
end;
$$;

revoke all privileges on function public.create_offer_with_number(jsonb) from public, anon;
grant execute on function public.create_offer_with_number(jsonb) to authenticated;
