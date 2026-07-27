export interface Color {
  id: number
  name: string
  hexCode: string
  sortOrder: number
}

export interface CreateColorRequest {
  name: string
  hexCode: string
  sortOrder: number
}
