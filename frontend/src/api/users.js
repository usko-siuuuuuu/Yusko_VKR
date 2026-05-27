import client from './client'

export const getUsers = () =>
  client.get('/users').then(r => r.data)

export const createUser = (data) =>
  client.post('/users', data).then(r => r.data)

export const updateUser = (id, data) =>
  client.patch(`/users/${id}`, data).then(r => r.data)