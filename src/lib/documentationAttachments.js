export function getDocumentationAttachments(documents) {
  return Array.isArray(documents?.attachments) ? documents.attachments : []
}

export function appendDocumentationAttachment(documents, attachment) {
  return {
    ...(documents || {}),
    attachments: [...getDocumentationAttachments(documents), attachment],
  }
}

export function removeDocumentationAttachment(documents, attachmentId) {
  return {
    ...(documents || {}),
    attachments: getDocumentationAttachments(documents).filter(
      (item) => String(item?.id) !== String(attachmentId)
    ),
  }
}

/**
 * Uploads a file and persists its metadata before exposing it in local UI state.
 * Dependencies are injected so the full lifecycle can be tested without Supabase.
 */
export async function saveDocumentationAttachment({
  job,
  file,
  uploadFile,
  saveJob,
  deleteFile,
  createAttachment,
}) {
  const uploadedFile = await uploadFile(job.id, file)

  try {
    const attachment = createAttachment(file, uploadedFile)
    const updatedJob = {
      ...job,
      documents: appendDocumentationAttachment(job.documents, attachment),
    }
    const savedJob = await saveJob(updatedJob)
    return savedJob || updatedJob
  } catch (error) {
    if (uploadedFile?.path) {
      try {
        await deleteFile(uploadedFile.path)
      } catch (cleanupError) {
        if (error && typeof error === 'object') {
          error.cleanupError = cleanupError
        }
      }
    }
    throw error
  }
}

/**
 * Persists metadata removal, then deletes the object. If Storage deletion fails,
 * attempts to restore the original metadata so the user can retry.
 */
export async function deleteDocumentationAttachment({
  job,
  attachmentId,
  saveJob,
  deleteFile,
}) {
  const attachment = getDocumentationAttachments(job.documents).find(
    (item) => String(item?.id) === String(attachmentId)
  )
  if (!attachment) return job

  const updatedJob = {
    ...job,
    documents: removeDocumentationAttachment(job.documents, attachmentId),
  }
  const savedJob = await saveJob(updatedJob)

  if (!attachment.path) return savedJob || updatedJob

  try {
    await deleteFile(attachment.path)
    return savedJob || updatedJob
  } catch (error) {
    try {
      await saveJob(job)
    } catch (restoreError) {
      error.restoreError = restoreError
    }
    throw error
  }
}
