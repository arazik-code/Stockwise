import { sizesApi } from './sizes'
import type { Size, CreateSizeRequest } from '../types/size'

export type SizePreset = Size
export type CreateSizePresetRequest = CreateSizeRequest

export const sizePresetsApi = {
  getAll: sizesApi.getAll,
  create: sizesApi.create,
  update: sizesApi.update,
  delete: sizesApi.delete,
}
