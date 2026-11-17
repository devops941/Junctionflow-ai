export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface Junction {
  _id?: string
  junction_id: string
  name: string
  location?: { lat: number; lng: number }
  capacity_per_hour?: number
  created_at?: string
}

export interface ColumnMapping {
  timestamp: string
  junction_id: string
  vehicle_count: string
  temperature_c?: string
  rainfall_mm?: string
  humidity_pct?: string
  wind_speed_kmh?: string
  weather_condition?: string
  is_holiday?: string
  event_flag?: string
}

export interface ValidationReport {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  missing_required: string[]
  duplicate_rows: number
  out_of_range: Record<string, number>
  warnings: string[]
  errors: string[]
}

export interface Dataset {
  _id: string
  name: string
  original_filename: string
  row_count: number
  column_mapping?: ColumnMapping
  date_range?: { start: string; end: string }
  junction_ids: string[]
  status: 'uploaded' | 'validated' | 'failed' | 'processed'
  validation_report?: ValidationReport
  created_at: string
}

export interface ModelMetrics {
  mae: number
  rmse: number
  mape: number
  smape: number
  r2: number
}

export interface MLModel {
  _id: string
  name: string
  algorithm: 'seasonal_naive' | 'sarimax' | 'random_forest'
  version: number
  junction_id: string
  dataset_id: string
  feature_set_id?: string
  hyperparameters: Record<string, unknown>
  metrics?: ModelMetrics
  status: 'training' | 'ready' | 'failed'
  is_active: boolean
  training_duration_sec?: number
  created_at: string
  error_message?: string
}

export interface ForecastPoint {
  timestamp: string
  predicted: number
  lower_ci?: number
  upper_ci?: number
  actual?: number
  congestion_level: 'low' | 'moderate' | 'high' | 'critical'
}

export interface Forecast {
  _id: string
  model_id: string
  junction_id: string
  horizon_hours: number
  generated_at: string
  predictions: ForecastPoint[]
}

export interface FeatureConfig {
  include_hour: boolean
  include_dow: boolean
  include_dom: boolean
  include_month: boolean
  include_week_of_year: boolean
  include_is_weekend: boolean
  cyclical_hour: boolean
  cyclical_dow: boolean
  include_holiday: boolean
  include_event: boolean
  lags: number[]
  rolling_windows: number[]
  rolling_stats: string[]
  include_weather_numeric: boolean
  include_weather_onehot: boolean
  scale_numeric: boolean
}

export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  include_hour: true,
  include_dow: true,
  include_dom: true,
  include_month: true,
  include_week_of_year: true,
  include_is_weekend: true,
  cyclical_hour: true,
  cyclical_dow: true,
  include_holiday: true,
  include_event: true,
  lags: [1, 2, 3, 24, 168],
  rolling_windows: [3, 24, 168],
  rolling_stats: ['mean', 'std'],
  include_weather_numeric: true,
  include_weather_onehot: true,
  scale_numeric: true,
}

export interface FeatureSet {
  _id: string
  dataset_id: string
  junction_id?: string
  config: FeatureConfig
  feature_columns: string[]
  total_features: number
  train_rows: number
  test_rows: number
  status: 'pending' | 'computing' | 'ready' | 'failed'
  error_message?: string
  created_at: string
}

export interface FeaturePreview {
  feature_columns: string[]
  total_features: number
  train_rows: number
  test_rows: number
  sample_size: number
  preview_columns: string[]
  preview_rows: Record<string, unknown>[]
  correlation: Record<string, number>
}
