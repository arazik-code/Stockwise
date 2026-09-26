import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle, Archive, ArchiveRestore, Ban, CheckCircle2, Clock, Copy, FileText, Pencil, Plus, Printer,
  Search, Tags, Trash2, Undo2, Wallet,
} from 'lucide-react'
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
import {
  Button, DataTable, EmptyState, IconButton, Input, Modal, Page, Select,
  SkeletonTable, StatCard, StatusBadge, Textarea, Toolbar, cn,
  type Column,
} from '../components/ui'
import type { Invoice, CreateInvoiceRequest, CreateInvoiceLineItemRequest, PaymentTerms, InvoiceSummary } from '../types/invoice'
import type { Fournisseur } from '../types/fournisseur'
import type { Product, ProductVariant } from '../types/product'
import type { Color } from '../types/color'
import type { Size } from '../types/size'

interface InvoiceLineForm {
  // Stable React key, independent of array position - rows are inserted/removed/spliced at
  // arbitrary indices (import, duplicate, generate-all-sizes), and keying by index there let React
  // reuse a row's DOM/input state for a *different* line after a splice, which read as data
  // jumping between rows.
  rowId: number
  productId: number
  colorId: number
  sizeId: number
  variantId: number
  quantity: number
  unitCost: number
  discountPercent: number
}

let nextRowId = 1
const newRowId = () => nextRowId++

