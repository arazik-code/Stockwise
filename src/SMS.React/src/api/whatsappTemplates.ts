import api from './client'

export interface WhatsAppTemplate {
  id: number
  name: string
  body: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveWhatsAppTemplateRequest {
  name: string
  body: string
}

export const whatsappTemplatesApi = {
  getAll: () => api.get<WhatsAppTemplate[]>('/whatsapp-templates').then((r) => r.data),
  create: (request: SaveWhatsAppTemplateRequest) =>
    api.post<WhatsAppTemplate>('/whatsapp-templates', request).then((r) => r.data),
  update: (id: number, request: SaveWhatsAppTemplateRequest) =>
    api.put<WhatsAppTemplate>(`/whatsapp-templates/${id}`, request).then((r) => r.data),
  delete: (id: number) => api.delete(`/whatsapp-templates/${id}`),
  setDefault: (id: number) => api.post<WhatsAppTemplate>(`/whatsapp-templates/${id}/set-default`).then((r) => r.data),
}
