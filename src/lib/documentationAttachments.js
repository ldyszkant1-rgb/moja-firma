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
