import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { invoicesApi } from '../api/invoices'
import { fournisseursApi } from '../api/fournisseurs'
import { productsApi } from '../api/products'
import { colorsApi } from '../api/colors'
import { sizesApi } from '../api/sizes'
import { settingsApi, type InvoiceTemplateConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'
import { formatCurrency, formatDate } from '../utils/format'
import { useTableSelection } from '../hooks/useTableSelection'
import { printLabels } from '../components/products/BarcodeLabel'
import { printInvoice, type InvoicePrintData } from '../utils/printInvoice'
import type { Invoice, CreateInvoiceRequest, CreateInvoiceLineItemRequest, InvoiceStatus, PaymentTerms, InvoiceSummary } from '../types/invoice'
import type { Fournisseur } from '../types/fournisseur'
import type { Product, ProductVariant } from '../types/product'
import type { Color } from '../types/color'
import type { Size } from '../types/size'

interface InvoiceLineForm {
  productId: number
  colorId: number
  sizeId: number
  variantId: number
  quantity: number
  unitCost: number
  discountPercent: number
}

const emptyItem: InvoiceLineForm = { productId: 0, colorId: 0, sizeId: 0, variantId: 0, quantity: 1, unitCost: 0, discountPercent: 0 }

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function calcDueDate(invoiceDate: string, terms: PaymentTerms): string | undefined {
  if (terms === 'Comptant') return undefined
  const days = { Net15: 15, Net30: 30, Net45: 45, Net60: 60, Net90: 90 }[terms] ?? 0
  if (!days) return undefined
  const d = new Date(invoiceDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function statusBadge(status: InvoiceStatus, t: (k: string) => string) {
  const map: Record<InvoiceStatus, string> = {
    Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    PartiallyPaid: 'bg-blue-50 text-blue-700 border border-blue-200',
    Overdue: 'bg-red-50 text-red-700 border border-red-200',
    Cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
    Received: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  }
  const key: Record<InvoiceStatus, string> = {
    Pending: 'invoices.statuses.pending',
    Paid: 'invoices.statuses.paid',
    PartiallyPaid: 'invoices.statuses.partiallyPaid',
    Overdue: 'invoices.statuses.overdue',
    Cancelled: 'invoices.statuses.cancelled',
    Received: 'invoices.statuses.received',
  }
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[status]}`}>{t(key[status])}</span>
}

const paymentTermsOptions: { value: PaymentTerms; labelKey: string }[] = [
  { value: 'Comptant', labelKey: 'invoices.terms.comptant' },
  { value: 'Net15', labelKey: 'invoices.terms.net15' },
  { value: 'Net30', labelKey: 'invoices.terms.net30' },
  { value: 'Net45', labelKey: 'invoices.terms.net45' },
  { value: 'Net60', labelKey: 'invoices.terms.net60' },
  { value: 'Net90', labelKey: 'invoices.terms.net90' },
]

export default function InvoicesPage() {
  const { t } = useTranslation()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [allColors, setAllColors] = useState<Color[]>([])
  const [allSizes, setAllSizes] = useState<Size[]>([])
  const [summary, setSummary] = useState<InvoiceSummary | null>(null)
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [detail, setDetail] = useState<Invoice | null>(null)
  const [showPay, setShowPay] = useState<Invoice | null>(null)
  const [showCancel, setShowCancel] = useState<Invoice | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('Cash')
  const [payReference, setPayReference] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showReceive, setShowReceive] = useState<Invoice | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterFournisseur, setFilterFournisseur] = useState(0)
  const selection = useTableSelection<Invoice>()

  const [form, setForm] = useState<CreateInvoiceRequest>({
    fournisseurId: 0,
    paymentTerms: 'Comptant',
    discountAmount: 0,
    taxRate: 10,
    notes: '',
    reference: '',
    items: [],
  })

  const [lineItems, setLineItems] = useState<InvoiceLineForm[]>([{ ...emptyItem }])
  const [productSearch, setProductSearch] = useState('')
  const [importSearch, setImportSearch] = useState('')
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [selectedImportProducts, setSelectedImportProducts] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Products/colors/sizes used to load here too - the full catalog (~1MB, every variant)
      // just to show the invoice list, before the create/edit form was ever opened. Deferred to
      // ensureFormDataLoaded(), called only when that form actually opens.
      const [inv, four, sum, template] = await Promise.all([
        invoicesApi.getAll(),
        fournisseursApi.getAll(),
        invoicesApi.getSummary(),
        settingsApi.getInvoiceTemplate().catch(() => null),
      ])
      setInvoices(inv)
      setFilteredInvoices(inv)
      setFournisseurs(four)
      setSummary(sum)
      setInvoiceTemplate(template)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const formDataLoadedRef = useRef(false)
  const [loadingFormData, setLoadingFormData] = useState(false)
  const ensureFormDataLoaded = useCallback(async () => {
    if (formDataLoadedRef.current) return
    setLoadingFormData(true)
    try {
      const [prod, colors, sizes] = await Promise.all([
        productsApi.getAll(),
        colorsApi.getAll(),
        sizesApi.getAll(),
      ])
      setProducts(prod)
      setAllColors(colors)
      setAllSizes(sizes)
      formDataLoadedRef.current = true
    } finally {
      setLoadingFormData(false)
    }
  }, [])

  const importDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(e.target as Node)) {
        setShowImportDropdown(false)
      }
    }
    if (showImportDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showImportDropdown])

  useEffect(() => {
    let result = invoices
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(i =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.fournisseurNom.toLowerCase().includes(q) ||
        (i.reference ?? '').toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'All') {
      result = result.filter(i => i.status === filterStatus)
    }
    if (filterFournisseur > 0) {
      result = result.filter(i => i.fournisseurId === filterFournisseur)
    }
    setFilteredInvoices(result)
  }, [invoices, searchQuery, filterStatus, filterFournisseur])

  const openCreate = async () => {
    await ensureFormDataLoaded()
    setEditingInvoice(null)
    const today = todayStr()
    setForm({
      fournisseurId: fournisseurs[0]?.id ?? 0,
      invoiceDate: today,
      dueDate: undefined,
      paymentTerms: 'Comptant',
      discountAmount: 0,
      taxRate: 10,
      notes: '',
      reference: '',
      items: [],
    })
    setLineItems([{ ...emptyItem }])
    setShowCreate(true)
  }

  const openEdit = async (inv: Invoice) => {
    await ensureFormDataLoaded()
    setEditingInvoice(inv)
    setForm({
      fournisseurId: inv.fournisseurId,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms,
      discountAmount: inv.discountAmount,
      taxRate: inv.taxRate,
      notes: inv.notes ?? '',
      reference: inv.reference ?? '',
      items: [],
    })
    setLineItems(inv.items.map(i => ({
      productId: 0,
      colorId: 0,
      sizeId: 0,
      variantId: i.productVariantId ?? 0,
      quantity: i.quantity,
      unitCost: i.unitCost,
      discountPercent: i.discountPercent,
    })))
    setShowCreate(true)
  }

  const filteredProducts = form.fournisseurId
    ? products.filter((p) => p.fournisseurId === form.fournisseurId)
    : products

  const searchedProducts = productSearch
    ? filteredProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : filteredProducts

  const selectedFournisseur = fournisseurs.find((f) => f.id === form.fournisseurId)

  const handleFournisseurChange = (fournisseurId: number) => {
    setForm((prev) => ({ ...prev, fournisseurId }))
    setLineItems([{ ...emptyItem }])
    setProductSearch('')
  }

  // All colors and sizes available for dropdowns
  const getAvailableColors = (_productId: number) => {
    return allColors.map(c => ({ id: c.id, name: c.name, hexCode: c.hexCode }))
  }

  const getAvailableSizes = (_productId: number, _colorId: number) => {
    return allSizes.map(s => ({ id: s.id, value: s.value }))
  }

  const getVariant = (productId: number, colorId: number, sizeId: number): ProductVariant | undefined => {
    const product = products.find(p => p.id === productId)
    return product?.variants.find(v => v.colorId === colorId && v.sizeId === sizeId)
  }

  const getProductCostPrice = (productId: number): number => {
    const product = products.find(p => p.id === productId)
    return product?.costPrice ?? 0
  }

  const updateLineItem = (idx: number, patch: Partial<InvoiceLineForm>) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, ...patch }
      // Auto-fill price from variant when product/color/size change
      if (patch.productId !== undefined) {
        updated.colorId = 0
        updated.sizeId = 0
        updated.variantId = 0
        updated.unitCost = 0
      }
      if (patch.colorId !== undefined) {
        updated.sizeId = 0
        updated.variantId = 0
        updated.unitCost = 0
      }
      if (patch.sizeId !== undefined && updated.productId && updated.colorId && patch.sizeId) {
        const variant = getVariant(updated.productId, updated.colorId, patch.sizeId)
        if (variant) {
          updated.variantId = variant.id
          updated.unitCost = variant.costPrice ?? 0
        } else {
          updated.variantId = 0
          updated.unitCost = getProductCostPrice(updated.productId)
        }
      }
      return updated
    }))
  }

  const addItem = () => setLineItems(prev => [...prev, { ...emptyItem }])
  const removeItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx))

  const generateAllSizes = (idx: number) => {
    const item = lineItems[idx]
    if (!item.productId || !item.colorId) return
    const product = products.find(p => p.id === item.productId)
    if (!product) return
    const newLines: InvoiceLineForm[] = allSizes.map(size => {
      const variant = product.variants.find(v => v.colorId === item.colorId && v.sizeId === size.id)
      return {
        productId: item.productId,
        colorId: item.colorId,
        sizeId: size.id,
        variantId: variant?.id ?? 0,
        quantity: 1,
        unitCost: variant?.costPrice ?? product.costPrice ?? 0,
        discountPercent: 0,
      }
    })
    setLineItems(prev => {
      const next = [...prev]
      next.splice(idx, 1, ...newLines)
      return next
    })
    showToast(`${newLines.length} ligne(s) generee(s)`, 'success')
  }

  const duplicateItem = (idx: number) => {
    const original = lineItems[idx]
    const copy: InvoiceLineForm = { ...original, variantId: 0 }
    setLineItems(prev => {
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }

  const fournisseurProducts = products.filter(p => p.fournisseurId === form.fournisseurId)

  const filteredImportProducts = importSearch.trim()
    ? fournisseurProducts.filter(p => p.name.toLowerCase().includes(importSearch.toLowerCase()))
    : fournisseurProducts

  const toggleImportProduct = (productId: number) => {
    setSelectedImportProducts(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const selectAllImportProducts = () => {
    if (selectedImportProducts.size === filteredImportProducts.length) {
      setSelectedImportProducts(new Set())
    } else {
      setSelectedImportProducts(new Set(filteredImportProducts.map(p => p.id)))
    }
  }

  const importSelectedProducts = () => {
    if (selectedImportProducts.size === 0) {
      showToast(t('invoices.selectAtLeastOneProduct'), 'error')
      return
    }
    const newItems: InvoiceLineForm[] = []
    for (const product of fournisseurProducts) {
      if (!selectedImportProducts.has(product.id)) continue
      if (product.variants.length === 0) {
        newItems.push({
          productId: product.id,
          colorId: 0,
          sizeId: 0,
          variantId: 0,
          quantity: 1,
          unitCost: product.costPrice ?? 0,
          discountPercent: 0,
        })
      } else {
        for (const variant of product.variants) {
          if (!variant.isActive) continue
          newItems.push({
            productId: product.id,
            colorId: variant.colorId,
            sizeId: variant.sizeId,
            variantId: variant.id,
            quantity: 1,
            unitCost: variant.costPrice ?? 0,
            discountPercent: 0,
          })
        }
      }
    }
    if (newItems.length === 0) {
      showToast(t('invoices.noVariantsToImport'), 'error')
      return
    }
    setLineItems(prev => [...prev.filter(it => it.variantId > 0), ...newItems])
    setSelectedImportProducts(new Set())
    setImportSearch('')
    setShowImportDropdown(false)
    showToast(`${newItems.length} variante(s) importée(s)`, 'success')
  }

  const calcSubTotal = () => lineItems.reduce((sum, it) => {
    const line = it.quantity * it.unitCost
    const disc = it.discountPercent > 0 ? line * it.discountPercent / 100 : 0
    return sum + line - disc
  }, 0)
  const calcTax = () => (calcSubTotal() - form.discountAmount) * form.taxRate / 100
  const calcTotal = () => calcSubTotal() - form.discountAmount + calcTax()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const validItems: CreateInvoiceLineItemRequest[] = lineItems
        .filter(it => it.quantity > 0 && it.productId > 0)
        .map(it => {
          const p = products.find(pp => pp.id === it.productId)
          return {
            productVariantId: it.variantId || undefined,
            productId: it.productId || undefined,
            colorId: it.colorId || undefined,
            sizeId: it.sizeId || undefined,
            quantity: it.quantity,
            unitCost: it.unitCost,
            discountPercent: it.discountPercent,
            description: p?.name || undefined,
          }
        })
      if (validItems.length === 0) { showToast(t('common.error'), 'error'); return }
      const payload: CreateInvoiceRequest = { ...form, items: validItems }
      if (editingInvoice) {
        await invoicesApi.update(editingInvoice.id, payload)
        showToast(t('invoices.updateSuccess'), 'success')
      } else {
        await invoicesApi.create(payload)
        showToast(t('invoices.createSuccess'), 'success')
      }
      setShowCreate(false)
      setProductSearch('')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const openPay = (inv: Invoice) => {
    setShowPay(inv)
    setPayAmount(inv.balanceDue)
    setPayMethod('Cash')
    setPayReference('')
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showPay) return
    try {
      await invoicesApi.pay(showPay.id, { amount: payAmount, paymentMethod: payMethod, reference: payReference || undefined })
      showToast(t('invoices.paySuccess'), 'success')
      setShowPay(null)
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleCancel = async () => {
    if (!showCancel) return
    try {
      await invoicesApi.cancel(showCancel.id, { reason: cancelReason || undefined })
      showToast(t('invoices.cancelSuccess'), 'success')
      setShowCancel(null)
      setCancelReason('')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleReceive = (inv: Invoice) => {
    setShowReceive(inv)
  }

  const confirmReceive = async () => {
    if (!showReceive) return
    try {
      await invoicesApi.receive(showReceive.id)
      showToast(t('invoices.receiveSuccess'), 'success')
      setShowReceive(null)
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleBulkCancel = async () => {
    const ids = Array.from(selection.selected)
    if (ids.length === 0) return
    try {
      const result = await invoicesApi.cancelMany(ids)
      showToast(t('invoices.cancelManySuccess', { 0: result.cancelled }), 'success')
      selection.clear()
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handlePrintLabels = async (invoiceId: number) => {
    try {
      const labels = await invoicesApi.getLabels(invoiceId)
      if (labels.length === 0) {
        showToast('Aucune étiquette à imprimer', 'info')
        return
      }
      const expanded: (import('../types/product').ProductVariant & { productName: string })[] = []
      for (const label of labels) {
        for (let i = 0; i < label.quantity; i++) {
          expanded.push({
            id: 0,
            productId: 0,
            colorId: 0,
            colorHexCode: '',
            sizeId: 0,
            sku: '',
            costPrice: 0,
            imageUrl: undefined,
            isActive: true,
            isLiquidation: false,
            stockQuantity: 0,
            productName: label.productName,
            barcode: label.barcode || undefined,
            colorName: label.colorName,
            sizeValue: label.sizeValue,
            price: label.price,
          })
        }
      }
      printLabels(expanded)
      showToast(`${expanded.length} étiquette(s) envoyée(s) à l'impression`, 'success')
    } catch {
      showToast('Erreur lors de la récupération des étiquettes', 'error')
    }
  }

  const handlePrintInvoice = (inv: Invoice) => {
    if (!invoiceTemplate) {
      showToast('Modèle de facture non chargé, réessayez', 'error')
      return
    }
    const fournisseur = fournisseurs.find((f) => f.id === inv.fournisseurId)
    const printData: InvoicePrintData = {
      invoiceNumber: inv.invoiceNumber,
      date: formatDate(inv.invoiceDate),
      reference: inv.reference,
      dueDate: inv.dueDate ? formatDate(inv.dueDate) : undefined,
      fournisseur: inv.fournisseurNom,
      fournisseurAddress: fournisseur?.adresse,
      fournisseurPhone: fournisseur?.telephone,
      items: inv.items.map((it) => ({
        productName: it.productName,
        sku: it.variantSku ?? '',
        colorName: it.colorName ?? '',
        sizeValue: it.sizeValue ?? '',
        barcode: it.variantBarcode ?? '',
        description: it.description ?? '',
        quantity: it.quantity,
        unitCost: it.unitCost,
        discountPercent: it.discountPercent,
        discountAmount: it.discountAmount,
        lineTotal: it.lineTotal,
      })),
      subTotal: inv.subTotal,
      discountAmount: inv.discountAmount,
      taxRate: inv.taxRate / 100,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      paymentTerms: inv.paymentTerms,
      notes: inv.notes,
      status: inv.status,
      payments: inv.payments.map((p) => ({
        date: formatDate(p.paymentDate),
        method: p.paymentMethod,
        amount: p.amount,
        reference: p.reference,
      })),
    }
    printInvoice(invoiceTemplate, printData)
  }

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={t('invoices.title')}
        actions={
          <button
            onClick={openCreate}
            disabled={loadingFormData}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('invoices.add')}
          </button>
        }
      />
      <div className="p-6 flex-1 space-y-6">

        {summary && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">{t('invoices.summaryCards.totalOwed')}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(summary.totalOwed)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">{t('invoices.summaryCards.totalOverdue')}</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary.totalOverdue)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">{t('invoices.summaryCards.pendingCount')}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{summary.pendingCount}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">{t('invoices.summaryCards.paidCount')}</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.paidCount}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('invoices.search')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="All">{t('invoices.allStatuses')}</option>
            <option value="Pending">{t('invoices.statuses.pending')}</option>
            <option value="Received">{t('invoices.statuses.received')}</option>
            <option value="Paid">{t('invoices.statuses.paid')}</option>
            <option value="PartiallyPaid">{t('invoices.statuses.partiallyPaid')}</option>
            <option value="Overdue">{t('invoices.statuses.overdue')}</option>
            <option value="Cancelled">{t('invoices.statuses.cancelled')}</option>
          </select>
          <select
            value={filterFournisseur}
            onChange={(e) => setFilterFournisseur(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={0}>{t('invoices.allFournisseurs')}</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>

        {selection.someSelected && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <span className="text-sm font-medium text-red-700">
              {selection.count} facture(s) sélectionnée(s)
            </span>
            <button
              onClick={handleBulkCancel}
              className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors"
            >
              {t('invoices.cancel')}
            </button>
            <button
              onClick={selection.clear}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-slate-500">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selection.allSelected(filteredInvoices)}
                        onChange={() => selection.toggleAll(filteredInvoices)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('invoices.invoiceNumber')}</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('invoices.fournisseur')}</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('invoices.date')}</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('invoices.paymentTerms')}</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('invoices.total')}</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('invoices.balanceDue')}</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('invoices.status')}</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider w-20">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-sm text-slate-400">{t('invoices.noInvoices')}</td></tr>
                  )}
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className={`transition-colors ${selection.isSelected(inv.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selection.isSelected(inv.id)}
                          onChange={() => selection.toggle(inv.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-slate-600 whitespace-nowrap">
                        <button onClick={() => setDetail(inv)} className="hover:text-blue-600 transition-colors font-medium">{inv.invoiceNumber}</button>
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-900 whitespace-nowrap">{inv.fournisseurNom}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">{t(`invoices.terms.${inv.paymentTerms.toLowerCase()}`)}</td>
                      <td className="px-3 py-2.5 text-sm text-right text-slate-600 whitespace-nowrap">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(inv.balanceDue)}</td>
                      <td className="px-3 py-2.5 text-sm text-center whitespace-nowrap">{statusBadge(inv.status, t)}</td>
                      <td className="px-3 py-2.5 text-sm text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {inv.status === 'Pending' && (
                            <button onClick={() => handleReceive(inv)} className="text-xs text-cyan-600 hover:text-cyan-800 font-medium transition-colors px-1.5 py-1 rounded hover:bg-cyan-50" title={t('invoices.receive')}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                          )}
                          {inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.status !== 'Received' && (
                            <button onClick={() => openPay(inv)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors px-1.5 py-1 rounded hover:bg-blue-50" title={t('invoices.pay')}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                          )}
                          {inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.status !== 'Received' && (
                            <>
                              <button onClick={() => openEdit(inv)} className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors px-1.5 py-1 rounded hover:bg-slate-100" title={t('common.edit')}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => setShowCancel(inv)} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors px-1.5 py-1 rounded hover:bg-red-50" title={t('invoices.cancel')}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </>
                          )}
                          {inv.status === 'Received' && (
                            <button onClick={() => handlePrintLabels(inv.id)} className="text-xs text-cyan-600 hover:text-cyan-800 font-medium transition-colors px-1.5 py-1 rounded hover:bg-cyan-50" title="Imprimer les étiquettes">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                          )}
                          <button onClick={() => handlePrintInvoice(inv)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors px-1.5 py-1 rounded hover:bg-blue-50" title="Imprimer la facture">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-8 0h8v6H6v-6z" /></svg>
                          </button>
                          <button onClick={() => setDetail(inv)} className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors px-1.5 py-1 rounded hover:bg-slate-100" title={t('invoices.summary')}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                          <button onClick={() => setShowCancel(inv)} className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors px-1.5 py-1 rounded hover:bg-amber-50" title={t('invoices.cancel')}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[800px] max-h-[90vh] overflow-auto border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">
              {editingInvoice ? t('invoices.edit') : t('invoices.add')}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.fournisseur')} *</label>
                  <select
                    required
                    value={form.fournisseurId}
                    onChange={(e) => handleFournisseurChange(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={0}>{t('invoices.fournisseur')}</option>
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                  {selectedFournisseur && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                      {selectedFournisseur.contact && <span>{selectedFournisseur.contact}</span>}
                      {selectedFournisseur.telephone && <span>· {selectedFournisseur.telephone}</span>}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.reference')}</label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="BC-2026-001"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.date')}</label>
                  <input
                    type="date"
                    value={form.invoiceDate ?? ''}
                    onChange={(e) => setForm({ ...form, invoiceDate: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.paymentTerms')}</label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => {
                      const terms = e.target.value as PaymentTerms
                      const invoiceDate = form.invoiceDate || todayStr()
                      setForm({
                        ...form,
                        paymentTerms: terms,
                        invoiceDate,
                        dueDate: calcDueDate(invoiceDate, terms),
                      })
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {paymentTermsOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.dueDate')}</label>
                  <input
                    type="date"
                    value={form.dueDate ?? ''}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.taxRate')} (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={form.taxRate}
                    onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Line Items with cascading dropdowns */}
              <div>
                <div className="relative mb-2">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={t('common.search')}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500">{t('products.variants')}</label>
                  <div className="flex items-center gap-3">
                    {form.fournisseurId > 0 && (
                      <div className="relative" ref={importDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowImportDropdown(!showImportDropdown)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                        >
                          {t('invoices.importFournisseurProducts')} ({selectedImportProducts.size > 0 ? `${selectedImportProducts.size} sélectionné(s)` : fournisseurProducts.length})
                        </button>
                        {showImportDropdown && (
                          <div className="absolute right-0 top-8 z-20 w-72 bg-white border border-slate-200 rounded-xl shadow-xl">
                            <div className="p-2 border-b border-slate-100">
                              <div className="relative">
                                <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                  type="text"
                                  value={importSearch}
                                  onChange={(e) => setImportSearch(e.target.value)}
                                  placeholder="Rechercher un produit..."
                                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredImportProducts.length === 0 ? (
                                <p className="px-3 py-4 text-xs text-slate-400 text-center">Aucun produit trouvé</p>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={selectAllImportProducts}
                                    className="w-full px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 text-left flex items-center gap-2 border-b border-slate-100"
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedImportProducts.size === filteredImportProducts.length ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                      {selectedImportProducts.size === filteredImportProducts.length && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    Tout sélectionner
                                  </button>
                                  {filteredImportProducts.map((product) => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      onClick={() => toggleImportProduct(product.id)}
                                      className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 text-left flex items-center gap-2 transition-colors"
                                    >
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedImportProducts.has(product.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                        {selectedImportProducts.has(product.id) && (
                                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{product.name}</p>
                                        <p className="text-slate-400">{product.variants.filter(v => v.isActive).length} variante(s)</p>
                                      </div>
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                            <div className="p-2 border-t border-slate-100 flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setShowImportDropdown(false); setImportSearch(''); setSelectedImportProducts(new Set()) }}
                                className="flex-1 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={importSelectedProducts}
                                disabled={selectedImportProducts.size === 0}
                                className="flex-1 px-3 py-1.5 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Importer ({selectedImportProducts.size})
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={!form.fournisseurId}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      + {t('invoices.addProduct')}
                    </button>
                  </div>
                </div>
                {!form.fournisseurId && (
                  <p className="text-xs text-amber-600 mb-2">{t('invoices.selectFournisseurFirst')}</p>
                )}
                <div className="grid grid-cols-[1fr_1fr_1fr_auto_80px_90px_70px_70px_auto] gap-2 mb-1 px-1">
                  <span className="text-xs font-medium text-slate-400">{t('products.name')}</span>
                  <span className="text-xs font-medium text-slate-400">{t('products.color')}</span>
                  <span className="text-xs font-medium text-slate-400">{t('products.size')}</span>
                  <span className="w-[50px]"></span>
                  <span className="text-xs font-medium text-slate-400">{t('common.quantity')}</span>
                  <span className="text-xs font-medium text-slate-400" title="Prix d'achat du fournisseur (même valeur que 'Prix de revient' du produit)">{t('invoices.unitCost')}</span>
                  <span className="text-xs font-medium text-slate-400">Remise %</span>
                  <span className="text-xs font-medium text-slate-400 text-right">{t('invoices.lineTotal')}</span>
                  <span className="w-[24px]"></span>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, idx) => {
                    const colors = getAvailableColors(item.productId)
                    const sizes = getAvailableSizes(item.productId, item.colorId)
                    return (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto_80px_90px_70px_70px_auto] gap-2 items-center">
                        <select
                          value={item.productId}
                          onChange={(e) => updateLineItem(idx, { productId: parseInt(e.target.value) })}
                          disabled={!form.fournisseurId}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                        >
                          <option value={0}>{t('invoices.selectProduct')}</option>
                          {searchedProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={item.colorId}
                          onChange={(e) => updateLineItem(idx, { colorId: parseInt(e.target.value) })}
                          disabled={!item.productId}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                        >
                          <option value={0}>{t('products.selectColor')}</option>
                          {colors.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <select
                          value={item.sizeId}
                          onChange={(e) => updateLineItem(idx, { sizeId: parseInt(e.target.value) })}
                          disabled={!item.colorId}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                        >
                          <option value={0}>{t('products.selectSize')}</option>
                          {sizes.map((s) => (
                            <option key={s.id} value={s.id}>{s.value}</option>
                          ))}
                        </select>
                        {item.productId > 0 && item.colorId > 0 && (
                          <button
                            type="button"
                            onClick={() => generateAllSizes(idx)}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap px-1 font-medium"
                            title="Generer toutes les tailles"
                          >
                            +Toutes
                          </button>
                        )}
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.unitCost}
                          onChange={(e) => updateLineItem(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={item.discountPercent}
                          onChange={(e) => updateLineItem(idx, { discountPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-right text-slate-600 font-medium">
                          {formatCurrency((item.quantity * item.unitCost) - (item.discountPercent > 0 ? item.quantity * item.unitCost * item.discountPercent / 100 : 0))}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => duplicateItem(idx)} 
                          className="text-xs text-slate-400 hover:text-blue-600 px-1" 
                          title={t('common.duplicate') || 'Dupliquer'}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-500 hover:text-red-700 px-1">
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.discount')} ({t('common.total')})</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.discountAmount}
                    onChange={(e) => setForm({ ...form, discountAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.notes')}</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-md p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('invoices.subTotal')}</span>
                  <span className="text-slate-700">{formatCurrency(calcSubTotal())}</span>
                </div>
                {form.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('invoices.discount')}</span>
                    <span className="text-red-600">-{formatCurrency(form.discountAmount)}</span>
                  </div>
                )}
                {form.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('invoices.taxRate')} ({form.taxRate}%)</span>
                    <span className="text-slate-700">{formatCurrency(calcTax())}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base border-t border-slate-200 pt-2">
                  <span className="text-slate-900">{t('invoices.total')}</span>
                  <span className="text-slate-900">{formatCurrency(calcTotal())}</span>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                  {editingInvoice ? t('common.update') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('invoices.pay')}</h2>
            <p className="text-sm text-slate-500 mb-5">{showPay.invoiceNumber} — {showPay.fournisseurNom}</p>
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.paymentAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={showPay.balanceDue}
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">{t('invoices.balanceDue')}: {formatCurrency(showPay.balanceDue)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.paymentMethod')}</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Cash">{t('sales.payments.cash')}</option>
                  <option value="Card">{t('sales.payments.card')}</option>
                  <option value="Transfer">Virement</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.paymentReference')}</label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="CHQ-001, VIR-002..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowPay(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('invoices.cancel')}</h2>
            <p className="text-sm text-slate-500 mb-4">{showCancel.invoiceNumber}</p>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.cancelReason')}</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <button onClick={() => { setShowCancel(null); setCancelReason('') }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('invoices.cancel')}</h2>
            <p className="text-sm text-slate-500 mb-4">{showCancel.invoiceNumber}</p>
            <p className="text-sm text-slate-600 mb-5">{t('invoices.cancelConfirm')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancel(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors">
                {t('invoices.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Confirmation Modal */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('invoices.receive')}</h2>
            <p className="text-sm text-slate-500 mb-4">{showReceive.invoiceNumber} — {showReceive.fournisseurNom}</p>
            <p className="text-sm text-slate-600 mb-5">{t('invoices.receiveConfirm')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReceive(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={confirmReceive} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-[680px] max-h-[85vh] overflow-auto border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{detail.invoiceNumber}</h3>
                <p className="text-xs text-slate-500">{detail.fournisseurNom}</p>
              </div>
              <div className="flex items-center gap-2">
                {detail.status === 'Received' && (
                  <button onClick={() => { handlePrintLabels(detail.id); setDetail(null) }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-md hover:bg-cyan-100 transition-colors" title="Imprimer les étiquettes">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Imprimer les étiquettes
                  </button>
                )}
                <button onClick={() => handlePrintInvoice(detail)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors" title="Imprimer la facture">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-8 0h8v6H6v-6z" /></svg>
                  Imprimer la facture
                </button>
                <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 text-xs">{t('invoices.date')}</span>
                  <p className="font-medium text-slate-900">{formatDate(detail.invoiceDate)}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">{t('invoices.status')}</span>
                  <div className="mt-1">{statusBadge(detail.status, t)}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">{t('invoices.paymentTerms')}</span>
                  <p className="font-medium text-slate-900">{t(`invoices.terms.${detail.paymentTerms.toLowerCase()}`)}</p>
                </div>
              </div>
              {detail.dueDate && (
                <div className="text-sm">
                  <span className="text-slate-500">{t('invoices.dueDate')}: </span>
                  <span className="font-medium text-slate-900">{formatDate(detail.dueDate)}</span>
                </div>
              )}
              {detail.reference && (
                <div className="text-sm">
                  <span className="text-slate-500">{t('invoices.reference')}: </span>
                  <span className="font-medium text-slate-900">{detail.reference}</span>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase">
                    <th className="text-left py-2">{t('products.name')}</th>
                    <th className="text-left py-2">{t('products.color')}</th>
                    <th className="text-left py-2">{t('products.size')}</th>
                    <th className="text-right py-2">{t('common.quantity')}</th>
                    <th className="text-right py-2">{t('invoices.unitCost')}</th>
                    <th className="text-right py-2">{t('invoices.discount')}</th>
                    <th className="text-right py-2">{t('invoices.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2">
                        <p className="font-medium text-slate-900">{it.productName}</p>
                        {it.variantSku && <p className="text-xs text-slate-400">{it.variantSku}</p>}
                      </td>
                      <td className="py-2 text-slate-600">{it.colorName ?? '-'}</td>
                      <td className="py-2 text-slate-600">{it.sizeValue ?? '-'}</td>
                      <td className="py-2 text-right">{it.quantity}</td>
                      <td className="py-2 text-right">{formatCurrency(it.unitCost)}</td>
                      <td className="py-2 text-right">
                        {it.discountPercent > 0 ? (
                          <span className="text-red-600">-{it.discountPercent}%</span>
                        ) : '-'}
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-right text-sm space-y-1 border-t border-slate-100 pt-3">
                <p className="text-slate-500">{t('invoices.subTotal')}: <span className="text-slate-700">{formatCurrency(detail.subTotal)}</span></p>
                {detail.discountAmount > 0 && (
                  <p className="text-slate-500">{t('invoices.discount')}: <span className="text-red-600">-{formatCurrency(detail.discountAmount)}</span></p>
                )}
                {detail.taxAmount > 0 && (
                  <p className="text-slate-500">{t('invoices.taxRate')} ({detail.taxRate}%): <span className="text-slate-700">{formatCurrency(detail.taxAmount)}</span></p>
                )}
                <p className="font-semibold text-base text-slate-900 border-t border-slate-100 pt-1">{t('invoices.total')}: {formatCurrency(detail.totalAmount)}</p>
                <p className="text-emerald-600">{t('invoices.paid')}: {formatCurrency(detail.paidAmount)}</p>
                <p className="font-semibold text-slate-900">{t('invoices.balanceDue')}: {formatCurrency(detail.balanceDue)}</p>
              </div>

              {detail.payments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase">{t('invoices.pay')} ({detail.payments.length})</p>
                  <div className="space-y-1.5">
                    {detail.payments.map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-sm bg-slate-50 rounded px-3 py-2">
                        <div>
                          <span className="text-slate-600">{formatDate(p.paymentDate)}</span>
                          <span className="text-slate-400 mx-2">—</span>
                          <span className="text-slate-700">{p.paymentMethod}</span>
                          {p.reference && <span className="text-slate-400 ml-2">({p.reference})</span>}
                        </div>
                        <span className="font-medium text-slate-900">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.notes && (
                <div className="bg-slate-50 rounded-md p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">{t('invoices.notes')}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
