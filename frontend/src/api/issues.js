import client from './client'

export const getIssues = (objectId, params = {}) =>
  client.get('/issues', { params: { object_id: objectId, ...params } }).then(r => r.data)

export const getIssue = (id) =>
  client.get(`/issues/${id}`).then(r => r.data)

export const createIssue = (data) =>
  client.post('/issues', data).then(r => r.data)

export const updateIssue = (id, data) =>
  client.patch(`/issues/${id}`, data).then(r => r.data)

export const changeStatus = (id, new_status, comment) =>
  client.post(`/issues/${id}/status`, { new_status, comment }).then(r => r.data)

export const getIssueHistory = (id) =>
  client.get(`/issues/${id}/history`).then(r => r.data)