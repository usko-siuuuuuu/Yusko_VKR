import client from './client'

export const getOrganizations = (params = {}) =>
  client.get('/organizations', { params }).then(r => r.data)

export const createOrganization = (data) =>
  client.post('/organizations', data).then(r => r.data)

export const updateOrganization = (id, data) =>
  client.patch(`/organizations/${id}`, data).then(r => r.data)