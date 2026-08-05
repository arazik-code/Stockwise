import { hardwareApi as api } from './hardwareClient'

export interface DeviceStatus {
  printer: {
    name: string
    detail: string
    connectionType: string
    online: boolean
  }
  scanner: {
    name: string
    type: string
    connected: boolean
  }
}

export const devicesApi = {
  getStatus: () => api.get<DeviceStatus>('/devices/status').then((r) => r.data),
  testPrinter: () => api.post<{ online: boolean; message: string }>('/devices/printer/test').then((r) => r.data),
}
