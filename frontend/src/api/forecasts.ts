import api from './client'

export interface FutureWeather {
  temperature_c?: number | null
  rainfall_mm?: number | null
  humidity_pct?: number | null
  wind_speed_kmh?: number | null
  weather_condition?: string | null
}

export interface ForecastPoint {
  timestamp: string
  predicted: number
  lower_ci?: number
  upper_ci?: number
  actual?: number | null
  congestion_level: 'low' | 'moderate' | 'high' | 'critical'
}

export interface ForecastResult {
  _id: string
  model_id: string
  junction_id: string
  horizon_hours: number
  generated_at: string
  predictions: ForecastPoint[]
}

export const generateForecast = (body: {
  model_id: string
  junction_id: string
  horizon_hours: number
  future_weather?: FutureWeather | null
}): Promise<ForecastResult> => api.post<{ data: ForecastResult }>('/forecasts', body).then((r: any): ForecastResult => r.data.data as ForecastResult)

export const listForecasts = (params?: { junction_id?: string; model_id?: string }): Promise<ForecastResult[]> =>
  api.get<{ data: ForecastResult[] }>('/forecasts', { params }).then((r: any): ForecastResult[] => r.data.data as ForecastResult[])

export const getForecast = (id: string): Promise<ForecastResult> =>
  api.get<{ data: ForecastResult }>(`/forecasts/${id}`).then((r: any): ForecastResult => r.data.data as ForecastResult)
