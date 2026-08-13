import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import JsBarcode from 'jsbarcode'
import type { ProductVariant } from '../../types/product'
import { Button } from '../ui'

interface BarcodeLabelProps {
  variant: ProductVariant & { productName: string }
  onPrint?: () => void
  labelSize?: '50x25' | '40x30' | '60x40' | '70x50' | '100x50'
}

const LABEL_SIZES = {
  '50x25': { w: 50, h: 30 },
  '40x30': { w: 40, h: 32 },
  '60x40': { w: 60, h: 42 },
  '70x50': { w: 70, h: 52 },
  '100x50': { w: 100, h: 55 },
} as const

export type LabelSizeCode = keyof typeof LABEL_SIZES

export default function BarcodeLabel({ variant, onPrint, labelSize = '50x25' }: BarcodeLabelProps) {
  const { t } = useTranslation()
  const svgRef = useRef<SVGSVGElement>(null)
  const s = LABEL_SIZES[labelSize]

  useEffect(() => {
    if (svgRef.current && variant.barcode) {
      JsBarcode(svgRef.current, variant.barcode, {
        format: 'CODE128',
        width: 1.4,
        height: 35,
        displayValue: false,
        margin: 0,
        background: 'transparent',
        lineColor: '#000000',
      })
    }
  }, [variant.barcode])

  if (!variant.barcode) return null

  return (
    <div
      data-theme="light"
      data-perf="lean"
      className="print-label inline-block border border-slate-300 rounded bg-white"
      style={{ width: `${s.w}mm`, height: `${s.h}mm`, padding: '2mm', overflow: 'hidden', boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', overflow: 'hidden' }}>
        <p
          style={{ fontWeight: 700, textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '8pt', margin: 0 }}
        >
          {variant.productName}
        </p>
        <div style={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 0 }}>
          <svg ref={svgRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', overflow: 'hidden', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '9pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {variant.colorName} / {variant.sizeValue}
          </span>
          {variant.price > 0 && (
            <span style={{ fontWeight: 700, fontSize: '9pt', whiteSpace: 'nowrap', marginLeft: '2mm' }}>
              {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(variant.price).replace('MAD', 'DH')}
            </span>
          )}
        </div>
      </div>
      {onPrint && (
        <Button
          size="xs"
          variant="outline"
          fullWidth
          onClick={onPrint}
          className="no-print mt-1 h-auto py-0.5 text-[8px]"
        >
          {t('products.printLabel')}
        </Button>
      )}
    </div>
  )
}

export function printLabel(variant: ProductVariant & { productName: string }, labelSize: LabelSizeCode = '50x25') {
  printLabels([variant], labelSize, 1)
}

export function printLabels(
  variants: (ProductVariant & { productName: string })[],
  labelSize: LabelSizeCode = '50x25',
  copies: number = 1
) {
  if (variants.length === 0) return

  const s = LABEL_SIZES[labelSize]
  const allLabels: (ProductVariant & { productName: string })[] = []
  for (const v of variants) {
    for (let i = 0; i < copies; i++) allLabels.push(v)
  }

  const labelsHtml = allLabels.map((v) => `
    <div class="label">
      <div class="lname">${esc(v.productName)}</div>
      <div class="lbar"><svg class="bc" data-code="${esc(v.barcode ?? '')}"></svg></div>
      <div class="lfoot">
        <span class="lcolor">${esc(v.colorName)} / ${esc(v.sizeValue)}</span>
        ${v.price > 0 ? `<span class="lprice">${new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(v.price).replace('MAD', 'DH')}</span>` : ''}
      </div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<title>Étiquettes</title>
<style>
  @page { size: ${s.w}mm ${s.h}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .labels { display: flex; flex-wrap: wrap; gap: 0; padding: 0; }
  .label {
    width: ${s.w}mm; height: ${s.h}mm;
    border: none; padding: 2mm;
    page-break-inside: avoid; break-inside: avoid;
    overflow: hidden; background: white;
    display: flex; flex-direction: column;
  }
  .lname {
    font-weight: 700; text-align: center; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-size: 8pt; flex-shrink: 0;
  }
  .lbar {
    flex: 1; display: flex; align-items: center; justify-content: center;
    overflow: hidden; min-height: 0; text-align: center;
  }
  .lbar svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .lfoot {
    display: flex; justify-content: space-between; align-items: baseline;
    overflow: hidden; flex-shrink: 0;
  }
  .lcolor { font-weight: 700; font-size: 9pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lprice { font-weight: 700; font-size: 9pt; white-space: nowrap; margin-left: 2mm; }
  @media print { .label { border: none; } }
</style>
</head>
<body>
<div class="labels">${labelsHtml}</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>
  document.querySelectorAll('.bc').forEach(function(svg) {
    var code = svg.getAttribute('data-code');
    if (code) {
      JsBarcode(svg, code, {
        format: 'CODE128',
        width: 1.4,
        height: 40,
        displayValue: false,
        margin: 0,
        background: 'white',
        lineColor: '#000000'
      });
    }
  });
  window.__barcodeReady = true;
<\/script>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  const tryPrint = () => {
    try {
      const win = iframe.contentWindow
      if (win && (win as unknown as Record<string, unknown>).__barcodeReady) {
        win.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      } else {
        setTimeout(tryPrint, 100)
      }
    } catch {
      setTimeout(tryPrint, 100)
    }
  }

  iframe.onload = () => setTimeout(tryPrint, 200)
}

// Prints a single label for a product-level barcode (distinct from each variant's own
// barcode) — scanning it in the POS shows every variant of the product, not one specific item.
export function printProductBarcode(product: { name: string; barcode: string }, labelSize: LabelSizeCode = '60x40') {
  if (!product.barcode) return
  const s = LABEL_SIZES[labelSize]

  const html = `<!DOCTYPE html>
<html>
<head>
<title>Code-barres produit</title>
<style>
  @page { size: ${s.w}mm ${s.h}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .label {
    width: ${s.w}mm; height: ${s.h}mm;
    padding: 2.5mm;
    overflow: hidden; background: white;
    display: flex; flex-direction: column;
  }
  .lname {
    font-weight: 700; text-align: center; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-size: 20pt; flex-shrink: 0; margin-bottom: 1.5mm;
  }
  .lbar {
    flex: 1; display: flex; align-items: center; justify-content: center;
    overflow: hidden; min-height: 0; text-align: center;
  }
  .lbar svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
</style>
</head>
<body>
<div class="label">
  <div class="lname">${esc(product.name)}</div>
  <div class="lbar"><svg class="bc" data-code="${esc(product.barcode)}"></svg></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>
  var svg = document.querySelector('.bc');
  JsBarcode(svg, svg.getAttribute('data-code'), {
    format: 'CODE128', width: 1.8, height: 55, displayValue: false, margin: 0,
    background: 'white', lineColor: '#000000'
  });
  window.__barcodeReady = true;
<\/script>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  const tryPrint = () => {
    try {
      const win = iframe.contentWindow
      if (win && (win as unknown as Record<string, unknown>).__barcodeReady) {
        win.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      } else {
        setTimeout(tryPrint, 100)
      }
    } catch {
      setTimeout(tryPrint, 100)
    }
  }

  iframe.onload = () => setTimeout(tryPrint, 200)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
