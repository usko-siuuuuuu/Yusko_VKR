import client from './client'

export const getAttachments = (issueId) =>
  client.get(`/issues/${issueId}/attachments`).then((r) => r.data)

export const uploadAttachment = (issueId, file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post(`/issues/${issueId}/attachments`, form).then((r) => r.data)
}

export const getDownloadUrl = (attachmentId) =>
  client.get(`/attachments/${attachmentId}/download`).then((r) => r.data)

export const deleteAttachment = (attachmentId) =>
  client.delete(`/attachments/${attachmentId}`).then((r) => r.data)