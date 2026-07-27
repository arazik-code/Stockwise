import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { printLabels, type LabelSizeCode } from '../components/products/BarcodeLabel'
import { productsApi } from '../api/products'
import { showToast } from '../components/shared/Toast'
import { formatCurrency } from '../utils/format'
import type { Product, ProductVariant } from '../types/product'

type LabelVariant = ProductVariant & { productName: string }

const LABEL_SIZES: { code: LabelSizeCode; label: string; dims: string }[] = [
  { code: '50x25', label: '50 x 25 mm (Standard)', dims: '400 x 200 dots' },
  { code: '40x30', label: '40 x 30 mm (Compact)', dims: '320 x 240 dots' },
  { code: '60x40', label: '60 x 40 mm (Grand)', dims: '480 x 320 dots' },
  { code: '70x50', label: '70 x 50 mm (XL)', dims: '560 x 400 dots' },
  { code: '100x50', label: '100 x 50 mm (Large)', dims: '800 x 400 dots' },
]

export default function ThermalPrinterPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [labelSize, setLabelSize] = useState<LabelSizeCode>('50x25')
  const [copies, setCopies] = useState(1)
  const [selectedLabels, setSelectedLabels] = useState<LabelVariant[]>([])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await productsApi.getAll()
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.variants.some(v =>
        v.sku.toLowerCase().includes(search.toLowerCase()) ||
        v.colorName.toLowerCase().includes(search.toLowerCase()) ||
        (v.barcode && v.barcode.toLowerCase().includes(search.toLowerCase()))
      )
  )

  const addVariant = (variant: ProductVariant, productName: string) => {
    if (!variant.barcode) {
      showToast(t('products.noBarcode'), 'error')
      return
    }
    setSelectedLabels((prev) => [
      ...prev,
      { ...variant, productName },
    ])
  }

  const removeLabel = (index: number) => {
    setSelectedLabels((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => setSelectedLabels([])

  const handlePrint = () => {
    if (selectedLabels.length === 0) return
    printLabels(selectedLabels, labelSize, copies)
  }

  // Build flat list of all variants across all products
  const allVariants: { product: Product; variant: ProductVariant }[] = []
  for (const p of filtered) {
    for (const v of p.variants) {
      allVariants.push({ product: p, variant: v })
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title={t('printer.title')} />

      <div className="p-6 flex-1 flex gap-6">
        {/* Left: Product list */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="mb-4 flex gap-3">
            <input
              type="text"
              placeholder={t('products.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">{t('common.loading')}</div>
          ) : allVariants.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">{t('common.noData')}</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">{t('products.name')}</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">{t('products.color')}</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">{t('products.size')}</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">{t('products.sku')}</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">{t('products.barcode')}</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">{t('products.price')}</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allVariants.map(({ product: p, variant: v }) => {
                    const hasBarcode = !!v.barcode
                    return (
                      <tr key={v.id} className={`transition-colors ${hasBarcode ? 'hover:bg-slate-50' : 'bg-slate-50/50'}`}>
                        <td className="px-4 py-2 text-sm text-slate-900">{p.name}</td>
                        <td className="px-4 py-2 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: v.colorHexCode }} />
                            <span className="text-slate-600">{v.colorName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">{v.sizeValue}</td>
                        <td className="px-4 py-2 text-sm font-mono text-slate-500 text-xs">{v.sku}</td>
                        <td className="px-4 py-2 text-sm font-mono text-xs">
                          {v.barcode ? (
                            <span className="text-slate-500">{v.barcode}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-slate-700">{formatCurrency(v.price)}</td>
                        <td className="px-4 py-2 text-center">
                          {hasBarcode ? (
                            <button
                              onClick={() => addVariant(v, p.name)}
                              className="px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded hover:bg-violet-100 transition-colors"
                            >
                              + {t('printer.addToLabel')}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">{t('products.noBarcode')}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Print queue */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          {/* Printer info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="text-sm font-semibold text-slate-800">{t('printer.thermalPrinter')}</span>
            </div>
            <p className="text-xs text-slate-500">TSC TTP-247 &middot; 203 DPI &middot; {t('printer.connection')}: USB</p>
          </div>

          {/* Settings */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">{t('printer.labelSize')}</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as LabelSizeCode)}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {LABEL_SIZES.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">{t('printer.copies')}</label>
              <input
                type="number"
                min={1}
                max={99}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Label queue */}
          <div className="bg-white border border-slate-200 rounded-lg flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {t('printer.labelQueue')} ({selectedLabels.length})
              </span>
              {selectedLabels.length > 0 && (
                <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">
                  {t('common.clear')}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {selectedLabels.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{t('printer.noLabelsQueued')}</p>
              ) : (
                selectedLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-xs">
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: label.colorHexCode }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{label.productName}</p>
                      <p className="text-slate-500">{label.colorName} &middot; {label.sizeValue} &middot; {label.sku}</p>
                    </div>
                    <button onClick={() => removeLabel(i)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-100">
              <button
                onClick={handlePrint}
                disabled={selectedLabels.length === 0}
                className="w-full py-2.5 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {t('printer.sendToPrinter')} ({selectedLabels.length * copies})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
