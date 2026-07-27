import { useState, useCallback, useMemo } from 'react'
import { productsApi } from '../api/products'
import type { Product, ProductVariant } from '../types/product'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const variants = useMemo(() => {
    const flat: (ProductVariant & { productName: string; brand?: string; imageUrl?: string; fournisseurNom?: string })[] = []
    for (const p of products) {
      for (const v of p.variants) {
        flat.push({
          ...v,
          productName: p.name,
          brand: p.brand,
          imageUrl: v.imageUrl ?? p.imageUrl,
          fournisseurNom: p.fournisseurNom,
        })
      }
    }
    return flat
  }, [products])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await productsApi.getAll()
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      const data = await productsApi.getAll()
      setProducts(data)
      return
    }
    const data = await productsApi.search(query)
    setProducts(data)
  }, [])

  return { products, variants, loading, loadProducts, searchProducts }
}
