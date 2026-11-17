import api from './client'

interface FilterParams {
  datasetId: string
  junctionIds?: string[]
  start?: string
  end?: string
  weekdays?: number[]
  hourStart?: number
  hourEnd?: number
  weatherCondition?: string
  isHoliday?: string
}

function toQueryParams(f: FilterParams) {
  return {
    dataset_id: f.datasetId,
    junction_ids: f.junctionIds?.join(',') || undefined,
    start: f.start || undefined,
    end: f.end || undefined,
    weekdays: f.weekdays?.join(',') || undefined,
    hour_start: f.hourStart,
    hour_end: f.hourEnd,
    weather_condition: f.weatherCondition || undefined,
    is_holiday: f.isHoliday === 'all' ? undefined : f.isHoliday,
  }
}

export const getFilteredSummary = (f: FilterParams) =>
  api.get('/explore/filtered-summary', { params: toQueryParams(f) }).then((r: any) => r.data?.data)

export const getFilteredTimeseries = (f: FilterParams, resample = '1h') =>
  api.get('/explore/filtered-timeseries', { params: { ...toQueryParams(f), resample } }).then((r: any) => r.data?.data)

export const getHeatmap = (f: FilterParams) =>
  api.get('/explore/heatmap', { params: toQueryParams(f) }).then((r: any) => r.data?.data)

export const getWeekdayAvg = (f: FilterParams) =>
  api.get('/explore/weekday-avg', { params: toQueryParams(f) }).then((r: any) => r.data?.data)

export const getWeatherImpact = (f: FilterParams) =>
  api.get('/explore/weather-impact', { params: toQueryParams(f) }).then((r: any) => r.data?.data)

export const getStlDecomposition = (f: FilterParams & { junctionId: string; period?: number }) =>
  api.get('/explore/stl-decomposition', {
    params: { dataset_id: f.datasetId, junction_id: f.junctionId, start: f.start, end: f.end, period: f.period ?? 24 }
  }).then((r: any) => r.data?.data)

export const getJunctionComparison = (f: FilterParams, resample = '1D') =>
  api.get('/explore/junction-comparison', { params: { ...toQueryParams(f), resample } }).then((r: any) => r.data?.data)

export const getRawRecords = (
  f: FilterParams,
  page = 1,
  pageSize = 15,
  sortBy = 'timestamp',
  sortDir = 'asc',
) =>
  api.get('/explore/raw-records', {
    params: { ...toQueryParams(f), page, page_size: pageSize, sort_by: sortBy, sort_dir: sortDir }
  }).then((r: any) => r.data?.data)

export const getExportUrl = (f: FilterParams, format: 'csv' | 'xlsx') => {
  const base = ((import.meta as any).env.VITE_API_URL || '') + '/api/v1'
  const p = new URLSearchParams()
  const params = toQueryParams(f)
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) p.set(k, String(v)) })
  p.set('format', format)
  return `${base}/explore/export?${p.toString()}`
}

// Legacy
export const getTimeseries = (datasetId: string, junctionId: string, start?: string, end?: string, resample = '1h') =>
  api.get('/explore/timeseries', { params: { dataset_id: datasetId, junction_id: junctionId, start, end, resample } }).then((r: any) => r.data?.data)

export const getSummary = (datasetId: string, junctionId?: string) =>
  api.get('/explore/summary', { params: { dataset_id: datasetId, junction_id: junctionId } }).then((r: any) => r.data?.data)
