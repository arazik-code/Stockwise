import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { settingsApi, type InvoiceTemplateConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'

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
      <div className="flex flex-col flex-1">
        <Header title="Design Facture" />
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Header
        title="Design Facture"
        actions={
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <div className="w-[380px] bg-white border-r border-slate-200 overflow-auto flex-shrink-0">
          <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
            {([
              { key: 'shop', label: 'Boutique' },
              { key: 'table', label: 'Tableau' },
              { key: 'layout', label: 'Mise en page' },
              { key: 'sections', label: 'Sections' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-5">
            {activeTab === 'shop' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
                  <div className="flex items-center gap-4">
                    {config.logoBase64 ? (
                      <div className="relative">
                        <img src={config.logoBase64} alt="Logo" className="h-16 w-16 object-contain border border-slate-200 rounded p-1 bg-white" />
                        <button
                          onClick={() => update({ logoBase64: '' })}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-slate-900 text-white rounded-full text-xs flex items-center justify-center hover:bg-slate-700"
                        >×</button>
                      </div>
                    ) : (
                      <div className="h-16 w-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-300">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <button onClick={() => logoInputRef.current?.click()} className="text-sm text-slate-700 hover:text-slate-900 font-medium underline underline-offset-2">
                        {config.logoBase64 ? 'Changer' : 'Ajouter un logo'}
                      </button>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG · Max 2MB</p>
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
                <p className="text-xs text-slate-400 mb-1">Colonnes du tableau</p>
                <Toggle label="SKU" checked={config.showSku} onChange={(v) => update({ showSku: v })} />
                <Toggle label="Couleur" checked={config.showColor} onChange={(v) => update({ showColor: v })} />
                <Toggle label="Taille" checked={config.showSize} onChange={(v) => update({ showSize: v })} />
                <Toggle label="Code-barres" checked={config.showBarcode} onChange={(v) => update({ showBarcode: v })} />
                <Toggle label="Description" checked={config.showDescription} onChange={(v) => update({ showDescription: v })} />
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <Field label="Titre" value={config.headerText} onChange={(v) => update({ headerText: v })} placeholder="FACTURE" />
                </div>
              </>
            )}

            {activeTab === 'layout' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Police</label>
                  <select value={config.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                    <option value="'Segoe UI', Arial, Helvetica, sans-serif">Segoe UI</option>
                    <option value="Arial, Helvetica, sans-serif">Arial</option>
                    <option value="Verdana, Geneva, sans-serif">Verdana</option>
                    <option value="'Times New Roman', Times, serif">Times New Roman</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Garamond', 'Times New Roman', serif">Garamond</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Taille</label>
                  <select value={config.fontSize} onChange={(e) => update({ fontSize: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                    <option value="8">8px</option>
                    <option value="9">9px</option>
                    <option value="10">10px</option>
                    <option value="11">11px</option>
                    <option value="12">12px</option>
                  </select>
                </div>
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Format papier</label>
                  <div className="flex gap-2">
                    {['A4', 'A5', 'Letter', 'Legal'].map((size) => (
                      <button key={size} onClick={() => update({ paperSize: size })} className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${config.paperSize === size ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{size}</button>
                    ))}
                  </div>
                </div>
                <Toggle label="Paysage" checked={config.landscape} onChange={(v) => update({ landscape: v })} />
                <Toggle label="Bordures du tableau" checked={config.showBorders} onChange={(v) => update({ showBorders: v })} />
              </>
            )}

            {activeTab === 'sections' && (
              <>
                <p className="text-xs text-slate-400 mb-1">Sections visibles</p>
                <Toggle label="En-tête" checked={config.showHeader} onChange={(v) => update({ showHeader: v })} />
                <Toggle label="Pied de page" checked={config.showFooter} onChange={(v) => update({ showFooter: v })} />
                <Toggle label="TVA" checked={config.showTax} onChange={(v) => update({ showTax: v })} />
                <Toggle label="Paiement" checked={config.showPaymentInfo} onChange={(v) => update({ showPaymentInfo: v })} />
                <Toggle label="Signatures" checked={config.showSignature} onChange={(v) => update({ showSignature: v })} />
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
                  <Field label="Texte d'en-tête" value={config.headerText} onChange={(v) => update({ headerText: v })} />
                  <Field label="Texte du pied" value={config.footerText} onChange={(v) => update({ footerText: v })} />
                  <Field label="Titre des notes" value={config.notesLabel} onChange={(v) => update({ notesLabel: v })} />
                  <Field label="Notes par défaut" value={config.defaultNotes} onChange={(v) => update({ defaultNotes: v })} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right Panel: Live Preview ── */}
        <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-100">
          <div className="bg-white shadow-2xl" style={{ width: config.paperSize === 'A4' ? '210mm' : config.paperSize === 'Letter' ? '216mm' : config.paperSize === 'Legal' ? '216mm' : '148mm', minHeight: config.landscape ? '210mm' : config.paperSize === 'A4' ? '297mm' : '279mm' }}>
            <InvoicePreview config={config} />
          </div>
        </div>
      </div>
    </div>
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
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-slate-900' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  )
}
