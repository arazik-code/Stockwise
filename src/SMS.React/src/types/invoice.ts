export type InvoiceStatus = 'Pending' | 'Paid' | 'PartiallyPaid' | 'Overdue' | 'Cancelled' | 'Received'

export type PaymentTerms = 'Comptant' | 'Net15' | 'Net30' | 'Net45' | 'Net60' | 'Net90'

export interface InvoiceLineItem {
  id: number
  productVariantId?: number
  productName: string
  variantSku?: string
  variantBarcode?: string
  colorName?: string
  sizeValue?: string
  description?: string
  quantity: number
  unitCost: number
  discountPercent: number
  discountAmount: number
  lineTotal: number
  colorId?: number
  sizeId?: number
}

export interface InvoicePayment {
  id: number
  amount: number
  paymentMethod: string
  paymentDate: string
  reference?: string
  notes?: string
  createdAt: string
}

export interface Invoice {
  id: number
  invoiceNumber: string
  fournisseurId: number
  fournisseurNom: string
  status: InvoiceStatus
  subTotal: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  paymentTerms: PaymentTerms
  invoiceDate: string
  dueDate?: string
  paidAt?: string
  notes?: string
  reference?: string
  createdByUserName?: string
  items: InvoiceLineItem[]
  payments: InvoicePayment[]
  createdAt: string
}

export interface CreateInvoiceLineItemRequest {
  productVariantId?: number
  productId?: number
  colorId?: number
  sizeId?: number
  description?: string
  quantity: number
  unitCost: number
  discountPercent: number
}

export interface CreateInvoiceRequest {
  fournisseurId: number
  invoiceDate?: string
  dueDate?: string
  paymentTerms: PaymentTerms
  discountAmount: number
  taxRate: number
  notes?: string
  reference?: string
  items: CreateInvoiceLineItemRequest[]
}

export interface PayInvoiceRequest {
  amount: number
  paymentMethod: string
  reference?: string
  notes?: string
}

export interface CancelInvoiceRequest {
  reason?: string
}

export interface FournisseurBalance {
  fournisseurId: number
  fournisseurNom: string
  totalOwed: number
  invoiceCount: number
}

export interface InvoiceLabelData {
  productName: string
  barcode: string
  colorName: string
  sizeValue: string
  price: number
  quantity: number
}

export interface InvoiceSummary {
  totalOwed: number
  totalOverdue: number
  pendingCount: number
  overdueCount: number
  paidCount: number
  totalCount: number
  fournisseurBalances: FournisseurBalance[]
}
