import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { printReceipt, buildReceiptData } from '../../utils/printReceipt'
import { showToast } from '../shared/Toast'
import { Badge, Button, DataTable, Modal, StatusBadge } from '../ui'
import { getStatus } from '../../design/status'
import type { Sale } from '../../types/sale'

interface SaleDetailProps {
  sale: Sale
  onClose: () => void
}

export default function SaleDetail({ sale, onClose }: SaleDetailProps) {
  const { t } = useTranslation()
  const [printing, setPrinting] = useState(false)

  const handleReprint = async () => {
    setPrinting(true)
    try {
      const receipt = buildReceiptData({
        saleNumber: sale.saleNumber,
        items: sale.items.map((i) => ({
          productVariantId: i.productVariantId,
          productId: 0,
          name: i.productName,
          sku: i.variantSku,
          colorName: i.colorName,
          sizeValue: i.sizeValue,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
          isLiquidation: false,
        })),
        subtotal: sale.subTotal,
        taxRate: sale.subTotal > 0 ? sale.taxAmount / sale.subTotal : 0,
        taxAmount: sale.taxAmount,
        loyaltyDiscount: sale.loyaltyDiscountAmount,
        total: sale.totalAmount,
        // ReceiptData only distinguishes Cash/Card - Online (Shopify) sales print as Card, closer
        // to an electronic payment than cash in a drawer.
        paymentMethod: sale.paymentMethod === 'Cash' ? 'Cash' : 'Card',
        amountPaid: sale.amountPaid,
        change: sale.changeGiven,
        clientName: sale.clientName,
        pointsEarned: sale.loyaltyPointsEarned,
        pointsRedeemed: sale.loyaltyPointsRedeemed,
        receiptBarcode: sale.receiptBarcode,
        cashier: sale.userName,
      })
      await printReceipt(receipt)
    } catch {
      showToast(t('sales.detailModal.reprintFailed'), 'error')
    } finally {
      setPrinting(false)
    }
  }

  const totalQty = sale.items.reduce((sum, i) => sum + i.quantity, 0)
  const totalCost = sale.items.reduce((sum, i) => sum + (i.costPrice * i.quantity), 0)
  const profit = sale.totalAmount - totalCost
  const categoryKey = `sales.categories.${(sale.category ?? '').charAt(0).toLowerCase() + (sale.category ?? '').slice(1)}`

  return (
    /* closeOnEsc is safe to enable here: neither this component nor SalesPage
       binds a keydown listener, so nothing else owns Escape while it is open. */
    <Modal
      open
      onClose={onClose}
      closeOnEsc
      size="xl"
      title={t('sales.detailModal.title')}
      description={`${sale.saleNumber} · ${formatDateTime(sale.createdAt)}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button
            variant="soft"
            size="sm"
            onClick={handleReprint}
            loading={printing}
            icon={<Printer className="h-4 w-4" />}
          >
            {printing ? t('sales.detailModal.printing') : t('sales.detailModal.reprintReceipt')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Sale Info Row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <InfoItem
            label={t('sales.detailModal.channel')}
            value={<StatusBadge domain="channel" value={sale.channel} size="xs" animate={false} />}
          />
          {/* Keeps the existing fr.ts label (categoryKey, derived above) while
              taking its colour from the unified registry. */}
          <InfoItem
            label={t('sales.detailModal.category')}
            value={
              <Badge size="xs" tone={getStatus('saleCategory', sale.category).tone}>
                {t(categoryKey)}
              </Badge>
            }
          />
          <InfoItem
            label={t('sales.detailModal.status')}
            value={<StatusBadge domain="sale" value={sale.status} size="xs" animate={false} />}
          />
          <InfoItem
            label={t('sales.detailModal.payment')}
            value={t(`sales.payments.${(sale.paymentMethod ?? '').toLowerCase()}`)}
          />
          <InfoItem label={t('sales.detailModal.cashier')} value={sale.userName ?? '-'} />
          <InfoItem label={t('sales.detailModal.client')} value={sale.clientName ?? '-'} />
          <InfoItem
            label={t('sales.items')}
            value={
              <span className="num">
                {sale.items.length} ({totalQty} {t('common.items')})
              </span>
            }
          />
          <InfoItem
            label={t('sales.detailModal.profit')}
            value={
              <span
                data-tone={profit >= 0 ? 'positive' : 'negative'}
                className="num text-[var(--tone)]"
              >
                {formatCurrency(profit)}
              </span>
            }
          />
          {sale.receiptBarcode && (
            <InfoItem
              label={t('pos.receipt')}
              value={<span className="num">{sale.receiptBarcode}</span>}
            />
          )}
        </div>

        {/* Items Table */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-fg">{t('sales.detailModal.items')}</h4>
          <DataTable<Sale['items'][number]>
            columns={[
              {
                key: 'product',
                header: t('sales.detailModal.product'),
                render: (item) => (
                  <>
                    <p className="font-medium text-fg">{item.productName}</p>
                    <p className="num text-[10px] text-fg-subtle">{item.variantSku}</p>
                  </>
                ),
              },
              {
                key: 'variant',
                header: t('sales.detailModal.variant'),
                width: '9rem',
                render: (item) => (
                  <span className="text-fg-muted">
                    {item.colorName} / {item.sizeValue}
                  </span>
                ),
              },
              {
                key: 'qty',
                header: t('sales.detailModal.qty'),
                align: 'center',
                width: '4.5rem',
                cellClassName: 'num',
                render: (item) => <span className="font-medium text-fg">{item.quantity}</span>,
              },
              {
                key: 'unitPrice',
                header: t('sales.detailModal.unitPrice'),
                numeric: true,
                width: '7rem',
                render: (item) => (
                  <span className="text-fg-muted">{formatCurrency(item.unitPrice)}</span>
                ),
              },
              {
                key: 'discount',
                header: t('sales.detailModal.discount'),
                numeric: true,
                width: '7rem',
                render: (item) => (
                  <span className="text-fg-subtle">
                    {item.discountAmount > 0 ? `-${formatCurrency(item.discountAmount)}` : '-'}
                  </span>
                ),
              },
              {
                key: 'lineTotal',
                header: t('sales.detailModal.lineTotal'),
                numeric: true,
                width: '7.5rem',
                render: (item) => (
                  <span className="font-medium text-fg">{formatCurrency(item.lineTotal)}</span>
                ),
              },
            ]}
            data={sale.items}
            keyField={(_item, i) => i}
            sticky={false}
          />
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-fg">
              {t('sales.detailModal.summary')}
            </h4>
            <div className="space-y-2 text-sm">
              <Row
                label={t('sales.detailModal.subtotal')}
                value={formatCurrency(sale.subTotal)}
              />
              {sale.taxAmount > 0 && (
                <Row label={t('sales.detailModal.tax')} value={formatCurrency(sale.taxAmount)} />
              )}
              {sale.discountAmount > 0 && (
                <Row
                  label={t('sales.detailModal.discount')}
                  value={`-${formatCurrency(sale.discountAmount)}`}
                  valueClass="text-[var(--negative)]"
                />
              )}
              {sale.loyaltyDiscountAmount > 0 && (
                <Row
                  label={t('sales.detailModal.loyaltyDiscount')}
                  value={`-${formatCurrency(sale.loyaltyDiscountAmount)}`}
                  valueClass="text-[var(--negative)]"
                />
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-bold">
                <span className="text-fg">{t('sales.detailModal.total')}</span>
                <span className="num text-fg">{formatCurrency(sale.totalAmount)}</span>
              </div>
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                <Row
                  label={t('sales.detailModal.amountPaid')}
                  value={formatCurrency(sale.amountPaid)}
                />
                {sale.changeGiven > 0 && (
                  <Row
                    label={t('sales.detailModal.change')}
                    value={formatCurrency(sale.changeGiven)}
                    valueClass="text-fg-subtle"
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-fg">{t('sales.detailModal.profit')}</h4>
            <div className="space-y-2 text-sm">
              <Row
                label={t('sales.detailModal.lineTotal')}
                value={formatCurrency(sale.subTotal)}
              />
              <Row label={t('sales.detailModal.cost')} value={formatCurrency(totalCost)} />
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-bold">
                <span className="text-fg">{t('sales.detailModal.profit')}</span>
                <span
                  data-tone={profit >= 0 ? 'positive' : 'negative'}
                  className="num text-[var(--tone)]"
                >
                  {formatCurrency(profit)}
                </span>
              </div>

              {(sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0) && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  <h5 className="mt-2 text-xs font-semibold uppercase text-fg-subtle">
                    {t('sales.detailModal.loyalty')}
                  </h5>
                  {sale.loyaltyPointsEarned > 0 && (
                    <Row
                      label={t('sales.detailModal.pointsEarned')}
                      value={`+${sale.loyaltyPointsEarned}`}
                      valueClass="text-[var(--positive)]"
                    />
                  )}
                  {sale.loyaltyPointsRedeemed > 0 && (
                    <Row
                      label={t('sales.detailModal.pointsRedeemed')}
                      value={`-${sale.loyaltyPointsRedeemed}`}
                      valueClass="text-[var(--negative)]"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </p>
      <div className="text-sm font-medium text-fg">{value}</div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className={`num font-medium ${valueClass || 'text-fg'}`}>{value}</span>
    </div>
  )
}