const makeEmptyItem = (): InvoiceLineForm => ({ rowId: newRowId(), productId: 0, colorId: 0, sizeId: 0, variantId: 0, quantity: 1, unitCost: 0, discountPercent: 0 })

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
  const [undoPaymentTarget, setUndoPaymentTarget] = useState<{ invoiceId: number; paymentId: number; amount: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterFournisseur, setFilterFournisseur] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
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

  const [lineItems, setLineItems] = useState<InvoiceLineForm[]>([makeEmptyItem()])
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
        showArchived ? invoicesApi.getArchived() : invoicesApi.getAll(),
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
  }, [showArchived])

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
    setLineItems([makeEmptyItem()])
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
      rowId: newRowId(),
      productId: i.productId ?? 0,
      colorId: i.colorId ?? 0,
      sizeId: i.sizeId ?? 0,
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
    setLineItems([makeEmptyItem()])
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

  const addItem = () => setLineItems(prev => [...prev, makeEmptyItem()])
  const removeItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx))

  const generateAllSizes = (idx: number) => {
    const item = lineItems[idx]
    if (!item.productId || !item.colorId) return
    const product = products.find(p => p.id === item.productId)
    if (!product) return
    const newLines: InvoiceLineForm[] = allSizes.map(size => {
      const variant = product.variants.find(v => v.colorId === item.colorId && v.sizeId === size.id)
      return {
        rowId: newRowId(),
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
    const copy: InvoiceLineForm = { ...original, rowId: newRowId(), variantId: 0 }
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
          rowId: newRowId(),
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
            rowId: newRowId(),
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
    // Keep every row the user already populated, not just ones already resolved to a stock
    // variant - variantId is legitimately 0 for a brand-new size/colour combo being ordered for
    // the first time (the backend creates it on save), so filtering on variantId here silently
    // wiped out real, unsaved line items the moment a second bulk import ran.
    setLineItems(prev => [...prev.filter(it => it.productId > 0), ...newItems])
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
  const populatedLineItems = lineItems.filter(it => it.productId > 0)
  const lineItemCount = populatedLineItems.length
  const totalPairs = populatedLineItems.reduce((sum, it) => sum + (it.quantity || 0), 0)

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

  const handleArchive = async (inv: Invoice) => {
    try {
      await invoicesApi.archive(inv.id)
      showToast(t('invoices.archiveSuccess'), 'success')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleUnarchive = async (inv: Invoice) => {
    try {
      await invoicesApi.unarchive(inv.id)
      showToast(t('invoices.unarchiveSuccess'), 'success')
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

  const handleUndoPayment = async () => {
    if (!undoPaymentTarget) return
    try {
      const updated = await invoicesApi.undoPayment(undoPaymentTarget.invoiceId, undoPaymentTarget.paymentId)
      showToast(t('invoices.undoPaymentSuccess'), 'success')
      setUndoPaymentTarget(null)
      setDetail((prev) => (prev && prev.id === updated.id ? updated : prev))
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
      showToast(t('invoices.cancelManySuccess', { count: result.cancelled }), 'success')
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
            colorwayId: 0,
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

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: t('invoices.invoiceNumber'),
      render: (inv) => (
        <button
          type="button"
          onClick={() => setDetail(inv)}
          className="num font-medium text-fg-muted transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] rounded-inset"
        >
          {inv.invoiceNumber}
        </button>
      ),
    },
    { key: 'fournisseur', header: t('invoices.fournisseur'), render: (inv) => <span className="font-medium text-fg">{inv.fournisseurNom}</span> },
    { key: 'date', header: t('invoices.date'), render: (inv) => <span className="text-fg-muted">{formatDate(inv.invoiceDate)}</span> },
    { key: 'terms', header: t('invoices.paymentTerms'), render: (inv) => <span className="text-fg-muted">{t(`invoices.terms.${inv.paymentTerms.toLowerCase()}`)}</span> },
    { key: 'total', header: t('invoices.total'), numeric: true, render: (inv) => <span className="text-fg-muted">{formatCurrency(inv.totalAmount)}</span> },
    { key: 'balance', header: t('invoices.balanceDue'), numeric: true, render: (inv) => <span className="font-semibold text-fg">{formatCurrency(inv.balanceDue)}</span> },
    {
      key: 'status',
      header: t('invoices.status'),
      align: 'center',
      render: (inv) => <StatusBadge domain="invoice" value={inv.status} size="xs" showIcon={false} animate={false} />,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'center',
      width: '13rem',
      render: (inv) => (
        <div className="flex flex-wrap items-center justify-center gap-0.5">
          {inv.archivedAt ? (
            <IconButton icon={<ArchiveRestore className="h-3.5 w-3.5" />} label={t('invoices.unarchive')} size="xs" onClick={() => handleUnarchive(inv)} />
          ) : (
            <>
              {inv.status === 'Pending' && (
                <IconButton icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={t('invoices.receive')} size="xs" onClick={() => handleReceive(inv)} />
              )}
              {inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.balanceDue > 0 && (
                <IconButton icon={<Wallet className="h-3.5 w-3.5" />} label={t('invoices.pay')} size="xs" onClick={() => openPay(inv)} />
              )}
              {inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.status !== 'Received' && (
                <>
                  <IconButton icon={<Pencil className="h-3.5 w-3.5" />} label={t('common.edit')} size="xs" onClick={() => openEdit(inv)} />
                  <IconButton icon={<Ban className="h-3.5 w-3.5" />} label={t('invoices.cancel')} size="xs" variant="danger-ghost" onClick={() => setShowCancel(inv)} />
                </>
              )}
              {!!inv.receivedAt && (
                <IconButton icon={<Tags className="h-3.5 w-3.5" />} label="Imprimer les étiquettes" size="xs" onClick={() => handlePrintLabels(inv.id)} />
              )}
              <IconButton icon={<Archive className="h-3.5 w-3.5" />} label={t('invoices.archive')} size="xs" onClick={() => handleArchive(inv)} />
            </>
          )}
          <IconButton icon={<Printer className="h-3.5 w-3.5" />} label="Imprimer la facture" size="xs" onClick={() => handlePrintInvoice(inv)} />
          <IconButton icon={<FileText className="h-3.5 w-3.5" />} label={t('invoices.summary')} size="xs" onClick={() => setDetail(inv)} />
        </div>
      ),
    },
  ]

  return (
    <Page
      section="invoices"
      className="local-invoices"
      title={t('invoices.title')}
      actions={
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={loadingFormData} loading={loadingFormData}>
          {t('invoices.add')}
        </Button>
      }
    >
      <div className="space-y-6">
        {summary && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('invoices.summaryCards.totalOwed')} value={formatCurrency(summary.totalOwed)} icon={Wallet} />
            <StatCard label={t('invoices.summaryCards.totalOverdue')} value={formatCurrency(summary.totalOverdue)} tone="negative" icon={AlertTriangle} />
            <StatCard label={t('invoices.summaryCards.pendingCount')} value={summary.pendingCount.toString()} tone="caution" icon={Clock} />
            <StatCard label={t('invoices.summaryCards.paidCount')} value={summary.paidCount.toString()} tone="positive" icon={CheckCircle2} />
          </div>
        )}

        <Toolbar className="local-toolbar">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('invoices.search')}
            leading={<Search />}
            size="sm"
            wrapperClassName="w-full sm:w-72"
          />
          <Select size="sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} wrapperClassName="w-44">
            <option value="All">{t('invoices.allStatuses')}</option>
            <option value="Pending">{t('invoices.statuses.pending')}</option>
            <option value="Received">{t('invoices.statuses.received')}</option>
            <option value="Paid">{t('invoices.statuses.paid')}</option>
            <option value="PartiallyPaid">{t('invoices.statuses.partiallyPaid')}</option>
            <option value="Overdue">{t('invoices.statuses.overdue')}</option>
            <option value="Cancelled">{t('invoices.statuses.cancelled')}</option>
          </Select>
          <Select
            size="sm"
            value={filterFournisseur}
            onChange={(e) => setFilterFournisseur(parseInt(e.target.value))}
            wrapperClassName="w-44 ml-auto sm:ml-0"
          >
            <option value={0}>{t('invoices.allFournisseurs')}</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </Select>
          <Button
            size="sm"
            variant={showArchived ? 'solid' : 'outline'}
            icon={showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? t('invoices.showActive') : t('invoices.showArchived')}
          </Button>
        </Toolbar>

        {selection.someSelected && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-card border px-4 py-2.5',
              'border-[color-mix(in_oklab,var(--negative)_28%,transparent)] bg-[var(--negative-soft)]'
            )}
          >
            <span className="text-sm font-medium text-[var(--negative-ink)]">
              <span className="num">{selection.count}</span> facture(s) sélectionnée(s)
            </span>
            <Button size="xs" variant="danger" onClick={handleBulkCancel}>
              {t('invoices.cancel')}
            </Button>
            <Button size="xs" variant="ghost" className="ml-auto" onClick={selection.clear}>
              {t('common.cancel')}
            </Button>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={10} cols={8} />
        ) : filteredInvoices.length === 0 ? (
          <div className="surface-glass">
            <EmptyState
              icon={showArchived ? Archive : FileText}
              variant={searchQuery ? 'search' : 'default'}
              title={showArchived ? t('invoices.noArchivedInvoices') : t('invoices.noInvoices')}
            />
          </div>
        ) : (
          <DataTable<Invoice>
            columns={columns}
            data={filteredInvoices}
            keyField={(inv) => inv.id}
            selection={{
              selected: selection.selected as Set<string | number>,
              onToggle: (key) => selection.toggle(Number(key)),
              onToggleAll: () => selection.toggleAll(filteredInvoices),
              allSelected: selection.allSelected(filteredInvoices),
              someSelected: selection.someSelected,
            }}
          />
        )}
      </div>

      {/* Create / Edit Modal. Only the line-items list scrolls (see the dedicated overflow-y-auto
          section below) - the fournisseur/date/terms fields, totals and action buttons all stay
          pinned, so filling in a long order never scrolls the fields you set once out of view. */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        closeOnBackdrop={false}
        size="2xl"
        title={editingInvoice ? t('invoices.edit') : t('invoices.add')}
        bodyClassName="flex flex-col p-0"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="invoice-form">
              {editingInvoice ? t('common.update') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="invoice-form" onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-3 gap-4 px-5 pb-4 pt-4">
            <div>
              <Select
                required
                label={`${t('invoices.fournisseur')} *`}
                value={form.fournisseurId}
                onChange={(e) => handleFournisseurChange(parseInt(e.target.value))}
              >
                <option value={0}>{t('invoices.fournisseur')}</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </Select>
              {selectedFournisseur && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-fg-subtle">
                  {selectedFournisseur.contact && <span>{selectedFournisseur.contact}</span>}
                  {selectedFournisseur.telephone && <span>· {selectedFournisseur.telephone}</span>}
                </div>
              )}
            </div>
            <Input
              label={t('invoices.reference')}
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="BC-2026-001"
            />
            <Input
              type="date"
              label={t('invoices.date')}
              value={form.invoiceDate ?? ''}
              onChange={(e) => setForm({ ...form, invoiceDate: e.target.value || undefined })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-border px-5 pb-4 pt-4">
            <Select
              label={t('invoices.paymentTerms')}
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
            >
              {paymentTermsOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </Select>
            <Input
              type="date"
              label={t('invoices.dueDate')}
              value={form.dueDate ?? ''}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value || undefined })}
            />
            <Input
              type="number"
              step="0.1"
              min={0}
              max={100}
              label={`${t('invoices.taxRate')} (%)`}
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Line Items with cascading dropdowns. This wrapper (search, import/add controls,
              column headers) stays fixed - only the row list below scrolls. */}
          <div className="border-t border-border px-5 pt-4">
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={t('common.search')}
              leading={<Search />}
              size="sm"
              wrapperClassName="mb-2"
            />
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-fg-subtle">{t('products.variants')}</label>
              <div className="flex items-center gap-3">
                {form.fournisseurId > 0 && (
                  <div className="relative" ref={importDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowImportDropdown(!showImportDropdown)}
                      className="text-xs font-medium text-[var(--positive)] hover:brightness-110"
                    >
                      {t('invoices.importFournisseurProducts')} ({selectedImportProducts.size > 0 ? `${selectedImportProducts.size} sélectionné(s)` : fournisseurProducts.length})
                    </button>
                    {showImportDropdown && (
                      <div className="absolute right-0 top-8 z-20 w-72 rounded-card border border-border bg-surface shadow-e4">
                        <div className="border-b border-border p-2">
                          <Input
                            value={importSearch}
                            onChange={(e) => setImportSearch(e.target.value)}
                            placeholder="Rechercher un produit..."
                            leading={<Search />}
                            size="sm"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredImportProducts.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-fg-subtle">Aucun produit trouvé</p>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={selectAllImportProducts}
                                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-xs font-medium text-fg-muted hover:bg-surface-2"
                              >
                                <span className={cn(
                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border',
                                  selectedImportProducts.size === filteredImportProducts.length
                                    ? 'border-[var(--positive)] bg-[var(--positive)] text-white'
                                    : 'border-border-strong'
                                )}>
                                  {selectedImportProducts.size === filteredImportProducts.length && <CheckCircle2 className="h-3 w-3" />}
                                </span>
                                Tout sélectionner
                              </button>
                              {filteredImportProducts.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => toggleImportProduct(product.id)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fg transition-colors hover:bg-[var(--positive-soft)]"
                                >
                                  <span className={cn(
                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border',
                                    selectedImportProducts.has(product.id)
                                      ? 'border-[var(--positive)] bg-[var(--positive)] text-white'
                                      : 'border-border-strong'
                                  )}>
                                    {selectedImportProducts.has(product.id) && <CheckCircle2 className="h-3 w-3" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{product.name}</p>
                                    <p className="text-fg-subtle">{product.variants.filter(v => v.isActive).length} variante(s)</p>
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                        {/* grid, not flex: two shrink-0 fullWidth buttons in a flex row both
                            claim 100% width and can't shrink for each other - see Button.tsx. */}
                        <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            fullWidth
                            onClick={() => { setShowImportDropdown(false); setImportSearch(''); setSelectedImportProducts(new Set()) }}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="success"
                            fullWidth
                            disabled={selectedImportProducts.size === 0}
                            onClick={importSelectedProducts}
                          >
                            Importer ({selectedImportProducts.size})
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Button type="button" size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} disabled={!form.fournisseurId} onClick={addItem}>
                  {t('invoices.addProduct')}
                </Button>
              </div>
            </div>
            {!form.fournisseurId && (
              <p className="mb-2 text-xs text-[var(--caution)]">{t('invoices.selectFournisseurFirst')}</p>
            )}
            <div className="mb-1 grid grid-cols-[1fr_1fr_1fr_auto_80px_90px_70px_70px_auto] gap-2 px-1">
              <span className="text-xs font-medium text-fg-subtle">{t('products.name')}</span>
              <span className="text-xs font-medium text-fg-subtle">{t('products.color')}</span>
              <span className="text-xs font-medium text-fg-subtle">{t('products.size')}</span>
              <span className="w-[50px]"></span>
              <span className="text-xs font-medium text-fg-subtle">{t('common.quantity')}</span>
              <span className="text-xs font-medium text-fg-subtle" title="Prix d'achat du fournisseur (même valeur que 'Prix de revient' du produit)">{t('invoices.unitCost')}</span>
              <span className="text-xs font-medium text-fg-subtle">Remise %</span>
              <span className="text-right text-xs font-medium text-fg-subtle">{t('invoices.lineTotal')}</span>
              <span className="w-[24px]"></span>
            </div>
          </div>

          {/* The one scrolling region in this form. Sized generously (as tall as the list used to
              render before it had its own scrollbar) rather than shrunk to whatever flexbox leaves
              over from the other fields - it only needs a cap so a long order scrolls its own
              product list instead of growing the modal or scrolling the fournisseur/date fields
              and totals out of view. */}
          <div className="max-h-[55vh] min-h-[240px] overflow-y-auto px-5">
            <div className="space-y-2 pb-1">
              {lineItems.map((item, idx) => {
                const colors = getAvailableColors(item.productId)
                const sizes = getAvailableSizes(item.productId, item.colorId)
                return (
                  <div key={item.rowId} className="grid grid-cols-[1fr_1fr_1fr_auto_80px_90px_70px_70px_auto] items-center gap-2 rounded-field border border-transparent px-1 py-1 transition-colors hover:border-border hover:bg-surface-2">
                    <Select
                      size="sm"
                      value={item.productId}
                      onChange={(e) => updateLineItem(idx, { productId: parseInt(e.target.value) })}
                      disabled={!form.fournisseurId}
                    >
                      <option value={0}>{t('invoices.selectProduct')}</option>
                      {searchedProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                    <Select
                      size="sm"
                      value={item.colorId}
                      onChange={(e) => updateLineItem(idx, { colorId: parseInt(e.target.value) })}
                      disabled={!item.productId}
                    >
                      <option value={0}>{t('products.selectColor')}</option>
                      {colors.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    <Select
                      size="sm"
                      value={item.sizeId}
                      onChange={(e) => updateLineItem(idx, { sizeId: parseInt(e.target.value) })}
                      disabled={!item.colorId}
                    >
                      <option value={0}>{t('products.selectSize')}</option>
                      {sizes.map((s) => (
                        <option key={s.id} value={s.id}>{s.value}</option>
                      ))}
                    </Select>
                    {item.productId > 0 && item.colorId > 0 && (
                      <button
                        type="button"
                        onClick={() => generateAllSizes(idx)}
                        className="whitespace-nowrap px-1 text-xs font-medium text-[var(--accent)] hover:brightness-110"
                        title="Generer toutes les tailles"
                      >
                        +Toutes
                      </button>
                    )}
                    <Input
                      size="sm"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                    />
                    <Input
                      size="sm"
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.unitCost}
                      onChange={(e) => updateLineItem(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      size="sm"
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={item.discountPercent}
                      onChange={(e) => updateLineItem(idx, { discountPercent: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="num text-right text-sm font-medium text-fg-muted">
                      {formatCurrency((item.quantity * item.unitCost) - (item.discountPercent > 0 ? item.quantity * item.unitCost * item.discountPercent / 100 : 0))}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <IconButton
                        icon={<Copy className="h-3.5 w-3.5" />}
                        label={t('common.duplicate') || 'Dupliquer'}
                        size="xs"
                        onClick={() => duplicateItem(idx)}
                      />
                      <IconButton
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label={t('common.delete')}
                        size="xs"
                        variant="danger-ghost"
                        onClick={() => removeItem(idx)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-4 border-t border-border px-5 pb-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                step="0.01"
                min={0}
                label={`${t('invoices.discount')} (${t('common.total')})`}
                value={form.discountAmount}
                onChange={(e) => setForm({ ...form, discountAmount: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label={t('invoices.notes')}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2 rounded-card bg-sunken p-4">
              <div className="flex justify-between text-sm">
                <span className="text-fg-subtle">
                  <span className="num">{lineItemCount}</span> {t('invoices.products')}
                  {' · '}
                  <span className="num">{totalPairs}</span> {t('invoices.totalPairs')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-fg-subtle">{t('invoices.subTotal')}</span>
                <span className="num text-fg-muted">{formatCurrency(calcSubTotal())}</span>
              </div>
              {form.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-fg-subtle">{t('invoices.discount')}</span>
                  <span className="num text-[var(--negative)]">-{formatCurrency(form.discountAmount)}</span>
                </div>
              )}
              {form.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-fg-subtle">{t('invoices.taxRate')} ({form.taxRate}%)</span>
                  <span className="num text-fg-muted">{formatCurrency(calcTax())}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-fg">{t('invoices.total')}</span>
                <span className="num text-fg">{formatCurrency(calcTotal())}</span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Pay Modal */}
      <Modal
        open={!!showPay}
        onClose={() => setShowPay(null)}
        size="sm"
        title={t('invoices.pay')}
        description={showPay ? `${showPay.invoiceNumber} — ${showPay.fournisseurNom}` : undefined}
      >
        {showPay && (
          <form onSubmit={handlePay} className="space-y-4">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={showPay.balanceDue}
              label={t('invoices.paymentAmount')}
              hint={`${t('invoices.balanceDue')}: ${formatCurrency(showPay.balanceDue)}`}
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
            />
            <Select label={t('invoices.paymentMethod')} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="Cash">{t('sales.payments.cash')}</option>
              <option value="Card">{t('sales.payments.card')}</option>
              <option value="Transfer">Virement</option>
              <option value="Cheque">Cheque</option>
            </Select>
            <Input
              label={t('invoices.paymentReference')}
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              placeholder="CHQ-001, VIR-002..."
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPay(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">
                {t('common.confirm')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={!!showCancel}
        onClose={() => { setShowCancel(null); setCancelReason('') }}
        size="sm"
        title={t('invoices.cancel')}
        description={showCancel?.invoiceNumber}
      >
        <Textarea
          label={t('invoices.cancelReason')}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { setShowCancel(null); setCancelReason('') }}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleCancel}>
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        open={!!showCancel}
        onClose={() => setShowCancel(null)}
        size="sm"
        title={t('invoices.cancel')}
        description={showCancel?.invoiceNumber}
      >
        <p className="mb-5 text-sm text-fg-muted">{t('invoices.cancelConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowCancel(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="soft" onClick={handleCancel}>
            {t('invoices.cancel')}
          </Button>
        </div>
      </Modal>

      {/* Receive Confirmation Modal */}
      <Modal
        open={!!showReceive}
        onClose={() => setShowReceive(null)}
        size="sm"
        title={t('invoices.receive')}
        description={showReceive ? `${showReceive.invoiceNumber} — ${showReceive.fournisseurNom}` : undefined}
      >
        <p className="mb-5 text-sm text-fg-muted">{t('invoices.receiveConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowReceive(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={confirmReceive}>
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>

      {/* Undo Payment Confirmation Modal */}
      <Modal
        open={!!undoPaymentTarget}
        onClose={() => setUndoPaymentTarget(null)}
        size="sm"
        title={t('invoices.undoPayment')}
      >
        <p className="mb-5 text-sm text-fg-muted">
          {t('invoices.undoPaymentConfirm', { amount: undoPaymentTarget ? formatCurrency(undoPaymentTarget.amount) : '' })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setUndoPaymentTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleUndoPayment}>
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        size="2xl"
        title={detail?.invoiceNumber}
        description={detail?.fournisseurNom}
        footer={
          detail ? (
            <>
              {!!detail.receivedAt && (
                <Button
                  size="sm"
                  variant="soft"
                  icon={<Tags className="h-3.5 w-3.5" />}
                  onClick={() => { handlePrintLabels(detail.id); setDetail(null) }}
                >
                  Imprimer les étiquettes
                </Button>
              )}
              <Button size="sm" variant="soft" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => handlePrintInvoice(detail)}>
                Imprimer la facture
              </Button>
            </>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-fg-subtle">{t('invoices.date')}</span>
                <p className="font-medium text-fg">{formatDate(detail.invoiceDate)}</p>
              </div>
              <div>
                <span className="text-xs text-fg-subtle">{t('invoices.status')}</span>
                <div className="mt-1">
                  <StatusBadge domain="invoice" value={detail.status} size="sm" />
                </div>
              </div>
              <div>
                <span className="text-xs text-fg-subtle">{t('invoices.paymentTerms')}</span>
                <p className="font-medium text-fg">{t(`invoices.terms.${detail.paymentTerms.toLowerCase()}`)}</p>
              </div>
            </div>
            {detail.dueDate && (
              <div className="text-sm">
                <span className="text-fg-subtle">{t('invoices.dueDate')}: </span>
                <span className="font-medium text-fg">{formatDate(detail.dueDate)}</span>
              </div>
            )}
            {detail.reference && (
              <div className="text-sm">
                <span className="text-fg-subtle">{t('invoices.reference')}: </span>
                <span className="font-medium text-fg">{detail.reference}</span>
              </div>
            )}

            <DataTable
              sticky={false}
              columns={[
                {
                  key: 'product',
                  header: t('products.name'),
                  render: (it: Invoice['items'][number]) => (
                    <div>
                      <p className="font-medium text-fg">{it.productName}</p>
                      {it.variantSku && <p className="num text-xs text-fg-subtle">{it.variantSku}</p>}
                    </div>
                  ),
                },
                { key: 'color', header: t('products.color'), render: (it: Invoice['items'][number]) => <span className="text-fg-muted">{it.colorName ?? '-'}</span> },
                { key: 'size', header: t('products.size'), render: (it: Invoice['items'][number]) => <span className="text-fg-muted">{it.sizeValue ?? '-'}</span> },
                { key: 'qty', header: t('common.quantity'), numeric: true, render: (it: Invoice['items'][number]) => <span className="text-fg-muted">{it.quantity}</span> },
                { key: 'unitCost', header: t('invoices.unitCost'), numeric: true, render: (it: Invoice['items'][number]) => <span className="text-fg-muted">{formatCurrency(it.unitCost)}</span> },
                {
                  key: 'discount',
                  header: t('invoices.discount'),
                  numeric: true,
                  render: (it: Invoice['items'][number]) => it.discountPercent > 0 ? <span className="text-[var(--negative)]">-{it.discountPercent}%</span> : <span className="text-fg-subtle">-</span>,
                },
                { key: 'lineTotal', header: t('invoices.lineTotal'), numeric: true, render: (it: Invoice['items'][number]) => <span className="font-medium text-fg">{formatCurrency(it.lineTotal)}</span> },
              ]}
              data={detail.items}
              keyField={(it) => it.id}
            />

            <div className="space-y-1 border-t border-border pt-3 text-right text-sm">
              <p className="text-fg-subtle">
                <span className="num">{detail.items.length}</span> {t('invoices.products')}
                {' · '}
                <span className="num">{detail.items.reduce((sum, it) => sum + it.quantity, 0)}</span> {t('invoices.totalPairs')}
              </p>
              <p className="text-fg-subtle">{t('invoices.subTotal')}: <span className="num text-fg-muted">{formatCurrency(detail.subTotal)}</span></p>
              {detail.discountAmount > 0 && (
                <p className="text-fg-subtle">{t('invoices.discount')}: <span className="num text-[var(--negative)]">-{formatCurrency(detail.discountAmount)}</span></p>
              )}
              {detail.taxAmount > 0 && (
                <p className="text-fg-subtle">{t('invoices.taxRate')} ({detail.taxRate}%): <span className="num text-fg-muted">{formatCurrency(detail.taxAmount)}</span></p>
              )}
              <p className="border-t border-border pt-1 text-base font-semibold text-fg">{t('invoices.total')}: <span className="num">{formatCurrency(detail.totalAmount)}</span></p>
              <p className="text-[var(--positive)]">{t('invoices.paid')}: <span className="num">{formatCurrency(detail.paidAmount)}</span></p>
              <p className="font-semibold text-fg">{t('invoices.balanceDue')}: <span className="num">{formatCurrency(detail.balanceDue)}</span></p>
            </div>

            {detail.payments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-fg-subtle">{t('invoices.pay')} (<span className="num">{detail.payments.length}</span>)</p>
                <div className="space-y-1.5">
                  {detail.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-inset bg-sunken px-3 py-2 text-sm">
                      <div>
                        <span className="text-fg-muted">{formatDate(p.paymentDate)}</span>
                        <span className="mx-2 text-fg-subtle">—</span>
                        <span className="text-fg">{p.paymentMethod}</span>
                        {p.reference && <span className="ml-2 text-fg-subtle">({p.reference})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="num font-medium text-fg">{formatCurrency(p.amount)}</span>
                        <IconButton
                          icon={<Undo2 className="h-3.5 w-3.5" />}
                          label={t('invoices.undoPayment')}
                          size="xs"
                          variant="danger-ghost"
                          onClick={() => setUndoPaymentTarget({ invoiceId: detail.id, paymentId: p.id, amount: p.amount })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.notes && (
              <div className="rounded-card bg-sunken p-3">
                <p className="mb-1 text-xs font-medium text-fg-subtle">{t('invoices.notes')}</p>
                <p className="whitespace-pre-wrap text-sm text-fg">{detail.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Page>
  )
}
