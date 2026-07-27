import api from './client'

export interface Category {
  id: number
  name: string
  description?: string
  parentCategoryId?: number
  subCategories: Category[]
}

export interface CreateCategoryRequest {
  name: string
  description?: string
  parentCategoryId?: number
}

export interface UpdateCategoryRequest {
  name?: string
  description?: string
}

export const categoriesApi = {
  getAll: () => api.get<Category[]>('/categories').then((r) => r.data),
  getById: (id: number) => api.get<Category>(`/categories/${id}`).then((r) => r.data),
  create: (data: CreateCategoryRequest) => api.post<Category>('/categories', data).then((r) => r.data),
  update: (id: number, data: UpdateCategoryRequest) => api.put<Category>(`/categories/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/categories/${id}`),
}
