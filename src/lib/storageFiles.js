const STORAGE_BUCKET = 'aeroinstal-files'
const SIGNED_STORAGE_URL_TTL_SECONDS = 60 * 60 * 24
export const MAX_STORAGE_FILE_SIZE_BYTES = 25 * 1024 * 1024

// Keep this list aligned with the Storage bucket's allowed_mime_types.
// SVG and HTML are intentionally excluded because they can contain active content.
const ALLOWED_FILE_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
  dwg: 'application/acad',
  dxf: 'application/dxf',
}

function sanitizeFileName(name) {
  return String(name || 'plik')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getAllowedContentType(file) {
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase()
  const expectedType = ALLOWED_FILE_TYPES[extension]
  if (!expectedType) {
    throw new Error('Ten typ pliku nie jest obsługiwany. Dozwolone są PDF, zdjęcia, dokumenty Office, CSV/TXT, ZIP oraz pliki DWG/DXF.')
  }

  const actualType = String(file?.type || '').trim().toLowerCase()
  if (actualType && actualType !== expectedType && actualType !== 'application/octet-stream') {
    const compatibleTypes = {
      heic: ['image/heic', 'image/heif'],
      heif: ['image/heif', 'image/heic'],
      dwg: ['application/acad', 'application/x-acad', 'image/vnd.dwg'],
      dxf: ['application/dxf', 'image/vnd.dxf'],
      zip: ['application/zip', 'application/x-zip-compressed'],
    }
    if (!(compatibleTypes[extension] || []).includes(actualType)) {
      throw new Error('Typ pliku nie zgadza się z jego rozszerzeniem. Sprawdź plik i spróbuj ponownie.')
    }
  }

  return expectedType
}

function validateUploadFile(file) {
  if (!file) throw new Error('Brak pliku do wysłania.')
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Nie można odczytać rozmiaru pliku.')
  }
  if (file.size > MAX_STORAGE_FILE_SIZE_BYTES) {
    throw new Error('Plik jest za duży. Maksymalny rozmiar załącznika to 25 MB.')
  }
  return getAllowedContentType(file)
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
    const contentType = validateUploadFile(file)
    if (!/^[a-zA-Z0-9_-]+$/.test(String(jobId))) {
      throw new Error('Nieprawidłowe ID realizacji.')
    }
    if (typeof folder !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(folder)) {
      throw new Error('Nieprawidłowy katalog pliku.')
    }

    const safeName = sanitizeFileName(file.name)
    const path = 'jobs/' + jobId + '/' + folder + '/' + now() + '-' + safeName

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType,
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
