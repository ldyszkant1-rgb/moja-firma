import { supabase } from './supabase'

function mapShare(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    employeeId: row.employee_id || 'team',
    employeeName: row.employee_name || '',
    percentage: Number(row.percentage || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
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

export async function getJobProfitShares(jobId) {
  if (!jobId) return []
  const { data, error } = await supabase
    .from('job_profit_shares')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapShare)
}

export async function saveJobProfitShares(jobId, shares) {
  const organizationId = await getOrganizationId()
  const cleanShares = (shares || [])
    .filter((share) => share?.employeeId === 'team' || share?.employeeId)
    .map((share) => ({
      organization_id: organizationId,
      job_id: jobId,
      employee_id: share.employeeId === 'team' ? null : share.employeeId,
      employee_name: String(share.employeeName || '').trim(),
      percentage: Math.max(0, Math.min(100, Number(share.percentage || 0))),
    }))

  const { error: deleteError } = await supabase
    .from('job_profit_shares')
    .delete()
    .eq('job_id', jobId)
  if (deleteError) throw deleteError

  if (cleanShares.length === 0) return []

  const { data, error } = await supabase
    .from('job_profit_shares')
    .insert(cleanShares)
    .select()
  if (error) throw error
  return (data || []).map(mapShare)
}
