import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff, Save, X } from 'lucide-react'
import { settingsApi, type InvoiceTemplateConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'
import { Button, Input, Page, Select, Switch, Tabs, cn } from '../components/ui'

const DEFAULT_TEMPLATE: InvoiceTemplateConfig = {
  shopName: 'FLEX SHOES',
  shopAddress: '',
  shopPhone: '',
  shopEmail: '',
  shopWebsite: '',
  taxId: '',
  logoBase64: '',
  showSku: true,
  showColor: true,
  showSize: true,
  showBarcode: false,
  showDescription: false,
  showHeader: true,
  showFooter: true,
  showTax: true,
  showPaymentInfo: true,
  showSignature: false,
  showBorders: true,
  fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
  fontSize: '10',
  headerText: 'FACTURE',
  footerText: 'Merci pour votre confiance!',
  notesLabel: 'Notes',
  defaultNotes: '',
  paperSize: 'A4',
  landscape: false,
}

const PREVIEW_ITEMS = [
  { productName: 'Chaussures Sport Elite', sku: 'PRD-001-C-N-42', colorName: 'Noir', sizeValue: '42', barcode: '6111234567890', description: 'Édition limitée cuir véritable', quantity: 2, unitCost: 299.00, discountPercent: 0, discountAmount: 0, lineTotal: 598.00 },
  { productName: 'Sneakers Classic Premium', sku: 'PRD-002-C-B-40', colorName: 'Blanc', sizeValue: '40', barcode: '6111234567891', description: '', quantity: 1, unitCost: 199.00, discountPercent: 10, discountAmount: 19.90, lineTotal: 179.10 },
  { productName: 'Mocassins Cuir Artisanal', sku: 'PRD-003-C-M-43', colorName: 'Marron', sizeValue: '43', barcode: '6111234567892', description: 'Cuir véritable handmade', quantity: 3, unitCost: 450.00, discountPercent: 0, discountAmount: 0, lineTotal: 1350.00 },
]

export default function InvoiceDesignerPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<InvoiceTemplateConfig>(DEFAULT_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'shop' | 'table' | 'layout' | 'sections'>('shop')
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    settingsApi.getInvoiceTemplate()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const update = useCallback((patch: Partial<InvoiceTemplateConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo trop volumineux (max 2MB)', 'warning')
      return
    }
    const reader = new FileReader()
    reader.onload = () => update({ logoBase64: reader.result as string })
    reader.readAsDataURL(file)
  }, [update])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await settingsApi.updateInvoiceTemplate(config)
      showToast('Modèle enregistré', 'success')
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error')
    } finally {
      setSaving(false)
    }
  }, [config])

  if (loading) {
    return (
      <Page section="invoiceDesign" title="Design Facture" bare fill>
        <div className="flex flex-1 items-center justify-center text-sm text-fg-subtle">{t('common.loading')}</div>
      </Page>
    )
  }

  return (
    <Page
      section="invoiceDesign"
      title="Design Facture"
      bare
      fill
      actions={
        <Button onClick={handleSave} loading={saving} size="sm" icon={<Save className="h-4 w-4" />}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      }
    >
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <div className="w-[380px] shrink-0 overflow-auto border-r border-border bg-surface">
          <Tabs
            items={[
              { value: 'shop', label: 'Boutique' },
              { value: 'table', label: 'Tableau' },
              { value: 'layout', label: 'Mise en page' },
              { value: 'sections', label: 'Sections' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            size="sm"
            className="sticky top-0 z-10 bg-surface"
          />

          <div className="space-y-5 p-5">
            {activeTab === 'shop' && (
              <>
                <div>
                  <label className="mb-2 block text-xs font-medium text-fg-muted">Logo</label>
                  <div className="flex items-center gap-4">
                    {config.logoBase64 ? (
                      <div className="relative">
                        <img src={config.logoBase64} alt="Logo" className="h-16 w-16 rounded-field border border-border bg-surface object-contain p-1" />
                        <button
                          onClick={() => update({ logoBase64: '' })}
                          aria-label="Supprimer le logo"
                          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--negative)] text-white transition-colors duration-fast hover:brightness-110"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-field border border-dashed border-border text-fg-subtle">
                        <ImageOff className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <Button variant="ghost" size="xs" onClick={() => logoInputRef.current?.click()}>
                        {config.logoBase64 ? 'Changer' : 'Ajouter un logo'}
                      </Button>
                      <p className="mt-1 text-xs text-fg-subtle">PNG, JPG · Max 2MB</p>
                      <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </div>
                  </div>
                </div>
                <Field label="Nom de la boutique" value={config.shopName} onChange={(v) => update({ shopName: v })} />
                <Field label="Adresse" value={config.shopAddress} onChange={(v) => update({ shopAddress: v })} placeholder="123 Rue Principale, Casablanca" />
                <Field label="Téléphone" value={config.shopPhone} onChange={(v) => update({ shopPhone: v })} placeholder="0522-XXXXXX" />
                <Field label="Email" value={config.shopEmail} onChange={(v) => update({ shopEmail: v })} placeholder="contact@flexshoes.ma" />
                <Field label="Site web" value={config.shopWebsite} onChange={(v) => update({ shopWebsite: v })} placeholder="www.flexshoes.ma" />
                <Field label="Identifiant fiscal" value={config.taxId} onChange={(v) => update({ taxId: v })} placeholder="12345678" />
              </>
            )}

            {activeTab === 'table' && (
              <>
                <p className="mb-1 text-xs text-fg-subtle">Colonnes du tableau</p>
                <Toggle label="SKU" checked={config.showSku} onChange={(v) => update({ showSku: v })} />
                <Toggle label="Couleur" checked={config.showColor} onChange={(v) => update({ showColor: v })} />
                <Toggle label="Taille" checked={config.showSize} onChange={(v) => update({ showSize: v })} />
                <Toggle label="Code-barres" checked={config.showBarcode} onChange={(v) => update({ showBarcode: v })} />
                <Toggle label="Description" checked={config.showDescription} onChange={(v) => update({ showDescription: v })} />
                <div className="mt-4 border-t border-border pt-4">
                  <Field label="Titre" value={config.headerText} onChange={(v) => update({ headerText: v })} placeholder="FACTURE" />
                </div>
              </>
            )}

            {activeTab === 'layout' && (
              <>
                <Select
                  label="Police"
                  value={config.fontFamily}
                  onChange={(e) => update({ fontFamily: e.target.value })}
                  size="sm"
                >
                  <option value="'Segoe UI', Arial, Helvetica, sans-serif">Segoe UI</option>
                  <option value="Arial, Helvetica, sans-serif">Arial</option>
                  <option value="Verdana, Geneva, sans-serif">Verdana</option>
                  <option value="'Times New Roman', Times, serif">Times New Roman</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Garamond', 'Times New Roman', serif">Garamond</option>
                </Select>
                <Select
                  label="Taille"
                  value={config.fontSize}
                  onChange={(e) => update({ fontSize: e.target.value })}
                  size="sm"
                >
                  <option value="8">8px</option>
                  <option value="9">9px</option>
                  <option value="10">10px</option>
                  <option value="11">11px</option>
                  <option value="12">12px</option>
                </Select>
                <div className="mt-4 border-t border-border pt-4">
                  <span className="mb-2 block text-xs font-medium text-fg-muted">Format papier</span>
                  <div className="flex gap-2">
                    {(['A4', 'A5', 'Letter', 'Legal'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => update({ paperSize: size })}
                        className={cn(
                          'rounded-field border px-3 py-1.5 text-xs font-medium transition-colors duration-fast',
                          config.paperSize === size
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                            : 'border-border text-fg-muted hover:bg-surface-2'
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle label="Paysage" checked={config.landscape} onChange={(v) => update({ landscape: v })} />
                <Toggle label="Bordures du tableau" checked={config.showBorders} onChange={(v) => update({ showBorders: v })} />
              </>
            )}

            {activeTab === 'sections' && (
              <>
                <p className="mb-1 text-xs text-fg-subtle">Sections visibles</p>
                <Toggle label="En-tête" checked={config.showHeader} onChange={(v) => update({ showHeader: v })} />
                <Toggle label="Pied de page" checked={config.showFooter} onChange={(v) => update({ showFooter: v })} />
                <Toggle label="TVA" checked={config.showTax} onChange={(v) => update({ showTax: v })} />
                <Toggle label="Paiement" checked={config.showPaymentInfo} onChange={(v) => update({ showPaymentInfo: v })} />
                <Toggle label="Signatures" checked={config.showSignature} onChange={(v) => update({ showSignature: v })} />
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <Field label="Texte d'en-tête" value={config.headerText} onChange={(v) => update({ headerText: v })} />
                  <Field label="Texte du pied" value={config.footerText} onChange={(v) => update({ footerText: v })} />
                  <Field label="Titre des notes" value={config.notesLabel} onChange={(v) => update({ notesLabel: v })} />
                  <Field label="Notes par défaut" value={config.defaultNotes} onChange={(v) => update({ defaultNotes: v })} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right Panel: Live Preview ──
            Physical invoice output - kept as a light paper island, byte-identical
            in look regardless of app theme. See CONTRACT.md §6. Nothing inside
            <InvoicePreview> is touched by the redesign. */}
        <div className="flex flex-1 justify-center overflow-auto bg-sunken p-6">
          <div
            data-theme="light"
            data-perf="lean"
            className="paper"
            style={{ width: config.paperSize === 'A4' ? '210mm' : config.paperSize === 'Letter' ? '216mm' : config.paperSize === 'Legal' ? '216mm' : '148mm', minHeight: config.landscape ? '210mm' : config.paperSize === 'A4' ? '297mm' : '279mm' }}
          >
            <InvoicePreview config={config} />
          </div>
        </div>
      </div>
    </Page>
  )
}

// ── Luxury B&W Invoice Preview ──
function InvoicePreview({ config }: { config: InvoiceTemplateConfig }) {
  const fs = parseInt(config.fontSize || '10')
  const ff = config.fontFamily || "'Segoe UI', Arial, sans-serif"
  const border = config.showBorders ? '1px solid #d1d5db' : 'none'

  const items = PREVIEW_ITEMS
  const subTotal = items.reduce((s, i) => s + i.unitCost * i.quantity, 0)
  const discount = items.reduce((s, i) => s + i.discountAmount, 0)
  const taxable = subTotal - discount
  const taxAmount = taxable * 0.2
  const total = taxable + taxAmount

  const cols: string[] = ['#', 'Désignation']
  if (config.showSku) cols.push('Réf.')
  if (config.showBarcode) cols.push('Code-barres')
  if (config.showColor) cols.push('Couleur')
  if (config.showSize) cols.push('Taille')
  if (config.showDescription) cols.push('Description')
  cols.push('Qté', 'P.U.', 'Rem.', 'Total')

  return (
    <div style={{ padding: '20mm 18mm', fontFamily: ff, fontSize: fs + 'px', color: '#000', lineHeight: 1.5 }}>
      {/* ── Header ── */}
      {config.showHeader && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 16, borderBottom: '2px solid #000' }}>
            <div>
              {config.logoBase64 && <img src={config.logoBase64} alt="Logo" style={{ maxHeight: 50, maxWidth: 140, objectFit: 'contain', marginBottom: 8, filter: 'grayscale(100%)' }} />}
              <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: 6, textTransform: 'uppercase' }}>{config.shopName || 'FLEX SHOES'}</div>
              {config.shopAddress && <div style={{ color: '#555', marginTop: 4, fontSize: fs - 1 }}>{config.shopAddress}</div>}
              <div style={{ color: '#555', fontSize: fs - 1, marginTop: 2 }}>
                {config.shopPhone && <span>{config.shopPhone}</span>}
                {config.shopPhone && config.shopEmail && <span style={{ margin: '0 6px' }}>·</span>}
                {config.shopEmail && <span>{config.shopEmail}</span>}
              </div>
              {config.taxId && <div style={{ color: '#888', fontSize: fs - 2, marginTop: 4, letterSpacing: 1 }}>IF: {config.taxId}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: 8, textTransform: 'uppercase', color: '#000' }}>{config.headerText || 'FACTURE'}</div>
              <div style={{ marginTop: 12, fontSize: fs + 1, fontWeight: 600, letterSpacing: 1 }}>FAC-2026-0001</div>
              <div style={{ color: '#555', fontSize: fs - 1, marginTop: 2 }}>{new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Client ── */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: fs - 2, textTransform: 'uppercase', letterSpacing: 2, color: '#888', marginBottom: 4, fontWeight: 600 }}>Fournisseur</div>
          <div style={{ fontWeight: 600, fontSize: fs + 1 }}>Fournisseur Exemple SARL</div>
          <div style={{ color: '#555', fontSize: fs - 1 }}>123 Rue du Commerce, Casablanca</div>
          <div style={{ color: '#555', fontSize: fs - 1 }}>Tél: 0522-123456</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: fs - 2, textTransform: 'uppercase', letterSpacing: 2, color: '#888', marginBottom: 4, fontWeight: 600 }}>Client</div>
          <div style={{ fontWeight: 600, fontSize: fs + 1 }}>Client Exemple</div>
          <div style={{ color: '#555', fontSize: fs - 1 }}>456 Avenue Hassan II</div>
          <div style={{ color: '#555', fontSize: fs - 1 }}>Tél: 0661-789012</div>
        </div>
      </div>

      {/* ── Table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr>
            {cols.map((col, i) => (
              <th key={col} style={{
                padding: '10px 8px',
                fontSize: fs - 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 600,
                textAlign: i === 0 ? 'center' : ['Qté', 'Rem.'].includes(col) ? 'center' : ['P.U.', 'Total'].includes(col) ? 'right' : 'left',
                borderBottom: '2px solid #000',
                borderTop: '1px solid #000',
                background: '#f9f9f9',
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: '9px 8px', borderBottom: border, textAlign: 'center', color: '#888' }}>{idx + 1}</td>
              <td style={{ padding: '9px 8px', borderBottom: border, fontWeight: 600 }}>{item.productName}</td>
              {config.showSku && <td style={{ padding: '9px 8px', borderBottom: border, fontFamily: 'monospace', fontSize: fs - 2, color: '#666' }}>{item.sku}</td>}
              {config.showBarcode && <td style={{ padding: '9px 8px', borderBottom: border, fontFamily: 'monospace', fontSize: fs - 2, color: '#666' }}>{item.barcode}</td>}
              {config.showColor && <td style={{ padding: '9px 8px', borderBottom: border, color: '#333' }}>{item.colorName}</td>}
              {config.showSize && <td style={{ padding: '9px 8px', borderBottom: border, color: '#333' }}>{item.sizeValue}</td>}
              {config.showDescription && <td style={{ padding: '9px 8px', borderBottom: border, fontSize: fs - 2, color: '#666', fontStyle: 'italic' }}>{item.description}</td>}
              <td style={{ padding: '9px 8px', borderBottom: border, textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '9px 8px', borderBottom: border, textAlign: 'right' }}>{item.unitCost.toFixed(2)}</td>
              <td style={{ padding: '9px 8px', borderBottom: border, textAlign: 'center', color: item.discountPercent > 0 ? '#000' : '#ccc' }}>{item.discountPercent > 0 ? item.discountPercent + '%' : '—'}</td>
              <td style={{ padding: '9px 8px', borderBottom: border, textAlign: 'right', fontWeight: 600 }}>{item.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ width: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #d1d5db' }}>
            <span style={{ color: '#555' }}>Sous-total</span>
            <span style={{ fontWeight: 500 }}>{subTotal.toFixed(2)} DH</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #d1d5db' }}>
              <span style={{ color: '#555' }}>Remise</span>
              <span style={{ fontWeight: 500 }}>-{discount.toFixed(2)} DH</span>
            </div>
          )}
          {config.showTax && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #d1d5db' }}>
              <span style={{ color: '#555' }}>TVA (20%)</span>
              <span style={{ fontWeight: 500 }}>{taxAmount.toFixed(2)} DH</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '2px solid #000', borderTop: '1px solid #000', marginTop: 4 }}>
            <span style={{ fontSize: fs + 4, fontWeight: 300, letterSpacing: 2, textTransform: 'uppercase' }}>Total</span>
            <span style={{ fontSize: fs + 4, fontWeight: 600 }}>{total.toFixed(2)} DH</span>
          </div>
          {config.showPaymentInfo && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#555' }}>Payé</span>
                <span style={{ fontWeight: 500 }}>0.00 DH</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #d1d5db' }}>
                <span style={{ fontWeight: 600 }}>Reste à payer</span>
                <span style={{ fontWeight: 600 }}>{total.toFixed(2)} DH</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Notes ── */}
      {config.defaultNotes && (
        <div style={{ marginBottom: 24, padding: '10px 14px', borderLeft: '2px solid #000', background: '#fafafa' }}>
          <div style={{ fontSize: fs - 2, textTransform: 'uppercase', letterSpacing: 2, color: '#888', marginBottom: 4, fontWeight: 600 }}>{config.notesLabel || 'Notes'}</div>
          <div style={{ color: '#333', fontSize: fs - 1 }}>{config.defaultNotes}</div>
        </div>
      )}

      {/* ── Signature ── */}
      {config.showSignature && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50 }}>
          <div style={{ textAlign: 'center', width: 180 }}>
            <div style={{ borderTop: '1px solid #000', marginTop: 70, paddingTop: 8 }}>
              <div style={{ fontSize: fs - 2, color: '#555', letterSpacing: 1 }}>Fournisseur</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', width: 180 }}>
            <div style={{ borderTop: '1px solid #000', marginTop: 70, paddingTop: 8 }}>
              <div style={{ fontSize: fs - 2, color: '#555', letterSpacing: 1 }}>Signature & Cachet</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      {config.showFooter && (
        <div style={{ marginTop: 40, paddingTop: 14, borderTop: '1px solid #000', textAlign: 'center' }}>
          <div style={{ fontSize: fs - 1, letterSpacing: 2, textTransform: 'uppercase', color: '#000', fontWeight: 300 }}>{config.footerText || 'Merci pour votre confiance!'}</div>
          {(config.shopPhone || config.shopEmail || config.shopWebsite) && (
            <div style={{ color: '#888', fontSize: fs - 2, marginTop: 6, letterSpacing: 1 }}>
              {config.shopPhone && <span>{config.shopPhone}</span>}
              {config.shopPhone && config.shopEmail && <span style={{ margin: '0 6px' }}>·</span>}
              {config.shopEmail && <span>{config.shopEmail}</span>}
              {(config.shopPhone || config.shopEmail) && config.shopWebsite && <span style={{ margin: '0 6px' }}>·</span>}
              {config.shopWebsite && <span>{config.shopWebsite}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Form Helpers ──
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="sm"
    />
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}
