import { useState, useEffect, useCallback } from 'react'
import Header from '../../components/layout/Header'
import OnlineComingSoon from '../../components/online/OnlineComingSoon'
import { showToast } from '../../components/shared/Toast'
import { settingsApi, type ShopifySettingsConfig } from '../../api/clients'
import { shopifyApi, type ShopifyLocation } from '../../api/shopify'
import { ozonApi, type OzonSettingsConfig } from '../../api/ozon'

type SettingsTab = 'shopify' | 'ozon' | 'whatsapp'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'shopify', label: 'Intégration Shopify' },
  { key: 'ozon', label: 'Livraison OzonExpress' },
  { key: 'whatsapp', label: 'Intégration WhatsApp' },
]

const chatIcon = (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

function ShopifySettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState<ShopifySettingsConfig | null>(null)
  const [form, setForm] = useState({
    shopDomain: '',
    accessToken: '',
    clientId: '',
    clientSecret: '',
    apiVersion: '2025-01',
    webhookSecret: '',
    pollingIntervalSeconds: 300,
    locationId: '',
  })
  const [locations, setLocations] = useState<ShopifyLocation[] | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await settingsApi.getShopify()
      setCurrent(data)
      setForm({
        shopDomain: data.shopDomain,
        accessToken: '',
        clientId: '',
        clientSecret: '',
        apiVersion: data.apiVersion,
        webhookSecret: '',
        pollingIntervalSeconds: data.pollingIntervalSeconds,
        locationId: data.locationId,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleFetchLocations = async () => {
    setLocationsLoading(true)
    try {
      const data = await shopifyApi.getLocations()
      setLocations(data)
      if (data.length === 0) {
        showToast("Aucun emplacement trouvé — vérifiez que le domaine et le jeton/Client ID+Secret sont enregistrés et que l'application a été redémarrée", 'error')
      }
    } catch {
      showToast('Erreur — vérifiez que la connexion Shopify est configurée et que l\'application a été redémarrée après enregistrement', 'error')
    } finally {
      setLocationsLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.updateShopify(form)
      showToast('Paramètres Shopify enregistrés — redémarrez l\'application pour les appliquer', 'success')
      await load()
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = !!current?.shopDomain && (current?.accessTokenSet || (current?.clientIdSet && current?.clientSecretSet))

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-xl space-y-5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
            isConfigured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isConfigured ? 'Boutique connectée' : 'Non configuré'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Domaine de la boutique</label>
            <input
              type="text"
              value={form.shopDomain}
              onChange={(e) => setForm({ ...form, shopDomain: e.target.value })}
              placeholder="votre-boutique.myshopify.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Jeton d'accès API classique (shpat_...) {current?.accessTokenSet && <span className="text-slate-400 font-normal">— actuel: {current.accessTokenMasked}</span>}
            </label>
            <input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder={current?.accessTokenSet ? 'Laisser vide pour conserver le jeton actuel' : 'Laisser vide si vous utilisez Client ID + Secret ci-dessous'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Si vous avez un jeton permanent shpat_... obtenu via Admin → Paramètres → Applications → Développer des applications, mettez-le ici. Sinon, laissez vide et utilisez Client ID + Secret ci-dessous (obtenus depuis le Dev Dashboard Shopify) — l'application échangera automatiquement ces identifiants contre un jeton, renouvelé toutes les 24h.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Client ID {current?.clientIdSet && <span className="text-slate-400 font-normal">— actuel: {current.clientIdMasked}</span>}
              </label>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder={current?.clientIdSet ? 'Laisser vide pour conserver' : 'Client ID du Dev Dashboard'}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Client Secret {current?.clientSecretSet && <span className="text-slate-400 font-normal">— actuel: {current.clientSecretMasked}</span>}
              </label>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder={current?.clientSecretSet ? 'Laisser vide pour conserver' : 'shpss_...'}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Secret de webhook {current?.webhookSecretSet && <span className="text-slate-400 font-normal">— actuel: {current.webhookSecretMasked}</span>}
            </label>
            <input
              type="password"
              value={form.webhookSecret}
              onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
              placeholder={current?.webhookSecretSet ? 'Laisser vide pour conserver le secret actuel' : 'Secret HMAC des webhooks (souvent = Client Secret)'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ID de l'emplacement (Location ID)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.locationId}
                  onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                  placeholder="ex: 65984856123"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Version API</label>
              <input
                type="text"
                value={form.apiVersion}
                onChange={(e) => setForm({ ...form, apiVersion: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {isConfigured && (
            <div className="bg-slate-50 rounded-md p-3">
              <button
                type="button"
                onClick={handleFetchLocations}
                disabled={locationsLoading}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
              >
                {locationsLoading ? 'Recherche…' : '↻ Récupérer la liste des emplacements depuis Shopify'}
              </button>
              {locations && locations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {locations.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setForm({ ...form, locationId: String(l.id) })}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-white flex justify-between items-center"
                    >
                      <span>{l.name}{l.city ? ` — ${l.city}` : ''}{!l.active && ' (inactif)'}</span>
                      <span className="font-mono text-slate-400">{l.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Intervalle de synchronisation (secondes)</label>
            <input
              type="number"
              min={60}
              value={form.pollingIntervalSeconds}
              onChange={(e) => setForm({ ...form, pollingIntervalSeconds: Number(e.target.value) })}
              className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saving || !form.shopDomain}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Le jeton d'accès et le secret de webhook s'obtiennent depuis Shopify Admin → Paramètres → Applications et canaux de vente → Développer des applications.
          Après enregistrement, redémarrez l'application pour que les nouveaux identifiants soient pris en compte par le service de synchronisation.
        </p>
      </div>
    </div>
  )
}

function OzonSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState<OzonSettingsConfig | null>(null)
  const [form, setForm] = useState({ customerId: '', apiKey: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ozonApi.getSettings()
      setCurrent(data)
      setForm({ customerId: data.customerId, apiKey: '' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await ozonApi.updateSettings({ customerId: form.customerId, apiKey: form.apiKey || undefined })
      showToast("Paramètres OzonExpress enregistrés — redémarrez l'application pour les appliquer", 'success')
      await load()
    } catch {
      showToast("Erreur lors de l'enregistrement", 'error')
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = !!current?.customerId && current?.apiKeySet

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-xl space-y-5">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
          isConfigured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {isConfigured ? 'OzonExpress connecté' : 'Non configuré'}
        </span>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer ID (Votre ID)</label>
            <input
              type="text"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              placeholder="ex: 23563"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Clé API {current?.apiKeySet && <span className="text-slate-400 font-normal">— actuelle: {current.apiKeyMasked}</span>}
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={current?.apiKeySet ? 'Laisser vide pour conserver la clé actuelle' : 'Votre clé API OzonExpress'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Trouvez votre clé API dans OzonExpress → section « Compte » → « Generate your API key ».
            </p>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saving || !form.customerId}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Après enregistrement, redémarrez l'application pour activer l'intégration, puis synchronisez la liste des villes
          depuis la section Livraison.
        </p>
      </div>
    </div>
  )
}

export default function OnlineSettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('shopify')

  return (
    <div className="flex flex-col flex-1">
      <Header title="Paramètres — Boutique en ligne" />
      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'shopify' ? (
        <ShopifySettings />
      ) : tab === 'ozon' ? (
        <OzonSettings />
      ) : (
        <OnlineComingSoon
          title="Connexion WhatsApp Business"
          description="Les commandes WhatsApp sont saisies manuellement par le personnel — aucune intégration API n'est nécessaire pour le moment."
          icon={chatIcon}
          channels={['whatsapp']}
          features={[
            'Connexion au compte WhatsApp Business (si besoin futur)',
            'Modèles de message pour confirmations de commande',
            'Notifications automatiques de nouvelle commande',
          ]}
        />
      )}
    </div>
  )
}
