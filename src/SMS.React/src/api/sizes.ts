import api from './client'
import type { Size, CreateSizeRequest } from '../types/size'

export const sizesApi = {
  getAll: () => api.get<Size[]>('/sizes').then((r) => r.data),
  getById: (id: number) => api.get<Size>(`/sizes/${id}`).then((r) => r.data),
  create: (data: CreateSizeRequest) => api.post<Size>('/sizes', data).then((r) => r.data),
  update: (id: number, data: Partial<Size>) => api.put<Size>(`/sizes/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/sizes/${id}`),
}
