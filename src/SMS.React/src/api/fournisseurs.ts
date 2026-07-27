import api from './client'
import type {
  Fournisseur,
  CreateFournisseurRequest,
  UpdateFournisseurRequest,
  FournisseurPerformance,
  FournisseurRecommendation,
  ReceiveDeliveryRequest,
  ReceiveDeliveryResponse,
} from '../types/fournisseur'

export const fournisseursApi = {
  getAll: () => api.get<Fournisseur[]>('/fournisseurs').then((r) => r.data),
  getById: (id: number) => api.get<Fournisseur>(`/fournisseurs/${id}`).then((r) => r.data),
  create: (data: CreateFournisseurRequest) => api.post<Fournisseur>('/fournisseurs', data).then((r) => r.data),
  update: (id: number, data: UpdateFournisseurRequest) =>
    api.put<Fournisseur>(`/fournisseurs/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/fournisseurs/${id}`),
  getPerformance: () => api.get<FournisseurPerformance[]>('/fournisseurs/performance').then((r) => r.data),
  getRecommendations: () =>
    api.get<FournisseurRecommendation[]>('/fournisseurs/recommandations').then((r) => r.data),
  receiveDelivery: (id: number, data: ReceiveDeliveryRequest) =>
    api.post<ReceiveDeliveryResponse>(`/fournisseurs/${id}/receive`, data).then((r) => r.data),
}
