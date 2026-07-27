import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { settingsApi, type ReceiptTemplateConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'
import { invalidateReceiptTemplateCache } from '../utils/printReceipt'

const DEFAULT_TEMPLATE: ReceiptTemplateConfig = {
  shopName: 'FLEX SHOES',
  shopTagline: 'Chaussures & Plus',
  shopAddress: '',
  shopPhone: '',
  shopWebsite: 'www.flexshoes.ma',
  logoBase64: '',
  showTicketNumber: true,
  showDate: true,
  showCashier: true,
  showVariantDetails: true,
  showSku: false,
  showUnitPrice: true,
  showSubtotal: true,
  showTax: true,
  showDiscount: true,
  showPaymentMethod: true,
  showLoyaltyInfo: true,
  showQrCode: true,
  headerText: '',
  footerText: 'Merci et a bientot!',
  termsText: "Delai d'echange : 15 jours\nEmballage et ticket de caisse obligatoire / Etat original\nArticles Soldes et Vestes en cuir ni repris",
  fontFamily: "'Consolas', 'Courier New', monospace",
}

const PREVIEW_ITEMS = [
  { name: 'Chaussures Sport Elite', color: 'Noir', size: '42', sku: 'PRD-001', quantity: 2, unitPrice: 299.00, lineTotal: 598.00 },
  { name: 'Sneakers Classic Premium', color: 'Blanc', size: '40', sku: 'PRD-002', quantity: 1, unitPrice: 199.00, lineTotal: 199.00 },
]

function fmt(v: number) { return v.toFixed(2) + ' DH' }

export default function ReceiptDesignerPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ReceiptTemplateConfig>(DEFAULT_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'shop' | 'content' | 'style'>('shop')
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    settingsApi.getReceiptTemplate()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const update = useCallback((patch: Partial<ReceiptTemplateConfig>) => {
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
      await settingsApi.updateReceiptTemplate(config)
      invalidateReceiptTemplateCache()
      showToast('Modele recu enregistre', 'success')
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error')
    } finally {
      setSaving(false)
    }
  }, [config])

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Design Recu" />
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Header
        title="Design Recu"
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
              { key: 'content', label: 'Contenu' },
              { key: 'style', label: 'Style' },
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
                <Field label="Sous-titre" value={config.shopTagline} onChange={(v) => update({ shopTagline: v })} placeholder="Chaussures & Plus" />
                <Field label="Adresse" value={config.shopAddress} onChange={(v) => update({ shopAddress: v })} placeholder="123 Rue Principale, Casablanca" />
                <Field label="Telephone" value={config.shopPhone} onChange={(v) => update({ shopPhone: v })} placeholder="0522-XXXXXX" />
                <Field label="Site web" value={config.shopWebsite} onChange={(v) => update({ shopWebsite: v })} placeholder="www.flexshoes.ma" />
              </>
            )}

            {activeTab === 'content' && (
              <>
                <p className="text-xs text-slate-400 mb-1">Sections du ticket</p>
                <Toggle label="Logo en haut" checked={!!config.logoBase64} onChange={() => {}} disabled />
                <Toggle label="Numero de ticket" checked={config.showTicketNumber} onChange={(v) => update({ showTicketNumber: v })} />
                <Toggle label="Date et heure" checked={config.showDate} onChange={(v) => update({ showDate: v })} />
                <Toggle label="Vendeur" checked={config.showCashier} onChange={(v) => update({ showCashier: v })} />
                <Toggle label="Details variantes (couleur/taille)" checked={config.showVariantDetails} onChange={(v) => update({ showVariantDetails: v })} />
                <Toggle label="SKU" checked={config.showSku} onChange={(v) => update({ showSku: v })} />
                <Toggle label="Prix unitaire" checked={config.showUnitPrice} onChange={(v) => update({ showUnitPrice: v })} />
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <p className="text-xs text-slate-400 mb-1">Totaux</p>
                  <Toggle label="Sous-total" checked={config.showSubtotal} onChange={(v) => update({ showSubtotal: v })} />
                  <Toggle label="TVA" checked={config.showTax} onChange={(v) => update({ showTax: v })} />
                  <Toggle label="Remise fidelite" checked={config.showDiscount} onChange={(v) => update({ showDiscount: v })} />
                </div>
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <p className="text-xs text-slate-400 mb-1">Bas de ticket</p>
                  <Toggle label="Mode de paiement" checked={config.showPaymentMethod} onChange={(v) => update({ showPaymentMethod: v })} />
                  <Toggle label="Infos fidelite" checked={config.showLoyaltyInfo} onChange={(v) => update({ showLoyaltyInfo: v })} />
                  <Toggle label="QR Code client" checked={config.showQrCode} onChange={(v) => update({ showQrCode: v })} />
                </div>
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
                  <Field label="Texte d'en-tete" value={config.headerText} onChange={(v) => update({ headerText: v })} placeholder="(optionnel)" />
                  <Field label="Texte du pied" value={config.footerText} onChange={(v) => update({ footerText: v })} placeholder="Merci et a bientot!" />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Conditions / Mentions legales</label>
                    <textarea
                      value={config.termsText}
                      onChange={(e) => update({ termsText: e.target.value })}
                      placeholder="Delai d'echange : 15 jours&#10;Emballage et ticket de caisse obligatoire&#10;Articles Soldes ni repris"
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-slate-400 mt-1">Un ligne par condition (ENTREE pour nouvelle ligne)</p>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'style' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Police</label>
                  <select value={config.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                    <option value="'Consolas', 'Courier New', monospace">Consolas (defaut)</option>
                    <option value="'Courier New', Courier, monospace">Courier New</option>
                    <option value="'Lucida Console', Monaco, monospace">Lucida Console</option>
                    <option value="monospace">System Mono</option>
                  </select>
                </div>
                <p className="text-xs text-slate-400 mt-2">Les recus utilisent toujours une police a largeur fixe pour l'alignement sur imprimante thermique 80mm.</p>
              </>
            )}
          </div>
        </div>

        {/* ── Right Panel: Live Preview ── */}
        <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-100">
          <div className="bg-white shadow-2xl rounded-lg overflow-hidden" style={{ width: '80mm', minHeight: '200mm' }}>
            <ReceiptPreview config={config} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Live Receipt Preview (HTML-based) ──
function ReceiptPreview({ config }: { config: ReceiptTemplateConfig }) {
  const ff = config.fontFamily || "'Consolas', 'Courier New', monospace"
  const items = PREVIEW_ITEMS
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const taxRate = 0.2
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount
  const loyaltyDiscount = 15.00

  return (
    <div style={{ padding: '3mm 4mm', fontFamily: ff, fontSize: '13px', fontWeight: 'bold' as const, lineHeight: 1.3, color: '#000' }}>
      {/* ── Header Badge ── */}
      {config.headerText && (
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 'bold' as const, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#000', marginBottom: 4 }}>
          {config.headerText}
        </div>
      )}

      {/* ── Logo ── */}
      {config.logoBase64 && (
        <div style={{ textAlign: 'center', margin: '6px 0' }}>
          <img src={config.logoBase64} alt="Logo" style={{ maxHeight: 48, maxWidth: 68, objectFit: 'contain', filter: 'grayscale(100%) contrast(1.3)' }} />
        </div>
      )}

      {/* ── Shop Name ── */}
      <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 'bold', letterSpacing: 5, textTransform: 'uppercase' as const, margin: '2px 0' }}>
        {config.shopName || 'FLEX SHOES'}
      </div>
      {config.shopTagline && (
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 'bold' as const, letterSpacing: 2, color: '#000', marginBottom: 2 }}>
          {config.shopTagline}
        </div>
      )}
      {config.shopAddress && (
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 'bold' as const, color: '#000' }}>{config.shopAddress}</div>
      )}
      {config.shopPhone && (
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 'bold' as const, color: '#000' }}>{config.shopPhone}</div>
      )}
      {config.shopWebsite && (
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 'bold' as const, color: '#000', letterSpacing: 1 }}>{config.shopWebsite}</div>
      )}

      {/* ── Ticket Info ── */}
      <div style={{ borderTop: '2px dashed #000', marginTop: 6, paddingTop: 5 }}>
        {config.showTicketNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, padding: '1px 0' }}>
            <span style={{ color: '#000', fontWeight: 'bold' as const }}>N° Ticket</span>
            <span style={{ fontWeight: 'bold' }}>REC-2026-0001</span>
          </div>
        )}
        {config.showDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, padding: '1px 0' }}>
            <span style={{ color: '#000', fontWeight: 'bold' as const }}>Date</span>
            <span style={{ fontWeight: 'bold' }}>{new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
        {config.showCashier && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, padding: '1px 0' }}>
            <span style={{ color: '#000', fontWeight: 'bold' as const }}>Vendeur</span>
            <span style={{ fontWeight: 'bold' }}>Ahmed</span>
          </div>
        )}
      </div>

      {/* ── Items ── */}
      <div style={{ borderTop: '2px dashed #000', marginTop: 6, paddingTop: 5 }}>
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 'bold' as const, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#000', marginBottom: 4 }}>
          ARTICLES
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ padding: '4px 0', borderBottom: '1px dashed #000' }}>
            <div style={{ fontWeight: 'bold', fontSize: 13, lineHeight: 1.2 }}>{item.name}</div>
            {config.showVariantDetails && (
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#000', marginTop: 1 }}>
                {[item.color, item.size].filter(Boolean).join(' / ')}
              </div>
            )}
            {config.showSku && (
              <div style={{ fontSize: 10, fontWeight: 'bold' as const, color: '#000', marginTop: 1 }}>{item.sku}</div>
            )}
            {config.showUnitPrice ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, marginTop: 1 }}>
                <span>{item.quantity} × {fmt(item.unitPrice)}</span>
                <span style={{ fontWeight: 'bold' }}>{fmt(item.lineTotal)}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, marginTop: 1 }}>
                <span>{item.quantity} × {fmt(item.lineTotal / item.quantity)}</span>
                <span style={{ fontWeight: 'bold' }}>{fmt(item.lineTotal)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Totals ── */}
      <div style={{ borderTop: '2px dashed #000', marginTop: 6, paddingTop: 5 }}>
        {config.showSubtotal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, padding: '2px 0' }}>
            <span>Sous-total</span>
            <span>{fmt(subtotal)}</span>
          </div>
        )}
        {config.showDiscount && loyaltyDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, padding: '2px 0', color: '#000' }}>
            <span>Remise fidelite</span>
            <span>-{fmt(loyaltyDiscount)}</span>
          </div>
        )}
        {config.showTax && taxAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' as const, padding: '2px 0' }}>
            <span>TVA ({(taxRate * 100).toFixed(0)}%)</span>
            <span>{fmt(taxAmount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', borderBottom: '2px solid #000', margin: '3px 0', padding: '5px 0', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>
          <span>TOTAL</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      {/* ── Payment ── */}
      {config.showPaymentMethod && (
        <div style={{ borderTop: '2px dashed #000', marginTop: 6, paddingTop: 5 }}>
          <div style={{ display: 'inline-block', padding: '3px 10px', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, border: '2px solid #000', background: '#000', color: '#fff', textAlign: 'center', marginBottom: 3 }}>
            CARTE
          </div>
        </div>
      )}

      {/* ── Loyalty ── */}
      {config.showLoyaltyInfo && (
        <div style={{ borderTop: '2px dashed #000', marginTop: 6, paddingTop: 5 }}>
          <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 2 }}>Karim B.</div>
          <div style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>+15 points gagnes</div>
        </div>
      )}

      {/* ── QR Code ── */}
      {config.showQrCode && (
        <div style={{ textAlign: 'center', marginTop: 8, paddingTop: 6, borderTop: '2px dashed #000' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('SMS-DEMO-CLIENT')}&margin=4`}
            alt="QR Code"
            style={{ width: 90, height: 90, imageRendering: 'pixelated' }}
          />
          <div style={{ fontSize: 10, fontWeight: 'bold' as const, color: '#000', marginTop: 2, letterSpacing: 1 }}>SMS-DEMO-CLIENT</div>
        </div>
      )}

      {/* ── Footer ── */}
      {config.footerText && (
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 'bold' as const, color: '#000', marginTop: 8, letterSpacing: 1 }}>
          {config.footerText}
        </div>
      )}

      {/* ── Terms ── */}
      {config.termsText && (
        <div style={{ borderTop: '1px solid #000', marginTop: 8, paddingTop: 5 }}>
          {config.termsText.split('\n').filter(l => l.trim()).map((line, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 'bold' as const, color: '#000', lineHeight: 1.3, padding: '1px 0' }}>
              {line.trim()}
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '2px dashed #000', marginTop: 6 }} />
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

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between py-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} group`}>
      <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
      <button type="button" onClick={() => !disabled && onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-slate-900' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  )
}
