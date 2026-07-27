export interface Fournisseur {
  id: number
  nom: string
  contact?: string
  email?: string
  telephone?: string
  adresse?: string
  produitsCount: number
}

export interface CreateFournisseurRequest {
  nom: string
  contact?: string
  email?: string
  telephone?: string
  adresse?: string
}

export interface UpdateFournisseurRequest {
  nom?: string
  contact?: string
  email?: string
  telephone?: string
  adresse?: string
}

export interface TopProductFournisseur {
  productId: number
  productName: string
  quantiteVendue: number
  revenu: number
}

export interface FournisseurPerformance {
  id: number
  nom: string
  revenuTotal: number
  beneficeTotal: number
  unitesVendues: number
  margePct: number
  tauxEcoulement: number
  rotationStock: number
  topProduits: TopProductFournisseur[]
  tendance: 'hausse' | 'baisse' | 'stable'
  actionRecommendee: string
  balanceImpayee: number
}

export interface FournisseurRecommendation {
  fournisseurId: number
  nom: string
  score: number
  raisons: string[]
}

export interface ReceiveDeliveryItemRequest {
  productVariantId: number
  quantity: number
}

export interface ReceiveDeliveryRequest {
  reference?: string
  notes?: string
  items: ReceiveDeliveryItemRequest[]
}

export interface ReceiveDeliveryResponse {
  itemsReceived: number
  totalQuantityAdded: number
}
