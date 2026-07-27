import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { refundsApi } from '../api/refunds'
import { salesApi } from '../api/sales'
import { showToast } from '../components/shared/Toast'
import { formatCurrency } from '../utils/format'
import { useExchangeStore } from '../store/exchangeStore'
import type { Sale } from '../types/sale'
import type {
  SaleForRefund,
  SaleItemForRefund,
  Refund,
  CreateRefundItemRequest,
  CreateExchangeItemRequest,
  ProductVariantForExchange,
} from '../api/refunds'

interface RefundItemSelection {
  item: SaleItemForRefund
  quantity: number
}

interface ExchangeItemSelection {
  variant: ProductVariantForExchange
  quantity: number
}

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
type RefundType = 'Refund' | 'Exchange'
type HistoryStatusFilter = 'all' | 'Pending' | 'Completed' | 'Cancelled'

export default function RefundsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setExchangeContext = useExchangeStore((s) => s.setExchangeContext)

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')
  const [loading, setLoading] = useState(false)

  // Create tab state
  const [sales, setSales] = useState<Sale[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [sale, setSale] = useState<SaleForRefund | null>(null)
  const [refundType, setRefundType] = useState<RefundType>('Exchange')
  const [selections, setSelections] = useState<RefundItemSelection[]>([])
  const [exchangeSelections, setExchangeSelections] = useState<ExchangeItemSelection[]>([])
  const [exchangeSearchQuery, setExchangeSearchQuery] = useState('')
  const [exchangeSearchResults, setExchangeSearchResults] = useState<ProductVariantForExchange[]>([])
  const [searchingExchange, setSearchingExchange] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Receipt QR scanner state
  const [receiptQrQuery, setReceiptQrQuery] = useState('')
  const [scanningQr, setScanningQr] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const receiptQrRef = useRef<HTMLInputElement>(null)
  const receiptScannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const receiptScannerKeyTimeRef = useRef<number>(0)
  const receiptScannerLikelyRef = useRef(true)
  const [scannedSales, setScannedSales] = useState<SaleForRefund[]>([])

  // Barcode scanner refs for exchange search
  const exchangeInputRef = useRef<HTMLInputElement>(null)
  const lastKeyTimeRef = useRef<number>(0)
  const scannerLikelyRef = useRef(true)
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saleSearchRef = useRef<HTMLInputElement>(null)

  // History tab state
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('all')
  const [expandedRefundId, setExpandedRefundId] = useState<number | null>(null)

  const loadSales = useCallback(async () => {
    setLoading(true)
    try {
      const data = await salesApi.getAll()
      setSales(data)
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadRefunds = useCallback(async () => {
    setLoading(true)
    try {
      const data = await refundsApi.getAll()
      setRefunds(data)
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (activeTab === 'create') loadSales()
    else loadRefunds()
    return () => {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current)
    }
  }, [activeTab, loadSales, loadRefunds])

  // Keyboard shortcuts — native listener with capture to beat the browser
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          ;(e.target as HTMLElement).blur()
          e.stopPropagation()
        }
        return
      }

      switch (e.key) {
        case 'Insert':
          e.preventDefault()
          e.stopPropagation()
          if (activeTab === 'create' && !sale) {
            saleSearchRef.current?.focus()
          }
          break
        case 'Home':
          e.preventDefault()
          e.stopPropagation()
          if (activeTab === 'create' && sale) {
            setRefundType('Exchange')
          }
          break
        case 'End':
          e.preventDefault()
          e.stopPropagation()
          if (activeTab === 'create' && sale) {
            setRefundType('Refund')
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          if (sale) {
            setSale(null)
            setSelections([])
            setExchangeSelections([])
            setReason('')
            setNotes('')
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [activeTab, sale])

  // ── Receipt QR Scanner ──

  const handleSelectSale = useCallback(async (s: Sale) => {
    setLoading(true)
    try {
      const data = await refundsApi.getSaleForRefund(s.id)
      setSale(data)
      setSelections([])
      setExchangeSelections([])
      setReason('')
      setNotes('')
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t])

  const handleSelectAllItems = useCallback(() => {
    if (!sale) return
    const available = sale.items.filter((i) => i.availableForRefund > 0)
    const allSelected =
      selections.length === available.length && available.length > 0
    if (allSelected) {
      setSelections([])
    } else {
      setSelections(
        available.map((item) => ({ item, quantity: item.availableForRefund }))
      )
    }
  }, [sale, selections])

  const handleToggleItem = useCallback(
    (item: SaleItemForRefund) => {
      if (item.availableForRefund <= 0) return
      setSelections((prev) => {
        const existing = prev.find((s) => s.item.id === item.id)
        if (existing) {
          return prev.filter((s) => s.item.id !== item.id)
        }
        return [...prev, { item, quantity: item.availableForRefund }]
      })
    },
    []
  )

  const handleSelectScannedSale = async (saleId: number) => {
    setScannedSales([])
    await handleSelectSale({ id: saleId } as Sale)
  }

  const handleScanReceiptQr = useCallback(async (qrValue: string) => {
    if (!qrValue.trim()) return
    setScanningQr(true)
    setQrError(null)
    try {
      const isClientQr = qrValue.startsWith('SMS-')
      if (isClientQr) {
        const salesList = await refundsApi.scanClientQr(qrValue.trim())
        if (salesList.length === 0) {
          setQrError(t('refunds.noSalesFound'))
          showToast(t('refunds.noSalesFound'), 'error')
        } else if (salesList.length === 1) {
          await handleSelectSale({ id: salesList[0].id } as Sale)
          showToast(t('refunds.barcodeFound'), 'success')
        } else {
          setScannedSales(salesList)
          showToast(t('refunds.salesFound', { count: salesList.length }), 'success')
        }
      } else {
        const data = await refundsApi.scanBarcode(qrValue.trim())
        await handleSelectSale({ id: data.id } as Sale)
        showToast(t('refunds.barcodeFound'), 'success')
      }
      setReceiptQrQuery('')
    } catch (err: any) {
      const msg = err.response?.data?.message || t('refunds.barcodeNotFound')
      setQrError(msg)
      showToast(msg, 'error')
    } finally {
      setScanningQr(false)
    }
  }, [t, handleSelectSale])

  const handleReceiptQrInput = useCallback((value: string) => {
    setReceiptQrQuery(value)
    setQrError(null)

    const now = performance.now()
    const gap = now - receiptScannerKeyTimeRef.current
    receiptScannerKeyTimeRef.current = now
    if (value.length <= 1) {
      receiptScannerLikelyRef.current = true
    } else if (gap > 50) {
      receiptScannerLikelyRef.current = false
    }

    if (receiptScannerTimerRef.current) clearTimeout(receiptScannerTimerRef.current)
    if (receiptScannerLikelyRef.current && /^[A-Za-z0-9-]+$/.test(value) && value.length >= 10) {
      receiptScannerTimerRef.current = setTimeout(() => {
        handleScanReceiptQr(value)
      }, 80)
    }
  }, [handleScanReceiptQr])

  const handleReceiptQrKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && /^[A-Za-z0-9-]+$/.test(receiptQrQuery)) {
      if (receiptScannerTimerRef.current) clearTimeout(receiptScannerTimerRef.current)
      handleScanReceiptQr(receiptQrQuery)
    }
  }, [receiptQrQuery, handleScanReceiptQr])

  useEffect(() => {
    return () => {
      if (receiptScannerTimerRef.current) clearTimeout(receiptScannerTimerRef.current)
    }
  }, [])

  // ── Create Tab: Sales list filtering ──

  const filteredSales = useMemo(() => {
    let result = sales

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.saleNumber.toLowerCase().includes(q) ||
          (s.clientName ?? '').toLowerCase().includes(q)
      )
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    if (timeFilter === 'today') {
      result = result.filter((s) => new Date(s.createdAt) >= startOfToday)
    } else if (timeFilter === 'week') {
      result = result.filter((s) => new Date(s.createdAt) >= startOfWeek)
    } else if (timeFilter === 'month') {
      result = result.filter((s) => new Date(s.createdAt) >= startOfMonth)
    } else if (timeFilter === 'year') {
      result = result.filter((s) => new Date(s.createdAt) >= startOfYear)
    } else if (timeFilter === 'custom' && customDateFrom && customDateTo) {
      const from = new Date(customDateFrom)
      const to = new Date(customDateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter((s) => {
        const d = new Date(s.createdAt)
        return d >= from && d <= to
      })
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [sales, searchQuery, timeFilter, customDateFrom, customDateTo])

  // ── Create Tab: Handlers ──

  const handleAddExchangeItem = useCallback((variant: ProductVariantForExchange) => {
    setExchangeSearchResults([])
    setExchangeSearchQuery('')
    setExchangeSelections((prev) => {
      const existing = prev.find((e) => e.variant.id === variant.id)
      if (existing) {
        return prev.map((e) =>
          e.variant.id === variant.id ? { ...e, quantity: e.quantity + 1 } : e
        )
      }
      return [...prev, { variant, quantity: 1 }]
    })
  }, [])

  const triggerExchangeScan = useCallback(
    (barcode: string) => {
      refundsApi.searchVariants(barcode).then((results) => {
        const inStock = results.filter((r) => r.stockQuantity > 0)
        if (inStock.length === 1) {
          handleAddExchangeItem(inStock[0])
          showToast(`✓ ${inStock[0].productName} ajouté`, 'success')
        } else if (inStock.length > 1) {
          setExchangeSearchResults(inStock)
          setExchangeSearchQuery(barcode)
        } else {
          showToast(t('refunds.productNotFound'), 'warning')
        }
      }).catch(() => {
        showToast(t('refunds.productNotFound'), 'warning')
      })
      setExchangeSearchQuery('')
      exchangeInputRef.current?.focus()
    },
    [handleAddExchangeItem, t]
  )

  const handleSearchExchange = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setExchangeSearchResults([])
        return
      }
      setSearchingExchange(true)
      refundsApi
        .searchVariants(query.trim())
        .then((results) => {
          const inStock = results.filter((r) => r.stockQuantity > 0)
          setExchangeSearchResults(inStock)
        })
        .catch(() => {
          setExchangeSearchResults([])
        })
        .finally(() => setSearchingExchange(false))
    },
    []
  )

  const handleExchangeInput = useCallback(
    (value: string) => {
      const now = performance.now()
      const gap = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now
      if (value.length <= 1) {
        scannerLikelyRef.current = true
      } else if (gap > 50) {
        scannerLikelyRef.current = false
      }

      setExchangeSearchQuery(value)
      if (value.length >= 2) {
        handleSearchExchange(value)
      } else if (value.length === 0) {
        setExchangeSearchResults([])
      }

      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current)
      if (scannerLikelyRef.current && /^[A-Za-z0-9-]+$/.test(value) && value.length >= 8) {
        autoScanTimerRef.current = setTimeout(() => triggerExchangeScan(value), 80)
      }
    },
    [handleSearchExchange, triggerExchangeScan]
  )

  const handleExchangeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && /^[A-Za-z0-9-]+$/.test(exchangeSearchQuery)) {
        if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current)
        triggerExchangeScan(exchangeSearchQuery)
      }
    },
    [exchangeSearchQuery, triggerExchangeScan]
  )

  const handleExchangeQuantityChange = (variantId: number, quantity: number) => {
    setExchangeSelections((prev) =>
      prev.map((e) =>
        e.variant.id === variantId
          ? { ...e, quantity: Math.max(1, Math.min(quantity, e.variant.stockQuantity)) }
          : e
      )
    )
  }

  const handleRemoveExchangeItem = (variantId: number) => {
    setExchangeSelections((prev) => prev.filter((e) => e.variant.id !== variantId))
  }

  const totalRefund = useMemo(
    () => selections.reduce((sum, s) => sum + s.quantity * s.item.unitPrice, 0),
    [selections]
  )

  const totalExchange = useMemo(
    () => exchangeSelections.reduce((sum, e) => sum + e.quantity * e.variant.price, 0),
    [exchangeSelections]
  )

  const priceDifference = totalExchange - totalRefund

  const handleSubmitRefund = async () => {
    if (!sale) {
      showToast(t('refunds.fillRequired'), 'warning')
      return
    }

    if (refundType === 'Refund' && selections.length === 0) {
      showToast(t('refunds.selectAtLeastOneItem'), 'warning')
      return
    }

    if (refundType === 'Exchange' && (selections.length === 0 || exchangeSelections.length === 0)) {
      showToast(t('refunds.selectReturnAndExchangeItems'), 'warning')
      return
    }

    setSubmitting(true)
    try {
      const items: CreateRefundItemRequest[] = selections.map((s) => ({
        saleItemId: s.item.id,
        quantity: s.quantity,
      }))

      const exchangeItems: CreateExchangeItemRequest[] = exchangeSelections.map((e) => ({
        productVariantId: e.variant.id,
        quantity: e.quantity,
      }))

      const refund = await refundsApi.create({
        saleId: sale.id,
        type: refundType,
        reason,
        notes: notes || undefined,
        items,
        exchangeItems,
      })

      await refundsApi.process(refund.id)
      showToast(t('refunds.success'), 'success')
      setSale(null)
      setSelections([])
      setExchangeSelections([])
      setReason('')
      setNotes('')
      loadSales()
    } catch (err: any) {
      showToast(err.response?.data?.message || t('common.error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExchangeViaPos = () => {
    if (!sale || selections.length === 0) return
    setExchangeContext({
      originalSaleId: sale.id,
      originalSaleNumber: sale.saleNumber,
      clientId: sale.clientId,
      clientName: sale.clientName,
      returnedItems: selections.map((s) => ({
        saleItemId: s.item.id,
        productVariantId: s.item.productVariantId,
        productName: s.item.productName,
        sku: s.item.productSku,
        colorName: s.item.colorName,
        sizeValue: s.item.sizeValue,
        quantity: s.quantity,
        unitPrice: s.item.unitPrice,
        lineTotal: s.quantity * s.item.unitPrice,
      })),
      totalRefundAmount: totalRefund,
    })
    navigate('/pos')
  }

  // ── History tab ──

  const filteredRefunds = useMemo(() => {
    let result = refunds

    if (historyStatusFilter !== 'all') {
      result = result.filter((r) => r.status === historyStatusFilter)
    }

    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.refundNumber.toLowerCase().includes(q) ||
          r.saleNumber.toLowerCase().includes(q)
      )
    }

    return result.sort(
      (a, b) => new Date(b.refundDate).getTime() - new Date(a.refundDate).getTime()
    )
  }, [refunds, historySearchQuery, historyStatusFilter])

  const historyStats = useMemo(() => {
    const total = refunds.length
    const refundsCount = refunds.filter((r) => r.type === 'Refund').length
    const exchangesCount = refunds.filter((r) => r.type === 'Exchange').length
    const totalRefunded = refunds
      .filter((r) => r.status === 'Completed')
      .reduce((sum, r) => sum + r.totalRefundAmount, 0)
    const pendingCount = refunds.filter((r) => r.status === 'Pending').length
    return { total, refundsCount, exchangesCount, totalRefunded, pendingCount }
  }, [refunds])

  const handleCancelRefund = async (id: number) => {
    try {
      await refundsApi.cancel(id)
      showToast(t('refunds.cancelled'), 'success')
      loadRefunds()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleProcessRefund = async (id: number) => {
    try {
      await refundsApi.process(id)
      showToast(t('refunds.processed'), 'success')
      loadRefunds()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  // ── Print receipt ──

  const handlePrintReceipt = (refund: Refund) => {
    const win = window.open('', '_blank')
    if (!win) return

    const returnedRows = refund.items
      .map(
        (item) => `
        <tr>
          <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;font-size:12px">${item.productName}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;font-size:12px;text-align:center">${item.quantity}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;font-size:12px;text-align:right">${formatCurrency(item.refundAmount)}</td>
        </tr>`
      )
      .join('')

    const exchangeRows =
      refund.type === 'Exchange' && refund.exchangeItems.length > 0
        ? refund.exchangeItems
            .map(
              (item) => `
            <tr>
              <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;font-size:12px">${item.productName}</td>
              <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;font-size:12px;text-align:center">${item.quantity}</td>
              <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;font-size:12px;text-align:right">${formatCurrency(item.totalPrice)}</td>
            </tr>`
            )
            .join('')
        : ''

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${refund.refundNumber}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 32px; max-width: 480px; margin: 0 auto; color: #1e293b; }
          h1 { font-size: 18px; margin: 0 0 4px 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-bottom: 24px; }
          .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
          .info-label { color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { text-align: left; font-size: 11px; color: #94a3b8; text-transform: uppercase; padding: 6px 4px; border-bottom: 2px solid #e2e8f0; }
          .total-row { font-weight: 600; border-top: 2px solid #e2e8f0; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
          .badge-refund { background: #dbeafe; color: #1d4ed8; }
          .badge-exchange { background: #ffedd5; color: #c2410c; }
          .badge-pending { background: #fef3c7; color: #b45309; }
          .badge-completed { background: #d1fae5; color: #047857; }
          .badge-cancelled { background: #fee2e2; color: #b91c1c; }
          .section-title { font-size: 13px; font-weight: 600; margin: 20px 0 8px 0; }
          .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <h1>${refund.refundNumber}</h1>
        <div class="subtitle">
          <span class="badge ${refund.type === 'Exchange' ? 'badge-exchange' : 'badge-refund'}">
            ${refund.type === 'Exchange' ? t('refunds.typeExchange') : t('refunds.typeRefund')}
          </span>
          &nbsp;
          <span class="badge badge-${refund.status.toLowerCase()}">
            ${refund.status === 'Completed' ? t('refunds.completed') : refund.status === 'Cancelled' ? t('refunds.cancelled') : t('refunds.pending')}
          </span>
        </div>

        <div class="info-row"><span class="info-label">${t('refunds.saleNumber')}</span><span>${refund.saleNumber}</span></div>
        <div class="info-row"><span class="info-label">${t('refunds.client')}</span><span>${refund.clientName ?? t('refunds.walkInClient')}</span></div>
        <div class="info-row"><span class="info-label">${t('refunds.date')}</span><span>${new Date(refund.refundDate).toLocaleDateString('fr-FR')}</span></div>
        <div class="info-row"><span class="info-label">${t('refunds.reason')}</span><span>${refund.reason}</span></div>
        ${refund.notes ? `<div class="info-row"><span class="info-label">${t('refunds.notes')}</span><span>${refund.notes}</span></div>` : ''}

        <p class="section-title">${t('refunds.returnedItems')}</p>
        <table>
          <thead><tr><th>${t('products.product')}</th><th style="text-align:center">${t('common.quantity')}</th><th style="text-align:right">${t('refunds.amount')}</th></tr></thead>
          <tbody>${returnedRows}</tbody>
          <tfoot><tr class="total-row"><td colspan="2" style="padding:8px 4px">${t('refunds.returnTotal')}</td><td style="padding:8px 4px;text-align:right">${formatCurrency(refund.totalRefundAmount)}</td></tr></tfoot>
        </table>

        ${
          refund.type === 'Exchange' && exchangeRows
            ? `
          <p class="section-title">${t('refunds.exchangedItems')}</p>
          <table>
            <thead><tr><th>${t('products.product')}</th><th style="text-align:center">${t('common.quantity')}</th><th style="text-align:right">${t('refunds.amount')}</th></tr></thead>
            <tbody>${exchangeRows}</tbody>
            <tfoot><tr class="total-row"><td colspan="2" style="padding:8px 4px">${t('refunds.exchangeTotal')}</td><td style="padding:8px 4px;text-align:right">${formatCurrency(refund.totalExchangeAmount)}</td></tr></tfoot>
          </table>
          ${
            refund.priceDifference !== 0
              ? `<div class="info-row" style="margin-top:12px;font-weight:600"><span>${t('refunds.priceDifference')}</span><span>${refund.priceDifference >= 0 ? '+' : ''}${formatCurrency(refund.priceDifference)}</span></div>`
              : ''
          }
        `
            : ''
        }

        <div class="footer">${new Date().toLocaleDateString('fr-FR')} — ${t('refunds.title')}</div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  // ── Helpers ──

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

  const paymentMethodLabel = (method: string, tFn: (k: string) => string) => {
    const map: Record<string, string> = {
      Cash: tFn('sales.payments.cash'),
      Card: tFn('sales.payments.card'),
      Online: tFn('sales.payments.online'),
    }
    return map[method] ?? method
  }

  const saleStatusBadge = (status: string) => {
    if (status === 'Completed') return 'bg-emerald-100 text-emerald-700'
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-700'
    return 'bg-slate-100 text-slate-600'
  }

  const saleStatusLabel = (status: string, tFn: (k: string) => string) => {
    if (status === 'Completed') return tFn('sales.completed')
    return status
  }

  const refundStatusBadge = (status: string) => {
    if (status === 'Completed') return 'bg-emerald-100 text-emerald-700'
    if (status === 'Cancelled') return 'bg-red-100 text-red-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  const refundStatusLabel = (status: string, tFn: (k: string) => string) => {
    if (status === 'Completed') return tFn('refunds.completed')
    if (status === 'Cancelled') return tFn('refunds.cancelled')
    return tFn('refunds.pending')
  }

  const tabs = [
    { key: 'create' as const, label: t('refunds.newRefund') },
    { key: 'history' as const, label: t('refunds.history') },
  ]

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'all', label: t('refunds.timeAll') },
    { key: 'today', label: t('refunds.timeToday') },
    { key: 'week', label: t('refunds.timeWeek') },
    { key: 'month', label: t('refunds.timeMonth') },
    { key: 'year', label: t('refunds.timeYear') },
    { key: 'custom', label: t('refunds.timeCustom') },
  ]

  const historyStatusFilters: { key: HistoryStatusFilter; label: string }[] = [
    { key: 'all', label: t('refunds.statusAll') },
    { key: 'Pending', label: t('refunds.pending') },
    { key: 'Completed', label: t('refunds.completed') },
    { key: 'Cancelled', label: t('refunds.cancelled') },
  ]

  const gradientColors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ]

  const getGradient = (id: number) => gradientColors[id % gradientColors.length]

  // ── Render ──

  return (
    <div className="flex flex-col h-screen">
      <Header title={t('refunds.title')} />

      <div className="flex-1 overflow-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setSale(null)
                setSelections([])
                setExchangeSelections([])
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════ CREATE TAB ═══════════════════ */}
        {activeTab === 'create' && (
          <div className="max-w-5xl">
            {!sale ? (
              <>
                {/* Receipt QR Scanner */}
                <div className={`mb-4 p-3 rounded-lg border-2 border-dashed transition-colors ${
                  qrError ? 'border-red-300 bg-red-50/50' :
                  scanningQr ? 'border-blue-300 bg-blue-50/50' :
                  'border-slate-200 bg-slate-50/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      scanningQr ? 'bg-blue-100' : 'bg-emerald-100'
                    }`}>
                      <svg className={`w-5 h-5 ${scanningQr ? 'text-blue-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <input
                        ref={receiptQrRef}
                        type="text"
                        value={receiptQrQuery}
                        onChange={(e) => handleReceiptQrInput(e.target.value)}
                        onKeyDown={handleReceiptQrKeyDown}
                        placeholder={t('refunds.scanReceiptQr')}
                        className="w-full px-3 py-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:text-slate-400"
                        disabled={scanningQr}
                      />
                    </div>
                    {scanningQr && (
                      <div className="text-xs text-blue-500 flex-shrink-0">{t('common.loading')}</div>
                    )}
                    {qrError && (
                      <button onClick={() => { setQrError(null); setReceiptQrQuery(''); receiptQrRef.current?.focus() }} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                    )}
                  </div>
                </div>

                {/* Scanned sales list (multiple sales from client QR) */}
                {scannedSales.length > 0 && (
                  <div className="mb-4 p-4 bg-white border border-slate-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                      {t('refunds.salesFound', { count: scannedSales.length })}
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {scannedSales.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleSelectScannedSale(s.id)}
                          className="w-full flex items-center justify-between p-3 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-md transition-colors"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{s.saleNumber}</div>
                            <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString('fr-FR')} — {s.items.length} article(s)</div>
                          </div>
                          <div className="text-sm font-bold text-slate-900">{s.totalAmount.toFixed(2)} DH</div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setScannedSales([])}
                      className="mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}

                {/* Search bar with icon */}
                <div className="relative mb-4">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    ref={saleSearchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('refunds.searchPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Time filter buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {timeFilters.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setTimeFilter(f.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        timeFilter === f.key
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Custom date pickers */}
                {timeFilter === 'custom' && (
                  <div className="flex gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('refunds.from')}</label>
                      <input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('refunds.to')}</label>
                      <input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Count */}
                <div className="text-xs text-slate-500 mb-3">
                  {filteredSales.length} {t('refunds.salesFound')}
                </div>

                {/* Sales list */}
                {loading ? (
                  <div className="text-center py-12 text-slate-400 text-sm">{t('common.loading')}</div>
                ) : filteredSales.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">{t('refunds.noSales')}</div>
                ) : (
                  <div className="space-y-2">
                    {filteredSales.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSale(s)}
                        className="bg-white rounded-lg border border-slate-200 p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* Gradient avatar with last 4 digits */}
                            <div
                              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getGradient(s.id)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
                            >
                              {s.saleNumber.slice(-4)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{s.saleNumber}</p>
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${saleStatusBadge(s.status)}`}
                                >
                                  {saleStatusLabel(s.status, t)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                {s.clientName ?? t('refunds.walkInClient')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-slate-500">{formatDate(s.createdAt)}</p>
                              <p className="text-xs text-slate-400">
                                {paymentMethodLabel(s.paymentMethod, t)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(s.totalAmount)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {s.items.length} {t('common.items')}
                              </p>
                            </div>
                            <svg
                              className="w-4 h-4 text-slate-400 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* ── Sale detail view ── */
              <>
                {/* Back button */}
                <button
                  onClick={() => {
                    setSale(null)
                    setSelections([])
                    setExchangeSelections([])
                    setReason('')
                    setNotes('')
                  }}
                  className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  {t('refunds.backToList')}
                </button>

                {/* Sale info header */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getGradient(sale.id)} flex items-center justify-center text-white text-base font-bold flex-shrink-0`}
                    >
                      {sale.saleNumber.slice(-4)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">{sale.saleNumber}</h3>
                      <p className="text-sm text-slate-500">
                        {sale.clientName ?? t('refunds.walkInClient')} · {formatDate(sale.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">{t('common.total')}</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {formatCurrency(sale.totalAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Refund / Exchange toggle */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit mt-4">
                    <button
                      onClick={() => setRefundType('Refund')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        refundType === 'Refund'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t('refunds.typeRefund')}
                    </button>
                    <button
                      onClick={() => setRefundType('Exchange')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        refundType === 'Exchange'
                          ? 'bg-orange-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t('refunds.typeExchange')}
                    </button>
                  </div>
                </div>

                {/* Items table */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">{t('refunds.selectReturnItems')}</h4>
                    <button
                      onClick={handleSelectAllItems}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {selections.length === sale.items.filter((i) => i.availableForRefund > 0).length
                        ? t('refunds.deselectAll')
                        : t('refunds.selectAll')}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2 font-medium text-slate-600 w-10"></th>
                          <th className="text-left py-2 font-medium text-slate-600">{t('products.product')}</th>
                          <th className="text-left py-2 font-medium text-slate-600">{t('products.color')}</th>
                          <th className="text-left py-2 font-medium text-slate-600">{t('products.size')}</th>
                          <th className="text-right py-2 font-medium text-slate-600">{t('common.quantity')}</th>
                          <th className="text-right py-2 font-medium text-slate-600">{t('products.price')}</th>
                          <th className="text-right py-2 font-medium text-slate-600">{t('refunds.refunded')}</th>
                          <th className="text-right py-2 font-medium text-slate-600">{t('refunds.available')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item) => {
                          const selected = selections.find((s) => s.item.id === item.id)
                          return (
                            <tr
                              key={item.id}
                              className={`border-b border-slate-50 ${selected ? 'bg-blue-50/40' : ''}`}
                            >
                              <td className="py-3">
                                <input
                                  type="checkbox"
                                  checked={!!selected}
                                  onChange={() => handleToggleItem(item)}
                                  disabled={item.availableForRefund <= 0}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                />
                              </td>
                              <td className="py-3 font-medium text-slate-900">{item.productName}</td>
                              <td className="py-3 text-slate-600">{item.colorName}</td>
                              <td className="py-3 text-slate-600">{item.sizeValue}</td>
                              <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                              <td className="py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                              <td className="py-3 text-right text-slate-500">{item.alreadyRefundedQuantity}</td>
                              <td className="py-3 text-right">
                                <span
                                  className={`font-medium ${
                                    item.availableForRefund > 0 ? 'text-emerald-600' : 'text-slate-400'
                                  }`}
                                >
                                  {item.availableForRefund}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Exchange section */}
                {refundType === 'Exchange' && (
                  <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">
                      {t('refunds.selectExchangeItems')}
                    </h4>

                    <div className="relative mb-4">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <input
                        ref={exchangeInputRef}
                        type="text"
                        value={exchangeSearchQuery}
                        onChange={(e) => handleExchangeInput(e.target.value)}
                        onKeyDown={handleExchangeKeyDown}
                        placeholder={t('refunds.searchExchangePlaceholder') + ' (ou scanner le code-barres)'}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      {searchingExchange && (
                        <div className="absolute right-3 top-2.5 text-xs text-slate-400">
                          {t('common.loading')}
                        </div>
                      )}
                      {exchangeSearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {exchangeSearchResults.map((variant) => (
                            <div
                              key={variant.id}
                              onClick={() => handleAddExchangeItem(variant)}
                              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-orange-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {variant.imageUrl ? (
                                  <img
                                    src={variant.imageUrl}
                                    alt={variant.productName}
                                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                                    <span
                                      className="w-3 h-3 rounded-full border border-slate-300"
                                      style={{ backgroundColor: variant.colorHexCode }}
                                    />
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {variant.productName}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {variant.colorName} · {variant.sizeValue}
                                    {variant.sku && <span className="ml-1 text-slate-400">({variant.sku})</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">
                                  {t('refunds.stock')}: {variant.stockQuantity}
                                </span>
                                <span className="text-sm font-medium text-slate-900">
                                  {formatCurrency(variant.price)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {exchangeSelections.length > 0 ? (
                      <div className="space-y-2">
                        {exchangeSelections.map((sel) => (
                          <div
                            key={sel.variant.id}
                            className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg"
                          >
                            {sel.variant.imageUrl ? (
                              <img
                                src={sel.variant.imageUrl}
                                alt={sel.variant.productName}
                                className="w-10 h-10 rounded-lg object-cover border border-orange-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0">
                                <span
                                  className="w-3 h-3 rounded-full border border-orange-300"
                                  style={{ backgroundColor: sel.variant.colorHexCode }}
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {sel.variant.productName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {sel.variant.colorName} · {sel.variant.sizeValue}
                                {sel.variant.sku && <span className="ml-1 text-slate-400">({sel.variant.sku})</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <label className="text-xs text-slate-500">{t('common.quantity')}:</label>
                              <input
                                type="number"
                                min={1}
                                max={sel.variant.stockQuantity}
                                value={sel.quantity}
                                onChange={(e) =>
                                  handleExchangeQuantityChange(
                                    sel.variant.id,
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-16 px-2 py-1 text-sm border border-slate-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-900 w-24 text-right flex-shrink-0">
                              {formatCurrency(sel.quantity * sel.variant.price)}
                            </span>
                            <button
                              onClick={() => handleRemoveExchangeItem(sel.variant.id)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">
                        {t('refunds.noExchangeItems')}
                      </p>
                    )}
                  </div>
                )}

                {/* Summary + Reason + Submit */}
                {(selections.length > 0 ||
                  (refundType === 'Exchange' && exchangeSelections.length > 0)) && (
                  <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {t('refunds.globalReason')} <span className="text-slate-400 text-xs">({t('common.cancel')})</span>
                        </label>
                        <input
                          type="text"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder={t('refunds.reasonPlaceholder')}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {t('refunds.notes')}
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={t('refunds.notesPlaceholder')}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('refunds.returnTotal')}</span>
                        <span className="text-slate-900 font-medium">{formatCurrency(totalRefund)}</span>
                      </div>
                      {refundType === 'Exchange' && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">{t('refunds.exchangeTotal')}</span>
                            <span className="text-slate-900 font-medium">
                              {formatCurrency(totalExchange)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
                            <span className="text-slate-900">{t('refunds.priceDifference')}</span>
                            <span
                              className={
                                priceDifference >= 0 ? 'text-red-600' : 'text-emerald-600'
                              }
                            >
                              {priceDifference >= 0 ? '+' : ''}
                              {formatCurrency(priceDifference)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      {refundType === 'Exchange' && selections.length > 0 && (
                        <button
                          onClick={handleExchangeViaPos}
                          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                        >
                          {t('refunds.exchangeViaPos')}
                        </button>
                      )}
                      <button
                        onClick={handleSubmitRefund}
                        disabled={selections.length === 0 || submitting}
                        className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          refundType === 'Exchange'
                            ? 'bg-orange-600 hover:bg-orange-700'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {submitting
                          ? t('common.loading')
                          : refundType === 'Exchange'
                          ? t('refunds.processExchange')
                          : t('refunds.processRefund')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════ HISTORY TAB ═══════════════════ */}
        {activeTab === 'history' && (
          <div className="max-w-5xl">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {t('refunds.stats.totalOperations')}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{historyStats.total}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {t('refunds.stats.refundsCount')}
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{historyStats.refundsCount}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {t('refunds.stats.exchangesCount')}
                </p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{historyStats.exchangesCount}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {t('refunds.stats.totalRefunded')}
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(historyStats.totalRefunded)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {t('refunds.stats.pendingCount')}
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{historyStats.pendingCount}</p>
              </div>
            </div>

            {/* Status filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {historyStatusFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setHistoryStatusFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    historyStatusFilter === f.key
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder={t('refunds.searchHistoryPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Refunds count */}
            <div className="text-xs text-slate-500 mb-3">
              {filteredRefunds.length} {t('refunds.operationsFound')}
            </div>

            {/* Refund cards */}
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">{t('common.loading')}</div>
            ) : filteredRefunds.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">{t('refunds.noRefunds')}</div>
            ) : (
              <div className="space-y-3">
                {filteredRefunds.map((refund) => {
                  const isExpanded = expandedRefundId === refund.id
                  return (
                    <div
                      key={refund.id}
                      className="bg-white rounded-lg border border-slate-200 overflow-hidden transition-colors"
                    >
                      {/* Card header */}
                      <div
                        onClick={() => setExpandedRefundId(isExpanded ? null : refund.id)}
                        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Type badge */}
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                refund.type === 'Exchange'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {refund.type === 'Exchange'
                                ? t('refunds.typeExchange')
                                : t('refunds.typeRefund')}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {refund.refundNumber}
                              </p>
                              <p className="text-xs text-slate-500">
                                {refund.saleNumber} ·{' '}
                                {refund.clientName ?? t('refunds.walkInClient')} ·{' '}
                                {formatDate(refund.refundDate)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${refundStatusBadge(refund.status)}`}
                            >
                              {refundStatusLabel(refund.status, t)}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                refund.type === 'Exchange'
                                  ? refund.totalExchangeAmount
                                  : refund.totalRefundAmount
                              )}
                            </span>
                            <svg
                              className={`w-4 h-4 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
                          {/* Reason & Notes */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-slate-600">{t('refunds.reason')}:</span>{' '}
                              <span className="text-slate-700">{refund.reason}</span>
                            </div>
                            {refund.notes && (
                              <div>
                                <span className="font-medium text-slate-600">{t('refunds.notes')}:</span>{' '}
                                <span className="text-slate-700">{refund.notes}</span>
                              </div>
                            )}
                          </div>

                          {/* Returned items table */}
                          {refund.items.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                                {t('refunds.returnedItems')}
                              </p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-100">
                                    <th className="text-left py-2 font-medium text-slate-600">
                                      {t('products.product')}
                                    </th>
                                    <th className="text-right py-2 font-medium text-slate-600">
                                      {t('common.quantity')}
                                    </th>
                                    <th className="text-right py-2 font-medium text-slate-600">
                                      {t('refunds.amount')}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {refund.items.map((item) => (
                                    <tr key={item.id} className="border-b border-slate-50">
                                      <td className="py-2 text-slate-700">
                                        <p className="font-medium">{item.productName}</p>
                                        {item.colorName && item.sizeValue && (
                                          <p className="text-xs text-slate-400">
                                            {item.colorName} · {item.sizeValue}
                                          </p>
                                        )}
                                      </td>
                                      <td className="py-2 text-right text-slate-600">
                                        {item.quantity}
                                      </td>
                                      <td className="py-2 text-right text-slate-600">
                                        {formatCurrency(item.refundAmount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Exchanged items table */}
                          {refund.type === 'Exchange' && refund.exchangeItems.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                                {t('refunds.exchangedItems')}
                              </p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-100">
                                    <th className="text-left py-2 font-medium text-slate-600">
                                      {t('products.product')}
                                    </th>
                                    <th className="text-right py-2 font-medium text-slate-600">
                                      {t('common.quantity')}
                                    </th>
                                    <th className="text-right py-2 font-medium text-slate-600">
                                      {t('refunds.amount')}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {refund.exchangeItems.map((item) => (
                                    <tr key={item.id} className="border-b border-slate-50">
                                      <td className="py-2 text-slate-700">
                                        <p className="font-medium">{item.productName}</p>
                                        {item.colorName && item.sizeValue && (
                                          <p className="text-xs text-slate-400">
                                            {item.colorName} · {item.sizeValue}
                                          </p>
                                        )}
                                      </td>
                                      <td className="py-2 text-right text-slate-600">
                                        {item.quantity}
                                      </td>
                                      <td className="py-2 text-right text-slate-600">
                                        {formatCurrency(item.totalPrice)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {refund.priceDifference !== 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-sm font-medium">
                                  <span className="text-slate-500">{t('refunds.priceDifference')}</span>
                                  <span
                                    className={
                                      refund.priceDifference >= 0 ? 'text-red-600' : 'text-emerald-600'
                                    }
                                  >
                                    {refund.priceDifference >= 0 ? '+' : ''}
                                    {formatCurrency(refund.priceDifference)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePrintReceipt(refund)
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                />
                              </svg>
                              {t('refunds.printReceipt')}
                            </button>

                            {refund.status === 'Pending' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleProcessRefund(refund.id)
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  {t('refunds.process')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCancelRefund(refund.id)
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                  {t('common.cancel')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
