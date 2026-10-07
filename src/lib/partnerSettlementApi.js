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


async function getOrganizationId() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const userId = userData?.user?.id
  if (!userId) throw new Error('Brak zalogowanego użytkownika.')

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (error) throw error
  return data.organization_id
}

function mapProfitDistribution(row) {
  return {
    id: row.id,
    distributionDate: row.distribution_date,
    receivedNet: Number(row.received_net || 0),
    costsNet: Number(row.costs_net || 0),
    profit: Number(row.profit || 0),
    lukaszShare: Number(row.lukasz_share || 0),
    pawelShare: Number(row.pawel_share || 0),
    paymentIds: Array.isArray(row.payment_ids) ? row.payment_ids.map(String) : [],
    costIds: Array.isArray(row.cost_ids) ? row.cost_ids.map(String) : [],
    note: row.note || '',
    createdAt: row.created_at || null,
    status: row.status || 'active',
    reversedAt: row.reversed_at || null,
    reversalReason: row.reversal_reason || '',
  }
}

export async function getProfitDistributions() {
  const { data, error } = await supabase
    .from('profit_distributions')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).map(mapProfitDistribution)
}

export async function createProfitDistribution({
  distributionDate,
  receivedNet,
  costsNet,
  profit,
  lukaszShare,
  pawelShare,
  paymentIds,
  costIds,
  note,
}) {
  const organizationId = await getOrganizationId()

  const { data, error } = await supabase
    .from('profit_distributions')
    .insert({
      organization_id: organizationId,
      distribution_date: distributionDate || new Date().toISOString().slice(0, 10),
      received_net: Number(receivedNet || 0),
      costs_net: Number(costsNet || 0),
      profit: Number(profit || 0),
      lukasz_share: Number(lukaszShare || 0),
      pawel_share: Number(pawelShare || 0),
      payment_ids: Array.isArray(paymentIds) ? paymentIds.map(String) : [],
      cost_ids: Array.isArray(costIds) ? costIds.map(String) : [],
      note: note?.trim() || null,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error
  return mapProfitDistribution(data)
}

export async function reverseProfitDistribution(id, reason = '') {
  const { data, error } = await supabase
    .from('profit_distributions')
    .update({
      status: 'reversed',
      reversed_at: new Date().toISOString(),
      reversal_reason: reason?.trim() || null,
    })
    .eq('id', id)
    .eq('status', 'active')
    .select()
    .single()

  if (error) throw error
  return mapProfitDistribution(data)
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
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_distributions' },
      (payload) => callback({ type: 'profitDistribution', payload })
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
