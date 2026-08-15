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
  /** True when any colourway of this product is linked to a Shopify product. */
  isShopifyLinked: boolean
  colorways: ProductColorway[]
  variants: ProductVariant[]
}

/**
 * A (product x colour) colourway.
 *
 * Shopify ships one product per colourway - every product in this catalog has a single option,
 * "Pointures" (size), with the colour living in the title - while the shop floor works from a
 * colour x size matrix. The colourway is where those two views meet, so it is what carries the
 * Shopify link, the merchandising photo and the online price.
 */
export interface ProductColorway {
  id: number
  productId: number
  colorId: number
  colorName: string
  colorHexCode: string
  /** Already resolved against the parent product's image on the server. */
  imageUrl?: string
  onlinePrice?: number
  shopifyProductId?: number
  shopifyTitle?: string
  sortOrder: number
  isActive: boolean
  variantCount: number
  stockQuantity: number
}

export interface ProductVariant {
  id: number
  productId: number
  colorwayId: number
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
