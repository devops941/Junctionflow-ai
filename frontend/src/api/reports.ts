import api from './client'

export const createReport = (body: { type: string; format: string; params: Record<string, unknown> }) =>
  api.post('/reports', body).then(r => r.data.data)

export const getReports = () =>
  api.get('/reports').then(r => r.data.data)

export const downloadReport = (id: string) =>
  api.get(`/reports/${id}/download`, { responseType: 'blob' }).then(r => r.data)

export const deleteReport = (id: string) =>
  api.delete(`/reports/${id}`).then(r => r.data)
