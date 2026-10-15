function containsStoragePath(value, path) {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((item) => containsStoragePath(item, path))
  if (value.path === path) return true
  return Object.values(value).some((item) => containsStoragePath(item, path))
}

/**
 * Best-effort cleanup after a photo append RPC fails.
 *
 * RPC errors can be ambiguous: the database may have committed even if the
 * client lost the response. Delete the uploaded object only after a successful
 * read confirms that the path is not referenced by the current job metadata.
 * If the read is inconclusive or cleanup fails, preserve the file.
 */
export async function cleanupUnreferencedPhotoUpload({
  jobId,
  photo,
  readJobFiles,
  deleteFile,
  logger = console,
}) {
  if (!jobId || !photo?.path || typeof readJobFiles !== 'function' || typeof deleteFile !== 'function') {
    return false
  }

  try {
    const { data, error } = await readJobFiles(jobId)
    if (error || !data) {
      if (error) logger.error?.('Nie można sprawdzić referencji zdjęcia po błędzie zapisu; plik pozostaje w Storage:', error)
      return false
    }

    const isReferenced = [
      data.photos,
      data.main_photo,
      data.documents,
    ].some((metadata) => containsStoragePath(metadata, photo.path))

    if (isReferenced) return false

    await deleteFile(photo.path)
    return true
  } catch (error) {
    logger.error?.('Nie udało się bezpiecznie sprawdzić lub posprzątać zdjęcia po błędzie zapisu; plik pozostaje w Storage:', error)
    return false
  }
}
