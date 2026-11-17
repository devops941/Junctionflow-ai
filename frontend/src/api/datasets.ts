import api from './client'
import type { Dataset, PaginatedResponse, ColumnMapping } from '../types'

export const getDatasets = (page = 1, pageSize = 20) =>
  api.get<PaginatedResponse<Dataset>>('/datasets', { params: { page, page_size: pageSize } }).then(r => r.data)

export const getDataset = (id: string) =>
  api.get(`/datasets/${id}`).then(r => r.data.data)

export const uploadDataset = (file: File, name: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  return api.post('/datasets/upload', form).then(r => r.data.data)
}

export const validateDataset = (id: string, mapping: ColumnMapping) =>
  api.post(`/datasets/${id}/validate`, mapping).then(r => r.data)

export const previewDataset = (id: string, rows = 20) =>
  api.get(`/datasets/${id}/preview`, { params: { rows } }).then(r => r.data.data)

export const deleteDataset = (id: string) =>
  api.delete(`/datasets/${id}`).then(r => r.data)
