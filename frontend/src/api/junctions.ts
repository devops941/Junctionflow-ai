import api from './client'
import type { Junction, PaginatedResponse } from '../types'

export const getJunctions = (page = 1, pageSize = 20) =>
  api.get<PaginatedResponse<Junction>>('/junctions', { params: { page, page_size: pageSize } }).then(r => r.data)

export const createJunction = (body: Partial<Junction>) =>
  api.post('/junctions', body).then(r => r.data.data)

export const updateJunction = (junctionId: string, body: Partial<Junction>) =>
  api.patch(`/junctions/${junctionId}`, body).then(r => r.data.data)

export const deleteJunction = (junctionId: string) =>
  api.delete(`/junctions/${junctionId}`).then(r => r.data)
