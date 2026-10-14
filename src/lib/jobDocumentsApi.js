/**
 * Optimistic, field-scoped updates for jobs.documents.
 *
 * The JSONB compare-and-swap prevents a stale client from overwriting newer
 * document metadata. Each retry re-reads the latest value and reapplies only
 * the requested transformation.
 */
export function createJobDocumentsApi(supabase, { maxAttempts = 5 } = {}) {
  async function updateJobDocuments(jobId, transformDocuments) {
    if (!jobId) throw new Error('Brak ID roboty podczas aktualizacji dokumentacji.')
    if (typeof transformDocuments !== 'function') {
      throw new Error('Brak funkcji aktualizującej dokumentację.')
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const { data: current, error: readError } = await supabase
        .from('jobs')
        .select('id,documents')
        .eq('id', jobId)
        .is('deleted_at', null)
        .maybeSingle()

      if (readError) throw readError
      if (!current) throw new Error('Nie znaleziono realizacji podczas aktualizacji dokumentacji.')

      const currentDocuments = current.documents
      const nextDocuments = transformDocuments(currentDocuments)

      if (JSON.stringify(nextDocuments) === JSON.stringify(currentDocuments)) {
        return currentDocuments
      }

      let updateQuery = supabase
        .from('jobs')
        .update({ documents: nextDocuments })
        .eq('id', jobId)
        .is('deleted_at', null)

      // PostgREST expects JSON text for equality filters on JSONB values.
      updateQuery = currentDocuments == null
        ? updateQuery.is('documents', null)
        : updateQuery.eq('documents', JSON.stringify(currentDocuments))

      const { data: updated, error: updateError } = await updateQuery
        .select('documents')
        .maybeSingle()

      if (updateError) throw updateError
      if (updated) return updated.documents
      // Another writer changed documents after our read. Retry against its value.
    }

    throw new Error('Dokumentacja została równolegle zmieniona. Odśwież realizację i spróbuj ponownie.')
  }

  return { updateJobDocuments }
}
