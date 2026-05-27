import client from './client'

export const getObjects = () =>
  client.get('/objects').then(r => r.data)

export const getObject = (id) =>
  client.get(`/objects/${id}`).then(r => r.data)

export const createObject = (data) =>
  client.post('/objects', data).then(r => r.data)

export const updateObject = (id, data) =>
  client.patch(`/objects/${id}`, data).then(r => r.data)

export const getObjectMembers = (objectId) =>
  client.get(`/objects/${objectId}/members`).then(r => r.data)

export const addObjectMember = (objectId, userId) =>
  client.post(`/objects/${objectId}/members`, { user_id: userId }).then(r => r.data)

export const removeObjectMember = (objectId, userId) =>
  client.delete(`/objects/${objectId}/members/${userId}`)

export const getObjectOrganizations = (objectId) =>
  client.get(`/objects/${objectId}/organizations`).then(r => r.data)

export const addObjectOrganization = (objectId, data) =>
  client.post(`/objects/${objectId}/organizations`, data).then(r => r.data)