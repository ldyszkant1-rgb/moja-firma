import { supabase } from './supabase'

function mapTime(row) {
  const startedAt = row.started_at || null
  const endedAt = row.ended_at || null
  const calculatedMinutes = startedAt && endedAt
    ? Math.max(0, (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
    : Number(row.duration_minutes || 0)

  return {
    id: row.id,
    jobId: row.job_id,
    employeeId: row.employee_id || null,
    employeeName: row.employee_name || '',
    timeType: row.time_type,
    startedAt,
    endedAt,
    durationMinutes: calculatedMinutes,
    createdBy: row.created_by || null,
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

export async function getJobTimeEntries(jobId) {
  if (!jobId) return []
  const { data, error } = await supabase
    .from('job_time_entries')
    .select('*')
    .eq('job_id', jobId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapTime)
}

export async function startJobTimer({ jobId, employeeId, employeeName, timeType }) {
  const organizationId = await getOrganizationId()
  const { data: userData } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('job_time_entries')
    .insert({
      organization_id: organizationId,
      job_id: jobId,
      employee_id: employeeId,
      employee_name: employeeName || '',
      time_type: timeType,
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_minutes: 0,
      created_by: userData?.user?.id || null,
    })
    .select()
    .single()

  if (error) throw error
  return mapTime(data)
}

export async function stopJobTimer(entry) {
  if (!entry?.id) throw new Error('Brak ID aktywnego pomiaru czasu.')

  const endedAt = new Date()
  const startedAt = new Date(entry.startedAt)
  const durationMinutes = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 60000)

  const { data, error } = await supabase
    .from('job_time_entries')
    .update({
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      updated_at: endedAt.toISOString(),
    })
    .eq('id', entry.id)
    .is('ended_at', null)
    .select()
    .single()

  if (error) throw error
  return mapTime(data)
}

export async function deleteJobTimeEntry(id) {
  if (!id) throw new Error('Brak ID wpisu czasu.')

  // Jedna ścieżka usuwania dla wszystkich urządzeń Aeroinstal.
  // Funkcja RPC działa SECURITY DEFINER i sama ogranicza usunięcie
  // do bieżącej organizacji.
  const { data, error } = await supabase.rpc('delete_job_time_entry', {
    p_id: id,
  })

  if (error) throw error

  if (data !== true) {
    throw new Error('Wpis czasu nie został usunięty. Nie znaleziono wpisu w bieżącej organizacji.')
  }

  return true
}

export async function getJobCalendarPlans(jobId) {
  if (!jobId) return []

  const { data, error } = await supabase
    .from('calendar_plans')
    .select('id, job_id, user_id, plan_date, hours_worked, title, note')
    .eq('job_id', jobId)
    .eq('plan_type', 'job')
    .order('plan_date', { ascending: true })

  if (error) throw error
  return data || []
}
