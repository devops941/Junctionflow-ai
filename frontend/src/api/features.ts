import api from './client'
import type { FeatureConfig } from '../types'

export const getFeatureSets = (datasetId: string) =>
  api.get('/features', { params: { dataset_id: datasetId } }).then(r => r.data.data)

export const getFeatureSet = (id: string) =>
  api.get(`/features/${id}`).then(r => r.data.data)

export const createFeatureSet = (body: {
  dataset_id: string
  junction_id?: string
  config: FeatureConfig
}) => api.post('/features', body).then(r => r.data.data)

export const previewFeatures = (body: FeatureConfig & {
  dataset_id: string
  junction_id: string
  sample_size?: number
}) => api.post('/features/preview', body).then(r => r.data.data)

export const deleteFeatureSet = (id: string) =>
  api.delete(`/features/${id}`).then(r => r.data)
