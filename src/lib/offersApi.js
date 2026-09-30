import { supabase } from './supabase'

function parseDecimal(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 0
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}

function mapRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id || null,
    offerNumber: row.offer_number || '',
    name: row.name || '',
    location: row.location || '',
    status: row.status || 'Nowa',
    validUntil: row.valid_until || null,
    quantities: {
      mb: parseDecimal(row.quantity_mb),
      m2: parseDecimal(row.quantity_m2),
      kg: parseDecimal(row.quantity_kg),
    },
    rates: {
      mb: parseDecimal(row.rate_mb),
      m2: parseDecimal(row.rate_m2),
      kg: parseDecimal(row.rate_kg),
    },
    scope: row.scope || '',
    notes: row.notes || '',
    total: parseDecimal(row.total),
    sourceJobId: row.source_job_id || null,
    convertedJobId: row.converted_job_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function payload(offer) {
  return {
    organization_id: offer.organizationId || 'c6565617-8988-41aa-899a-e0c21327d8fe',
    client_id: offer.clientId || null,
    offer_number: offer.offerNumber || null,
    name: String(offer.name || '').trim(),
    location: String(offer.location || '').trim() || null,
    status: offer.status || 'Nowa',
    valid_until: offer.validUntil || null,
    quantity_mb: parseDecimal(offer.quantities?.mb),
    quantity_m2: parseDecimal(offer.quantities?.m2),
    quantity_kg: parseDecimal(offer.quantities?.kg),
    rate_mb: parseDecimal(offer.rates?.mb),
    rate_m2: parseDecimal(offer.rates?.m2),
    rate_kg: parseDecimal(offer.rates?.kg),
    scope: offer.scope || null,
    notes: offer.notes || null,
    total: parseDecimal(offer.total),
    source_job_id: offer.sourceJobId || null,
    converted_job_id: offer.convertedJobId || null,
    updated_at: new Date().toISOString(),
  }
}

export async function getOffers() {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapRow)
}

export async function createOffer(offer) {
  const { data, error } = await supabase
    .from('offers')
    .insert(payload(offer))
    .select()
    .single()

  if (error) throw error
  return mapRow(data)
}

export async function updateOffer(offer) {
  if (!offer?.id) throw new Error('Brak ID oferty.')
  const { data, error } = await supabase
    .from('offers')
    .update(payload(offer))
    .eq('id', offer.id)
    .select()
    .single()

  if (error) throw error
  return mapRow(data)
}

export async function deleteOffer(id) {
  if (!id) throw new Error('Brak ID oferty.')
  const { error } = await supabase.from('offers').delete().eq('id', id)
  if (error) throw error
}

export function subscribeToOffers(callback) {
  const channel = supabase
    .channel('aeroinstal-offers-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, callback)
    .subscribe()

  return () => supabase.removeChannel(channel)
}
