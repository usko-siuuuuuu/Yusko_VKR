import client from './client'

export const getSummary = (objectId) =>
  client.get('/analytics/summary', { params: { object_id: objectId } }).then((r) => r.data)

export const getByStatus = (objectId) =>
  client.get('/analytics/by-status', { params: { object_id: objectId } }).then((r) => r.data)

export const getByWorkType = (objectId) =>
  client.get('/analytics/by-work-type', { params: { object_id: objectId } }).then((r) => r.data)

export const getByContractor = (objectId) =>
  client.get('/analytics/by-contractor', { params: { object_id: objectId } }).then((r) => r.data)

export const getOverdue = (objectId) =>
  client.get('/analytics/overdue', { params: { object_id: objectId } }).then((r) => r.data)

export const getTimeline = (objectId, weeks = 8) =>
  client.get('/analytics/timeline', { params: { object_id: objectId, weeks } }).then((r) => r.data)