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
    employeeId: row.employee_id || null,
    employeeName: row.employee_name || '',
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
    employee_id: cost.employeeId || null,
    employee_name: String(cost.employeeName || '').trim(),
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
