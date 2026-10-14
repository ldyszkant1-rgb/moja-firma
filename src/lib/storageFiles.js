const STORAGE_BUCKET = 'aeroinstal-files'
const SIGNED_STORAGE_URL_TTL_SECONDS = 60 * 60 * 24

function sanitizeFileName(name) {
  return String(name || 'plik')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Builds Storage file operations around an injected Supabase-compatible client.
 * Production uses the shared Supabase client; tests can inject a fake client and
 * never contact the production project.
 */
export function createStorageFileApi(
  supabase,
  {
    bucket = STORAGE_BUCKET,
    signedUrlTtlSeconds = SIGNED_STORAGE_URL_TTL_SECONDS,
    now = Date.now,
    logger = console,
  } = {}
) {
  async function deleteSupabaseFile(path) {
    if (!path) return

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      logger.error('Błąd usuwania pliku ze Storage:', error)
      throw error
    }
  }

  async function uploadSupabaseFile(jobId, folder, file) {
    if (!jobId) throw new Error('Brak ID roboty.')
    if (!file) throw new Error('Brak pliku do wysłania.')

    const safeName = sanitizeFileName(file.name)
    const path = `jobs/${jobId}/${folder}/${now()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

    if (uploadError) {
      logger.error('Błąd wysyłania pliku do Storage:', uploadError)
      throw uploadError
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, signedUrlTtlSeconds)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      const urlError = signedUrlError || new Error('Nie udało się utworzyć podpisanego linku do pliku.')

      try {
        await deleteSupabaseFile(path)
      } catch (cleanupError) {
        if (urlError && typeof urlError === 'object') {
          urlError.cleanupError = cleanupError
        }
        logger.error('Nie udało się posprzątać pliku po błędzie podpisanego URL:', cleanupError)
      }

      throw urlError
    }

    return { path, url: signedUrlData.signedUrl }
  }

  return { uploadSupabaseFile, deleteSupabaseFile }
}
