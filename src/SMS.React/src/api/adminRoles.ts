import api from './client'

export interface Role {
  id: number
  name: string
  description: string | null
  isSystem: boolean
  sections: string[]
  userCount: number
}

export interface CreateRoleRequest {
  name: string
  description?: string
  sections: string[]
}

export interface UpdateRoleRequest {
  description?: string
  sections?: string[]
}

export const adminRolesApi = {
  getAll: () => api.get<Role[]>('/admin/roles').then((r) => r.data),
  getAvailableSections: () => api.get<string[]>('/admin/roles/sections').then((r) => r.data),
  create: (data: CreateRoleRequest) => api.post<Role>('/admin/roles', data).then((r) => r.data),
  update: (id: number, data: UpdateRoleRequest) => api.put<Role>(`/admin/roles/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/admin/roles/${id}`),
}
