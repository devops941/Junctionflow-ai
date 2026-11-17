import api from './client'
import type { PaginatedResponse } from '../types'

export interface MLModelRow {
  _id: string
  name: string
  algorithm: 'seasonal_naive' | 'sarimax' | 'random_forest'
  version: number
  junction_id: string
  dataset_id: string
  feature_set_id?: string
  hyperparameters: Record<string, unknown>
  metrics?: { mae: number; rmse: number; mape: number; smape: number; r2: number }
  status: 'training' | 'ready' | 'failed'
  is_active: boolean
  training_duration_sec?: number
  created_at: string
  error_message?: string
  train_range?: { start: string; end: string }
  test_range?: { start: string; end: string }
}

export interface TrainModelBody {
  name: string
  algorithm: string
  junction_id: string
  dataset_id: string
  feature_set_id?: string
  hyperparameters?: Record<string, unknown>
}

export const getModels = (params?: {
  junction_id?: string
  algorithm?: string
  page?: number
  page_size?: number
}) => api.get<{ data: PaginatedResponse<MLModelRow> }>('/models', { params }).then((r: any): PaginatedResponse<MLModelRow> => r.data as PaginatedResponse<MLModelRow>)

export const getModel = (id: string) =>
  api.get<{ data: { data: MLModelRow } }>(`/models/${id}`).then((r: any): MLModelRow => r.data.data as MLModelRow)

export const trainModel = (body: TrainModelBody) =>
  api.post<{ data: { data: MLModelRow } }>('/models', body).then((r: any): MLModelRow => r.data.data as MLModelRow)

export const activateModel = (id: string) =>
  api.post<{ data: { data: MLModelRow } }>(`/models/${id}/activate`).then((r: any): MLModelRow => r.data.data as MLModelRow)

export const deleteModel = (id: string) =>
  api.delete(`/models/${id}`).then((r: any): any => r.data)

export const getFeatureImportance = (id: string) =>
  api.get<{ data: { data: Record<string, number> } }>(`/models/${id}/importance`).then((r: any): Record<string, number> => r.data.data as Record<string, number>)
