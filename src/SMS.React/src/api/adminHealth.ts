import api from './client'

export interface HealthProbeResult {
  name: string
  category: string
  status: 'healthy' | 'degraded' | 'down' | 'not_configured'
  message: string
  latencyMs: number
  checkedAt: string
}

export interface HealthBoard {
  overallStatus: 'healthy' | 'degraded' | 'down'
  generatedAt: string
  probes: HealthProbeResult[]
}

export const adminHealthApi = {
  getFull: () => api.get<HealthBoard>('/admin/health/full').then((r) => r.data),
}

export interface AuditLogEntry {
  [key: string]: unknown
  id: number
  actorUsername: string
  action: string
  targetType: string
  targetId: string | null
  details: string | null
  createdAt: string
}

export const adminAuditApi = {
  getRecent: (limit = 50) => api.get<AuditLogEntry[]>('/admin/audit-log', { params: { limit } }).then((r) => r.data),
}
