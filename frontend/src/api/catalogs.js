import client from './client'

export const getWorkTypes = (activeOnly = true) =>
  client.get('/work-types', { params: { active_only: activeOnly } }).then((r) => r.data)

export const getContractors = (activeOnly = true) =>
  client.get('/contractors', { params: { active_only: activeOnly } }).then((r) => r.data)

export const getDefectCauses = (activeOnly = true) =>
  client.get('/defect-causes', { params: { active_only: activeOnly } }).then((r) => r.data)

export const getObjects = () =>
  client.get('/construction-objects').then((r) => r.data)

export const getLocations = (objectId) =>
  client.get('/locations', { params: { object_id: objectId } }).then((r) => r.data)