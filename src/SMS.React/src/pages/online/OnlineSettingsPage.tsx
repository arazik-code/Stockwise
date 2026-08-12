import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, RotateCw } from 'lucide-react'
import OnlineComingSoon from '../../components/online/OnlineComingSoon'
import { showToast } from '../../components/shared/Toast'
import { settingsApi, type ShopifySettingsConfig } from '../../api/clients'
import { shopifyApi, type ShopifyLocation } from '../../api/shopify'
import { ozonApi, type OzonSettingsConfig } from '../../api/ozon'
import {
  Badge, Button, Card, CardFooter, Input, Page, Skeleton, Tabs,
} from '../../components/ui'

type SettingsTab = 'shopify' | 'ozon' | 'whatsapp'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'shopify', label: 'Intégration Shopify' },
  { key: 'ozon', label: 'Livraison OzonExpress' },
  { key: 'whatsapp', label: 'Intégration WhatsApp' },
]

function ConfiguredBadge({ configured, connectedLabel }: { configured: boolean; connectedLabel: string }) {
  return (
    <Badge tone={configured ? 'positive' : 'caution'} size="sm" dot>
      {configured ? connectedLabel : 'Non configuré'}
    </Badge>
  )
}

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
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton variant="text" width="30%" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ConfiguredBadge configured={isConfigured} connectedLabel="Boutique connectée" />

      <Card className="space-y-4">
        <Input
          label="Domaine de la boutique"
          value={form.shopDomain}
          onChange={(e) => setForm({ ...form, shopDomain: e.target.value })}
          placeholder="votre-boutique.myshopify.com"
        />

        <div>
          <Input
            label={
              <>
                Jeton d'accès API classique (shpat_...)
                {current?.accessTokenSet && <span className="ml-1 font-normal text-fg-subtle">— actuel: {current.accessTokenMasked}</span>}
              </>
            }
            type="password"
            value={form.accessToken}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            placeholder={current?.accessTokenSet ? 'Laisser vide pour conserver le jeton actuel' : 'Laisser vide si vous utilisez Client ID + Secret ci-dessous'}
          />
          <p className="mt-1 text-[11px] text-fg-subtle">
            Si vous avez un jeton permanent shpat_... obtenu via Admin → Paramètres → Applications → Développer des
            applications, mettez-le ici. Sinon, laissez vide et utilisez Client ID + Secret ci-dessous (obtenus depuis
            le Dev Dashboard Shopify) — l'application échangera automatiquement ces identifiants contre un jeton,
            renouvelé toutes les 24h.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={
              <>
                Client ID
                {current?.clientIdSet && <span className="ml-1 font-normal text-fg-subtle">— actuel: {current.clientIdMasked}</span>}
              </>
            }
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            placeholder={current?.clientIdSet ? 'Laisser vide pour conserver' : 'Client ID du Dev Dashboard'}
          />
          <Input
            label={
              <>
                Client Secret
                {current?.clientSecretSet && <span className="ml-1 font-normal text-fg-subtle">— actuel: {current.clientSecretMasked}</span>}
              </>
            }
            type="password"
            value={form.clientSecret}
            onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
            placeholder={current?.clientSecretSet ? 'Laisser vide pour conserver' : 'shpss_...'}
          />
        </div>

        <Input
          label={
            <>
              Secret de webhook
              {current?.webhookSecretSet && <span className="ml-1 font-normal text-fg-subtle">— actuel: {current.webhookSecretMasked}</span>}
            </>
          }
          type="password"
          value={form.webhookSecret}
          onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
          placeholder={current?.webhookSecretSet ? 'Laisser vide pour conserver le secret actuel' : 'Secret HMAC des webhooks (souvent = Client Secret)'}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ID de l'emplacement (Location ID)"
            value={form.locationId}
            onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            placeholder="ex: 65984856123"
          />
          <Input
            label="Version API"
            value={form.apiVersion}
            onChange={(e) => setForm({ ...form, apiVersion: e.target.value })}
          />
        </div>

        {isConfigured && (
          <div className="rounded-field bg-sunken p-3">
            <Button
              variant="ghost"
              size="xs"
              icon={<RotateCw className="h-3 w-3" />}
              loading={locationsLoading}
              onClick={handleFetchLocations}
            >
              Récupérer la liste des emplacements depuis Shopify
            </Button>
            {locations && locations.length > 0 && (
              <div className="mt-2 space-y-1">
                {locations.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setForm({ ...form, locationId: String(l.id) })}
                    className="flex w-full items-center justify-between rounded-inset px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface"
                  >
                    <span className="text-fg-muted">{l.name}{l.city ? ` — ${l.city}` : ''}{!l.active && ' (inactif)'}</span>
                    <span className="num font-mono text-fg-subtle">{l.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Input
          label="Intervalle de synchronisation (secondes)"
          type="number"
          min={60}
          value={form.pollingIntervalSeconds}
          onChange={(e) => setForm({ ...form, pollingIntervalSeconds: Number(e.target.value) })}
          wrapperClassName="w-40"
        />

        <CardFooter>
          <Button loading={saving} disabled={!form.shopDomain} onClick={handleSave}>
            Enregistrer
          </Button>
        </CardFooter>
      </Card>

      <p className="text-xs text-fg-subtle">
        Le jeton d'accès et le secret de webhook s'obtiennent depuis Shopify Admin → Paramètres → Applications et
        canaux de vente → Développer des applications. Après enregistrement, redémarrez l'application pour que les
        nouveaux identifiants soient pris en compte par le service de synchronisation.
      </p>
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
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton variant="text" width="30%" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ConfiguredBadge configured={isConfigured} connectedLabel="OzonExpress connecté" />

      <Card className="space-y-4">
        <Input
          label="Customer ID (Votre ID)"
          value={form.customerId}
          onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          placeholder="ex: 23563"
        />
        <div>
          <Input
            label={
              <>
                Clé API
                {current?.apiKeySet && <span className="ml-1 font-normal text-fg-subtle">— actuelle: {current.apiKeyMasked}</span>}
              </>
            }
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={current?.apiKeySet ? 'Laisser vide pour conserver la clé actuelle' : 'Votre clé API OzonExpress'}
          />
          <p className="mt-1 text-[11px] text-fg-subtle">
            Trouvez votre clé API dans OzonExpress → section « Compte » → « Generate your API key ».
          </p>
        </div>
        <CardFooter>
          <Button loading={saving} disabled={!form.customerId} onClick={handleSave}>
            Enregistrer
          </Button>
        </CardFooter>
      </Card>

      <p className="text-xs text-fg-subtle">
        Après enregistrement, redémarrez l'application pour activer l'intégration, puis synchronisez la liste des
        villes depuis la section Livraison.
      </p>
    </div>
  )
}

export default function OnlineSettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('shopify')

  return (
    <Page section="onlineSettings" title="Paramètres — Boutique en ligne">
      <div className="space-y-6">
        <Tabs
          variant="segmented"
          layoutGroupId="online-settings-tabs"
          value={tab}
          onChange={(v) => setTab(v as SettingsTab)}
          items={TABS.map((t) => ({ value: t.key, label: t.label }))}
        />

        {tab === 'shopify' ? (
          <ShopifySettings />
        ) : tab === 'ozon' ? (
          <OzonSettings />
        ) : (
          <OnlineComingSoon
            title="Connexion WhatsApp Business"
            description="Les commandes WhatsApp sont saisies manuellement par le personnel — aucune intégration API n'est nécessaire pour le moment."
            icon={<MessageCircle className="h-8 w-8" />}
            channels={['whatsapp']}
            features={[
              'Connexion au compte WhatsApp Business (si besoin futur)',
              'Modèles de message pour confirmations de commande',
              'Notifications automatiques de nouvelle commande',
            ]}
          />
        )}
      </div>
    </Page>
  )
}
