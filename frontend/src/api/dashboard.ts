import api from './client'

export interface DashboardSummary {
  total_junctions: number
  total_datasets: number
  total_models: number
  active_models: number
  total_forecasts: number
}

export interface LiveCongestion {
  junction_id: string
  junction_name: string
  predicted: number
  congestion_level: 'low' | 'moderate' | 'high' | 'critical'
  capacity: number | null
  ratio: number | null
}

export interface CongestionAlert {
  junction_id: string
  junction_name: string
  timestamp: string
  predicted: number
  congestion_level: 'high' | 'critical'
  capacity: number | null
  ratio: number | null
}

export interface RecentForecast {
  _id: string
  junction_id: string
  horizon_hours: number
  generated_at: string
}

export interface AccuracyModel {
  model_id: string
  model_name: string
  algorithm: string
  version: number
  color: string
  is_baseline: boolean
  metrics: { mae: number; rmse: number; mape: number; smape: number; r2: number }
  improvement_vs_baseline: { mae: number; rmse: number; mape: number } | null
  comparison_data: Array<{ timestamp: string; actual: number; predicted: number; residual: number; lower_ci: number; upper_ci: number }>
  hourly_mae: Array<{ hour: number; mae: number }>
  test_window_hours: number
}

export interface AccuracyData {
  models: AccuracyModel[]
  best_model_id: string | null
  has_baseline: boolean
  junction_id: string
  dataset_id: string
}

export const getDashboardSummary = () =>
  api.get<{ data: DashboardSummary }>('/dashboard/summary').then(r => r.data.data)

export const getLiveCongestion = () =>
  api.get<{ data: LiveCongestion[] }>('/dashboard/live-congestion').then(r => r.data.data)

export const getRecentForecasts = (limit = 5) =>
  api.get<{ data: RecentForecast[] }>('/dashboard/recent-forecasts', { params: { limit } }).then(r => r.data.data)

export const getCongestionAlerts = (hoursAhead = 24) =>
  api.get<{ data: CongestionAlert[] }>('/dashboard/congestion-alerts', { params: { hours_ahead: hoursAhead } }).then(r => r.data.data)

export const getAccuracyComparison = (junctionId: string, datasetId: string) =>
  api.get<{ data: AccuracyData }>('/dashboard/accuracy', { params: { junction_id: junctionId, dataset_id: datasetId } }).then(r => r.data.data)
