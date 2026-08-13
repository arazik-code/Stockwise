import api from './client'

export interface BackupFile {
  fileName: string
  sizeBytes: number
  createdAtUtc: string
  kind: string
}

export interface CreateBackupResult {
  success: boolean
  message: string
  backup: BackupFile | null
}

export interface OperationResult {
  success: boolean
  message: string
}

export const adminBackupApi = {
  list: () => api.get<BackupFile[]>('/admin/backup').then((r) => r.data),
  create: () => api.post<CreateBackupResult>('/admin/backup').then((r) => r.data),
  restore: (fileName: string, password: string) =>
    api.post<OperationResult>(`/admin/backup/${encodeURIComponent(fileName)}/restore`, { password }).then((r) => r.data),
  reset: (password: string, confirmation: string) =>
    api.post<OperationResult>('/admin/backup/reset', { password, confirmation }).then((r) => r.data),
}
