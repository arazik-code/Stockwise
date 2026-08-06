import api from './client'

export interface AdminUser {
  [key: string]: unknown
  id: number
  username: string
  fullName: string
  roleId: number
  roleName: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface CreateUserRequest {
  username: string
  fullName: string
  roleId: number
  password?: string
}

export interface UpdateUserRequest {
  fullName?: string
  roleId?: number
  isActive?: boolean
}

export const adminUsersApi = {
  getAll: (search?: string) =>
    api.get<AdminUser[]>('/admin/users', { params: search ? { search } : undefined }).then((r) => r.data),
  create: (data: CreateUserRequest) =>
    api.post<{ user: AdminUser; temporaryPassword: string | null }>('/admin/users', data).then((r) => r.data),
  update: (id: number, data: UpdateUserRequest) =>
    api.put<AdminUser>(`/admin/users/${id}`, data).then((r) => r.data),
  resetPassword: (id: number, newPassword?: string) =>
    api.post<{ temporaryPassword: string }>(`/admin/users/${id}/reset-password`, { newPassword }).then((r) => r.data),
}
