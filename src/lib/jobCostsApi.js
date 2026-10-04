import { supabase } from './supabase'

function mapCost(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    costType: row.cost_type || 'other',
    description: row.description || '',
    quantity: Number(row.quantity || 0),
    unit: row.unit || 'szt.',
    unitCost: Number(row.unit_cost || 0),
    totalCost: Number(row.total_cost || 0),
    costDate: row.cost_date || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapPayload(cost, organizationId) {
  const quantity = Number(cost.quantity || 0)
  const unitCost = Number(cost.unitCost || 0)

  return {
    organization_id: organizationId,
    job_id: cost.jobId,
    cost_type: ['material', 'hours', 'other'].includes(cost.costType)
      ? cost.costType
      : 'other',
    description: String(cost.description || '').trim(),
    quantity,
    unit: String(cost.unit || 'szt.').trim() || 'szt.',
    unit_cost: unitCost,
    total_cost: Math.max(0, quantity * unitCost),
    cost_date: cost.costDate || null,
  }
}

async function getOrganizationId() {
  const { data, error } = await supabase.rpc('current_organization_id')
  if (error) throw error
  return data
}

export async function getJobCosts(jobId) {
  if (!jobId) return []

  const { data, error } = await supabase
    .from('job_costs')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapCost)
}

export async function createJobCost(cost) {
  const organizationId = await getOrganizationId()
  const payload = mapPayload(cost, organizationId)

  const { data, error } = await supabase
    .from('job_costs')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return mapCost(data)
}

export async function updateJobCost(cost) {
  if (!cost?.id) throw new Error('Brak ID kosztu.')

  const organizationId = await getOrganizationId()
  const payload = mapPayload(cost, organizationId)

  const { data, error } = await supabase
    .from('job_costs')
    .update(payload)
    .eq('id', cost.id)
    .select()
    .single()

  if (error) throw error
  return mapCost(data)
}

export async function deleteJobCost(id) {
  if (!id) throw new Error('Brak ID kosztu.')

  const { error } = await supabase
    .from('job_costs')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}
