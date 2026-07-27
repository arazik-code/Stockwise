import api from './client'
import type { Color, CreateColorRequest } from '../types/color'

export const colorsApi = {
  getAll: () => api.get<Color[]>('/colors').then((r) => r.data),
  getById: (id: number) => api.get<Color>(`/colors/${id}`).then((r) => r.data),
  create: (data: CreateColorRequest) => api.post<Color>('/colors', data).then((r) => r.data),
  update: (id: number, data: Partial<Color>) => api.put<Color>(`/colors/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/colors/${id}`),
}
