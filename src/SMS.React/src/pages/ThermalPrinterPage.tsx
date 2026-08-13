import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, Search, X } from 'lucide-react'
import { printLabels, type LabelSizeCode } from '../components/products/BarcodeLabel'
import { productsApi } from '../api/products'
import { showToast } from '../components/shared/Toast'
import { formatCurrency } from '../utils/format'
import {
  Button, DataTable, IconButton, Input, Page, Select, shouldVirtualize, VirtualTable, type Column,
} from '../components/ui'
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

  const columns: Column<{ product: Product; variant: ProductVariant }>[] = [
    { key: 'name', header: t('products.name'), render: ({ product: p }) => <span className="text-fg">{p.name}</span> },
    {
      key: 'color',
      header: t('products.color'),
      render: ({ variant: v }) => (
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-chip border border-border" style={{ backgroundColor: v.colorHexCode }} />
          <span className="text-fg-muted">{v.colorName}</span>
        </div>
      ),
    },
    { key: 'size', header: t('products.size'), render: ({ variant: v }) => <span className="text-fg-muted">{v.sizeValue}</span> },
    { key: 'sku', header: t('products.sku'), render: ({ variant: v }) => <span className="num text-xs text-fg-subtle">{v.sku}</span> },
    {
      key: 'barcode',
      header: t('products.barcode'),
      render: ({ variant: v }) => (
        <span className="num text-xs text-fg-subtle">{v.barcode || '-'}</span>
      ),
    },
    { key: 'price', header: t('products.price'), numeric: true, render: ({ variant: v }) => <span className="text-fg-muted">{formatCurrency(v.price)}</span> },
    {
      key: 'add',
      header: '',
      align: 'center',
      render: ({ product: p, variant: v }) =>
        v.barcode ? (
          <Button size="xs" variant="soft" onClick={() => addVariant(v, p.name)}>
            + {t('printer.addToLabel')}
          </Button>
        ) : (
          <span className="text-xs text-fg-subtle">{t('products.noBarcode')}</span>
        ),
    },
  ]

  return (
    <Page section="printer" title={t('printer.title')} bare fill>
      <div className="flex flex-1 gap-6 p-4 sm:p-6">
        {/* Left: Product list. Bounded height so it scrolls independently of
            the fixed-width print-queue sidebar, matching the original
            two-pane behaviour. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Input
            placeholder={t('products.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leading={<Search />}
            wrapperClassName="mb-4 shrink-0"
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {shouldVirtualize(allVariants.length) ? (
              <VirtualTable
                columns={columns}
                data={allVariants}
                keyField={({ variant }) => variant.id}
                loading={loading}
                emptyMessage={t('common.noData')}
                height={560}
              />
            ) : (
              <DataTable
                columns={columns}
                data={allVariants}
                keyField={({ variant }) => variant.id}
                loading={loading}
                emptyMessage={t('common.noData')}
                sticky
              />
            )}
          </div>
        </div>

        {/* Right: Print queue */}
        <div className="flex w-80 shrink-0 flex-col gap-4">
          <div className="surface-glass p-4">
            <div className="mb-2 flex items-center gap-2">
              <Printer className="h-4 w-4 text-fg-muted" />
              <span className="text-sm font-semibold text-fg">{t('printer.thermalPrinter')}</span>
            </div>
            <p className="text-xs text-fg-subtle">TSC TTP-247 &middot; 203 DPI &middot; {t('printer.connection')}: USB</p>
          </div>

          <div className="surface-glass space-y-3 p-4">
            <Select
              label={t('printer.labelSize')}
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as LabelSizeCode)}
              size="sm"
            >
              {LABEL_SIZES.map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </Select>
            <Input
              label={t('printer.copies')}
              type="number"
              min={1}
              max={99}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              size="sm"
              className="text-center"
            />
          </div>

          <div className="surface-glass flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-xs font-medium text-fg-subtle">
                {t('printer.labelQueue')} (<span className="num">{selectedLabels.length}</span>)
              </span>
              {selectedLabels.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-[var(--negative)] transition-colors hover:brightness-90"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
              {selectedLabels.length === 0 ? (
                <p className="py-6 text-center text-xs text-fg-subtle">{t('printer.noLabelsQueued')}</p>
              ) : (
                selectedLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-inset bg-surface-2 p-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-chip border border-border" style={{ backgroundColor: label.colorHexCode }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">{label.productName}</p>
                      <p className="text-fg-subtle">{label.colorName} &middot; {label.sizeValue} &middot; {label.sku}</p>
                    </div>
                    <IconButton
                      icon={<X className="h-3.5 w-3.5" />}
                      label={t('common.delete')}
                      size="xs"
                      onClick={() => removeLabel(i)}
                    />
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border p-3">
              <Button
                fullWidth
                disabled={selectedLabels.length === 0}
                icon={<Printer className="h-4 w-4" />}
                onClick={handlePrint}
              >
                {t('printer.sendToPrinter')} (<span className="num">{selectedLabels.length * copies}</span>)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}
