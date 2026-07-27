import { colorsApi } from './colors'
import type { Color, CreateColorRequest } from '../types/color'

export type ColorPreset = Color
export type CreateColorPresetRequest = CreateColorRequest

export const colorPresetsApi = {
  getAll: colorsApi.getAll,
  create: colorsApi.create,
  update: colorsApi.update,
  delete: colorsApi.delete,
}
