import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { refundsApi } from '../api/refunds'
import { salesApi } from '../api/sales'
import { showToast } from '../components/shared/Toast'
import { formatCurrency } from '../utils/format'
import { printHtml } from '../utils/printBridge'
import { useExchangeStore } from '../store/exchangeStore'
import CreateRefundTab from '../components/refunds/CreateRefundTab'
import RefundHistoryTab from '../components/refunds/RefundHistoryTab'
import { Page, Tabs } from '../components/ui'
import type { Sale } from '../types/sale'
import type {
  SaleForRefund,
  SaleItemForRefund,
  Refund,
  CreateRefundItemRequest,
  CreateExchangeItemRequest,
  ProductVariantForExchange,
} from '../api/refunds'

export interface RefundItemSelection {
  item: SaleItemForRefund
  quantity: number
}

export interface ExchangeItemSelection {
  variant: ProductVariantForExchange
  quantity: number
}

export type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
export type RefundType = 'Refund' | 'Exchange'
export type HistoryStatusFilter = 'all' | 'Pending' | 'Completed' | 'Cancelled'

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

    const html = `
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
    `
    printHtml(html)
  }

  // ── Helpers ──

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

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

  // ── Render ──

  return (
    <Page section="refunds" title={t('refunds.title')}>
      <div className="mb-6">
        <Tabs
          variant="pill"
          layoutGroupId="refunds-page-tab"
          value={activeTab}
          onChange={(v) => {
            setActiveTab(v as 'create' | 'history')
            setSale(null)
            setSelections([])
            setExchangeSelections([])
          }}
          items={tabs.map((tb) => ({ value: tb.key, label: tb.label }))}
        />
      </div>

      <>
        {activeTab === 'create' && (
          <CreateRefundTab
            loading={loading}
            receiptQrRef={receiptQrRef}
            receiptQrQuery={receiptQrQuery}
            scanningQr={scanningQr}
            qrError={qrError}
            handleReceiptQrInput={handleReceiptQrInput}
            handleReceiptQrKeyDown={handleReceiptQrKeyDown}
            setQrError={setQrError}
            setReceiptQrQuery={setReceiptQrQuery}
            scannedSales={scannedSales}
            setScannedSales={setScannedSales}
            handleSelectScannedSale={handleSelectScannedSale}
            saleSearchRef={saleSearchRef}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            timeFilters={timeFilters}
            customDateFrom={customDateFrom}
            setCustomDateFrom={setCustomDateFrom}
            customDateTo={customDateTo}
            setCustomDateTo={setCustomDateTo}
            filteredSales={filteredSales}
            handleSelectSale={handleSelectSale}
            formatDate={formatDate}
            sale={sale}
            setSale={setSale}
            setSelections={setSelections}
            setExchangeSelections={setExchangeSelections}
            setReason={setReason}
            setNotes={setNotes}
            refundType={refundType}
            setRefundType={setRefundType}
            selections={selections}
            handleToggleItem={handleToggleItem}
            handleSelectAllItems={handleSelectAllItems}
            exchangeSearchQuery={exchangeSearchQuery}
            exchangeSearchResults={exchangeSearchResults}
            searchingExchange={searchingExchange}
            exchangeInputRef={exchangeInputRef}
            handleExchangeInput={handleExchangeInput}
            handleExchangeKeyDown={handleExchangeKeyDown}
            handleAddExchangeItem={handleAddExchangeItem}
            exchangeSelections={exchangeSelections}
            handleExchangeQuantityChange={handleExchangeQuantityChange}
            handleRemoveExchangeItem={handleRemoveExchangeItem}
            reason={reason}
            notes={notes}
            totalRefund={totalRefund}
            totalExchange={totalExchange}
            priceDifference={priceDifference}
            submitting={submitting}
            handleSubmitRefund={handleSubmitRefund}
            handleExchangeViaPos={handleExchangeViaPos}
          />
        )}

        {activeTab === 'history' && (
          <RefundHistoryTab
            loading={loading}
            historyStats={historyStats}
            historyStatusFilter={historyStatusFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            historyStatusFilters={historyStatusFilters}
            historySearchQuery={historySearchQuery}
            setHistorySearchQuery={setHistorySearchQuery}
            filteredRefunds={filteredRefunds}
            expandedRefundId={expandedRefundId}
            setExpandedRefundId={setExpandedRefundId}
            formatDate={formatDate}
            handlePrintReceipt={handlePrintReceipt}
            handleProcessRefund={handleProcessRefund}
            handleCancelRefund={handleCancelRefund}
          />
        )}
      </>
    </Page>
  )
}
