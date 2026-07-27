export interface Product {
  id: number
  name: string
  description?: string
  brand?: string
  barcode?: string
  imageUrl?: string
  price: number
  costPrice?: number
  liquidationPrice?: number
  onlinePrice?: number
  categoryId: number
  categoryName: string
  fournisseurId?: number
  fournisseurNom?: string
  isActive: boolean
  shopifyProductId?: number
  variants: ProductVariant[]
}

export interface ProductVariant {
  id: number
  productId: number
  colorId: number
  colorName: string
  colorHexCode: string
  sizeId: number
  sizeValue: string
  sku: string
  barcode?: string
  price: number
  costPrice?: number
  imageUrl?: string
  isActive: boolean
  isLiquidation: boolean
  stockQuantity: number
}

export interface CreateProductRequest {
  name: string
  description?: string
  brand?: string
  imageUrl?: string
  price: number
  costPrice?: number
  liquidationPrice?: number
  onlinePrice?: number
  categoryId: number
  fournisseurId?: number
}

export interface CreateProductVariantRequest {
  productId: number
  colorId: number
  sizeId: number
  sku?: string
  barcode?: string
  imageUrl?: string
  isLiquidation?: boolean
  initialStock: number
  reorderLevel: number
}

export interface Category {
  id: number
  name: string
  description?: string
  parentCategoryId?: number
  subCategories: Category[]
}
