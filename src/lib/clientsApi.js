import { supabase } from './supabase'

function mapClient(row) {
  return {
    id: row.id,
    name: row.name || '',
    shortName: row.short_name || row.name || '',
    nip: row.nip || '',
    address: row.address || '',
    contactName: row.contact_name || '',
    phone: row.phone || '',
    email: row.email || '',
    notes: row.notes || '',
    organizationId: row.organization_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapClientPayload(client) {
  return {
    name: String(client?.name || '').trim(),
    short_name: String(client?.shortName || '').trim() || String(client?.name || '').trim() || null,
    nip: String(client?.nip || '').trim() || null,
    address: String(client?.address || '').trim() || null,
    contact_name: String(client?.contactName || '').trim() || null,
    phone: String(client?.phone || '').trim() || null,
    email: String(client?.email || '').trim() || null,
    notes: String(client?.notes || '').trim() || null,
  }
}

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []).map(mapClient)
}

export async function createClient(client) {
  const payload = mapClientPayload(client)

  if (!payload.name) {
    throw new Error('Nazwa klienta jest wymagana.')
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return mapClient(data)
}

export async function updateClient(client) {
  if (!client?.id) throw new Error('Brak ID klienta.')

  const { data, error } = await supabase
    .from('clients')
    .update(mapClientPayload(client))
    .eq('id', client.id)
    .select('*')
    .single()

  if (error) throw error
  return mapClient(data)
}

export async function deleteClient(clientId) {
  if (!clientId) throw new Error('Brak ID klienta.')

  const { count, error: jobsError } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if (jobsError) throw jobsError

  if ((count || 0) > 0) {
    throw new Error('Nie można usunąć klienta, który ma przypisane roboty. Najpierw zmień klienta w tych robotach.')
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (error) throw error
  return true
}

export function subscribeToClients(callback) {
  const channel = supabase
    .channel('aeroinstal-clients-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clients' },
      callback
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
