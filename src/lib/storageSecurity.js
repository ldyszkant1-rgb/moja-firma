const DEFAULT_STORAGE_BUCKET = 'aeroinstal-files'

export function isSafeStoragePath(path, jobId) {
  if (
    typeof path !== 'string' ||
    !path ||
    path.includes('\\') ||
    path.split('/').some((part) => part === '.' || part === '..')
  ) {
    return false
  }

  const parts = path.split('/')
  return parts.length >= 4 &&
    parts[0] === 'jobs' &&
    parts[1] === String(jobId) &&
    parts.every(Boolean)
}

export function pathFromLegacyPublicUrl(url, jobId, supabaseUrl, bucket = DEFAULT_STORAGE_BUCKET) {
  if (typeof url !== 'string' || !supabaseUrl) return null

  try {
    const candidate = new URL(url)
    const expected = new URL(supabaseUrl)
    const prefix = '/storage/v1/object/public/' + bucket + '/'

    if (candidate.origin !== expected.origin || !candidate.pathname.startsWith(prefix)) return null

    const path = candidate.pathname
      .slice(prefix.length)
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/')

    return isSafeStoragePath(path, jobId) ? path : null
  } catch {
    return null
  }
}

export function sanitizeStorageFile(file, jobId, supabaseUrl, bucket = DEFAULT_STORAGE_BUCKET) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) return file

  const path = isSafeStoragePath(file.path, jobId)
    ? file.path
    : pathFromLegacyPublicUrl(file.url, jobId, supabaseUrl, bucket)

  const metadata = { ...file }
  delete metadata.url
  delete metadata.path

  return path ? { ...metadata, path } : metadata
}

export function sanitizeJobStorageMetadata(job, supabaseUrl, bucket = DEFAULT_STORAGE_BUCKET) {
  const documents = job.documents && typeof job.documents === 'object' && !Array.isArray(job.documents)
    ? Object.fromEntries(Object.entries(job.documents).map(([key, value]) => [
      key,
      sanitizeStorageFile(value, job.id, supabaseUrl, bucket),
    ]))
    : { material: null, assembly: null }

  return {
    documents,
    photos: Array.isArray(job.photos)
      ? job.photos.map((photo) => sanitizeStorageFile(photo, job.id, supabaseUrl, bucket))
      : [],
    main_photo: sanitizeStorageFile(job.mainPhoto, job.id, supabaseUrl, bucket) || null,
  }
}
