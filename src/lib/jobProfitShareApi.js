import { supabase } from './supabase'

function mapShare(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    employeeId: row.employee_id || `participant:${row.id}`,
    employeeName: row.employee_name || '',
    percentage: Number(row.percentage || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
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
  if (!jobId) throw new Error('Brak ID realizacji.')

  const cleanShares = (shares || [])
    .filter((share) => share?.employeeId === 'team' || share?.employeeId)
    .map((share) => ({
      employee_id:
        String(share.employeeId || '').startsWith('participant:') ||
        String(share.employeeId || '').startsWith('profit:')
          ? null
          : share.employeeId,
      employee_name: String(share.employeeName || '').trim(),
      percentage: Math.max(0, Math.min(100, Number(share.percentage || 0))),
    }))

  const { data, error } = await supabase.rpc('save_job_profit_shares', {
    p_job_id: jobId,
    p_shares: cleanShares,
  })

  if (error) throw error
  return (data || []).map(mapShare)
}
