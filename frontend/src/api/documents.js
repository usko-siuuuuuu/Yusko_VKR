import client from './client'

export const getDocuments = (params = {}) =>
  client.get('/documents', { params }).then(r => r.data)

export const createDocument = (data) =>
  client.post('/documents', data).then(r => r.data)

export const updateDocument = (id, data) =>
  client.patch(`/documents/${id}`, data).then(r => r.data)