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

function removeUploadedAttachment(documents, attachment) {
  if (!attachment) return documents || {}
  const attachments = getDocumentationAttachments(documents)
  const nextAttachments = attachments.filter((item) => {
    if (attachment.id != null && item?.id != null) {
      return String(item.id) !== String(attachment.id)
    }
    return item?.path !== attachment.path
  })
  if (nextAttachments.length === attachments.length) return documents || {}
  return { ...(documents || {}), attachments: nextAttachments }
}

function restoreAttachment(documents, attachment) {
  const current = getDocumentationAttachments(documents)
  const alreadyPresent = current.some((item) =>
    (attachment.id != null && item?.id != null && String(item.id) === String(attachment.id)) ||
    (attachment.path && item?.path === attachment.path)
  )
  if (alreadyPresent) return documents || {}
  return { ...(documents || {}), attachments: [...current, attachment] }
}

/**
 * Uploads a file, then changes only the documents JSONB field through the
 * optimistic-concurrency saveDocuments API. Rollback removes only this upload.
 */
export async function saveDocumentationAttachment({
  job,
  file,
  uploadFile,
  saveDocuments,
  deleteFile,
  createAttachment,
}) {
  const uploadedFile = await uploadFile(job.id, file)
  let attachment = null

  try {
    attachment = createAttachment(file, uploadedFile)
    const saved = await saveDocuments(job.id, (currentDocuments) =>
      appendDocumentationAttachment(currentDocuments, attachment)
    )
    // Production returns a fresh full job; simple unit fakes may return documents.
    return saved && String(saved.id) === String(job.id) && Object.hasOwn(saved, 'documents')
      ? saved
      : { ...job, documents: saved }
  } catch (error) {
    // The database request may have committed even if its response was lost.
    // Remove only this attachment from the latest metadata; never restore a
    // stale whole-job snapshot or remove another writer's changes.
    let rollbackSucceeded = false
    try {
      await saveDocuments(job.id, (currentDocuments) =>
        removeUploadedAttachment(currentDocuments, attachment || uploadedFile)
      )
      rollbackSucceeded = true
    } catch (restoreError) {
      if (error && typeof error === 'object') error.restoreError = restoreError
    }

    if (rollbackSucceeded && uploadedFile?.path) {
      try {
        await deleteFile(uploadedFile.path)
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError
      }
    }
    throw error
  }
}

/**
 * Removes metadata first and then the Storage object. If the metadata request
 * fails ambiguously, restore the selected attachment against the latest value:
 * the write may have committed even though its response was lost.
 */
export async function deleteDocumentationAttachment({
  job,
  attachmentId,
  saveDocuments,
  deleteFile,
}) {
  const attachment = getDocumentationAttachments(job.documents).find(
    (item) => String(item?.id) === String(attachmentId)
  )
  if (!attachment) return job

  let saved
  try {
    saved = await saveDocuments(job.id, (currentDocuments) =>
      removeDocumentationAttachment(currentDocuments, attachmentId)
    )
  } catch (error) {
    try {
      await saveDocuments(job.id, (currentDocuments) =>
        restoreAttachment(currentDocuments, attachment)
      )
    } catch (restoreError) {
      if (error && typeof error === 'object') error.restoreError = restoreError
    }
    throw error
  }

  const savedJob = saved && String(saved.id) === String(job.id) && Object.hasOwn(saved, 'documents')
    ? saved
    : { ...job, documents: saved }

  if (!attachment.path) return savedJob

  try {
    await deleteFile(attachment.path)
    return savedJob
  } catch (error) {
    try {
      await saveDocuments(job.id, (currentDocuments) =>
        restoreAttachment(currentDocuments, attachment)
      )
    } catch (restoreError) {
      if (error && typeof error === 'object') error.restoreError = restoreError
    }
    throw error
  }
}
