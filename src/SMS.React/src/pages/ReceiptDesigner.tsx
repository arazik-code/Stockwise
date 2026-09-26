import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff, Save, X } from 'lucide-react'
import { settingsApi, type ReceiptTemplateConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'
import { invalidateReceiptTemplateCache } from '../utils/printReceipt'
import { Button, Input, Page, Select, Switch, Tabs, Textarea } from '../components/ui'

const DEFAULT_TEMPLATE: ReceiptTemplateConfig = {
  shopName: 'MY STORE',
  shopTagline: 'Thank you for shopping with us',
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
  { name: 'Signature Eau de Parfum', color: 'Standard', size: '50 ml', sku: 'DEMO-006-01-01', quantity: 1, unitPrice: 399.00, lineTotal: 399.00 },
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
      <Page section="receiptDesign" title="Design Recu" className="local-receipt-designer" bare fill>
        <div className="flex flex-1 items-center justify-center text-sm text-fg-subtle">{t('common.loading')}</div>
      </Page>
    )
  }

  return (
    <Page
      section="receiptDesign"
      className="local-receipt-designer"
      title="Design Recu"
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
              { value: 'content', label: 'Contenu' },
              { value: 'style', label: 'Style' },
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
                <Field label="Sous-titre" value={config.shopTagline} onChange={(v) => update({ shopTagline: v })} placeholder="Thank you for shopping with us" />
                <Field label="Adresse" value={config.shopAddress} onChange={(v) => update({ shopAddress: v })} placeholder="123 Rue Principale, Casablanca" />
                <Field label="Telephone" value={config.shopPhone} onChange={(v) => update({ shopPhone: v })} placeholder="0522-XXXXXX" />
                <Field label="Site web" value={config.shopWebsite} onChange={(v) => update({ shopWebsite: v })} placeholder="www.flexshoes.ma" />
              </>
            )}

            {activeTab === 'content' && (
              <>
                <p className="mb-1 text-xs text-fg-subtle">Sections du ticket</p>
                <Toggle label="Logo en haut" checked={!!config.logoBase64} onChange={() => {}} disabled />
                <Toggle label="Numero de ticket" checked={config.showTicketNumber} onChange={(v) => update({ showTicketNumber: v })} />
                <Toggle label="Date et heure" checked={config.showDate} onChange={(v) => update({ showDate: v })} />
                <Toggle label="Vendeur" checked={config.showCashier} onChange={(v) => update({ showCashier: v })} />
                <Toggle label="Details variantes (couleur/taille)" checked={config.showVariantDetails} onChange={(v) => update({ showVariantDetails: v })} />
                <Toggle label="SKU" checked={config.showSku} onChange={(v) => update({ showSku: v })} />
                <Toggle label="Prix unitaire" checked={config.showUnitPrice} onChange={(v) => update({ showUnitPrice: v })} />
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-1 text-xs text-fg-subtle">Totaux</p>
                  <Toggle label="Sous-total" checked={config.showSubtotal} onChange={(v) => update({ showSubtotal: v })} />
                  <Toggle label="TVA" checked={config.showTax} onChange={(v) => update({ showTax: v })} />
                  <Toggle label="Remise fidelite" checked={config.showDiscount} onChange={(v) => update({ showDiscount: v })} />
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-1 text-xs text-fg-subtle">Bas de ticket</p>
                  <Toggle label="Mode de paiement" checked={config.showPaymentMethod} onChange={(v) => update({ showPaymentMethod: v })} />
                  <Toggle label="Infos fidelite" checked={config.showLoyaltyInfo} onChange={(v) => update({ showLoyaltyInfo: v })} />
                  <Toggle label="QR Code client" checked={config.showQrCode} onChange={(v) => update({ showQrCode: v })} />
                </div>
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <Field label="Texte d'en-tete" value={config.headerText} onChange={(v) => update({ headerText: v })} placeholder="(optionnel)" />
                  <Field label="Texte du pied" value={config.footerText} onChange={(v) => update({ footerText: v })} placeholder="Merci et a bientot!" />
                  <Textarea
                    label="Conditions / Mentions legales"
                    value={config.termsText}
                    onChange={(e) => update({ termsText: e.target.value })}
                    placeholder="Delai d'echange : 15 jours&#10;Emballage et ticket de caisse obligatoire&#10;Articles Soldes ni repris"
                    rows={4}
                    hint="Un ligne par condition (ENTREE pour nouvelle ligne)"
                  />
                </div>
              </>
            )}

            {activeTab === 'style' && (
              <>
                <Select
                  label="Police"
                  value={config.fontFamily}
                  onChange={(e) => update({ fontFamily: e.target.value })}
                  size="sm"
                >
                  <option value="'Consolas', 'Courier New', monospace">Consolas (defaut)</option>
                  <option value="'Courier New', Courier, monospace">Courier New</option>
                  <option value="'Lucida Console', Monaco, monospace">Lucida Console</option>
                  <option value="monospace">System Mono</option>
                </Select>
                <p className="mt-2 text-xs text-fg-subtle">Les recus utilisent toujours une police a largeur fixe pour l'alignement sur imprimante thermique 80mm.</p>
              </>
            )}
          </div>
        </div>

        {/* ── Right Panel: Live Preview ──
            Physical receipt output - kept as a light paper island, byte-identical
            in look regardless of app theme. See CONTRACT.md §6. Nothing inside
            <ReceiptPreview> is touched by the redesign. */}
        <div className="flex flex-1 justify-center overflow-auto bg-sunken p-6">
          <div
            data-theme="light"
            data-perf="lean"
            className="paper overflow-hidden"
            style={{ width: '80mm', minHeight: '200mm' }}
          >
            <ReceiptPreview config={config} />
          </div>
        </div>
      </div>
    </Page>
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
        {config.shopName || 'MY STORE'}
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
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="sm"
    />
  )
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
  )
}
