import { supabase } from './supabase'

function mapSettlement(row) {
  return {
    id: row.id,
    month: row.month,
    profit: Number(row.profit || 0),
    lukaszShare: Number(row.lukasz_share || 0),
    pawelShare: Number(row.pawel_share || 0),
    lukaszPaid: Number(row.lukasz_paid || 0),
    pawelPaid: Number(row.pawel_paid || 0),
    closed: Boolean(row.closed),
    closedAt: row.closed_at || null,
    note: row.note || '',
  }
}

function mapTransfer(row) {
  return {
    id: row.id,
    settlementId: row.settlement_id || null,
    transferDate: row.transfer_date,
    fromPerson: row.from_person,
    toPerson: row.to_person,
    amount: Number(row.amount || 0),
    note: row.note || '',
  }
}

export async function getPartnerSettlements() {
  const { data, error } = await supabase
    .from('partner_settlements')
    .select('*')
    .order('month', { ascending: true })
  if (error) throw error
  return (data || []).map(mapSettlement)
}

export async function savePartnerSettlement({
  month,
  profit,
  lukaszShare,
  pawelShare,
  lukaszPaid,
  pawelPaid,
  closed,
  note,
}) {
  const { data, error } = await supabase
    .from('partner_settlements')
    .upsert({
      month,
      profit: Number(profit || 0),
      lukasz_share: Number(lukaszShare || 0),
      pawel_share: Number(pawelShare || 0),
      lukasz_paid: Number(lukaszPaid || 0),
      pawel_paid: Number(pawelPaid || 0),
      closed: Boolean(closed),
      closed_at: closed ? new Date().toISOString() : null,
      note: note?.trim() || null,
    }, { onConflict: 'month' })
    .select()
    .single()

  if (error) throw error
  return mapSettlement(data)
}

export async function getPartnerTransfers() {
  const { data, error } = await supabase
    .from('partner_transfers')
    .select('*')
    .order('transfer_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapTransfer)
}

export async function createPartnerTransfer({
  settlementId,
  transferDate,
  fromPerson,
  toPerson,
  amount,
  note,
}) {
  const numericAmount = Number(amount || 0)
  if (!fromPerson || !toPerson || fromPerson === toPerson || numericAmount <= 0) {
    throw new Error('Nieprawidłowe przekazanie.')
  }

  const { data, error } = await supabase
    .from('partner_transfers')
    .insert({
      settlement_id: settlementId || null,
      transfer_date: transferDate || new Date().toISOString().slice(0, 10),
      from_person: fromPerson,
      to_person: toPerson,
      amount: numericAmount,
      note: note?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return mapTransfer(data)
}

export async function deletePartnerTransfer(id) {
  const { error } = await supabase
    .from('partner_transfers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export function subscribeToPartnerSettlements(callback) {
  const channel = supabase
    .channel('aeroinstal-partner-settlements')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partner_settlements' },
      (payload) => callback({ type: 'settlement', payload })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partner_transfers' },
      (payload) => callback({ type: 'transfer', payload })
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
