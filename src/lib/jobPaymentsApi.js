import { supabase } from './supabase'

function mapPayment(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    invoiceId: row.invoice_id || null,
    amount: Number(row.amount || 0),
    paidAt: row.paid_at || null,
    note: row.note || '',
    createdAt: row.created_at || null,
  }
}

export async function getJobPayments(jobId) {
  if (!jobId) return []
  const { data, error } = await supabase
    .from('job_payments')
    .select('*')
    .eq('job_id', jobId)
    .order('paid_at', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapPayment)
}

export async function getAllJobPayments() {
  const { data, error } = await supabase
    .from('job_payments')
    .select('*')
    .order('paid_at', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapPayment)
}

export async function createJobPayment({ jobId, invoiceId = null, amount, paidAt, note }) {
  const numericAmount = Number(amount || 0)
  if (!jobId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Nieprawidłowa wpłata.')
  }

  const { data, error } = await supabase
    .from('job_payments')
    .insert({
      job_id: jobId,
      invoice_id: invoiceId || null,
      amount: numericAmount,
      paid_at: paidAt || new Date().toISOString().slice(0, 10),
      note: note?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return mapPayment(data)
}

export async function deleteJobPayment(paymentId) {
  if (!paymentId) return
  const { error } = await supabase
    .from('job_payments')
    .delete()
    .eq('id', paymentId)
  if (error) throw error
}

export function subscribeToJobPayments(jobId, callback) {
  if (!jobId) return () => {}

  const channel = supabase
    .channel(`aeroinstal-job-payments-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_payments',
        filter: `job_id=eq.${jobId}`,
      },
      callback
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

export function calculatePaidAmount(payments) {
  return (payments || []).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  )
}
