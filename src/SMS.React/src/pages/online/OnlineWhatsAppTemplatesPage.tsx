import { useState, useEffect, useCallback } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { showToast } from '../../components/shared/Toast'
import { whatsappTemplatesApi, type WhatsAppTemplate } from '../../api/whatsappTemplates'
import { renderWhatsAppTemplate } from '../../utils/whatsapp'
import {
  Button, EmptyState, Input, Page, Skeleton, Textarea, cn,
} from '../../components/ui'

const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: '{clientName}', label: 'Nom du client' },
  { token: '{orderNumber}', label: 'N° de commande' },
  { token: '{items}', label: 'Liste des articles' },
  { token: '{total}', label: 'Montant total' },
  { token: '{address}', label: 'Adresse de livraison' },
  { token: '{storeName}', label: 'Nom de la boutique' },
]

const PREVIEW_ORDER = {
  orderNumber: 'SHP-20260728-042',
  customerName: 'Ayoub El Fassi',
  items: [
    { productName: 'Basket En Cuir Noir', sizeValue: '42', colorName: 'Noir', quantity: 1 },
    { productName: 'Basket En Cuir Beige', sizeValue: '40', colorName: 'Beige', quantity: 2 },
  ],
  total: 897,
  city: 'Casablanca',
  addressLine: '12 Rue des Fleurs',
}

export default function OnlineWhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<WhatsAppTemplate | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await whatsappTemplatesApi.getAll()
      setTemplates(data)
      if (data.length > 0 && !selected) {
        const first = data.find((t) => t.isDefault) ?? data[0]
        setSelected(first)
        setName(first.name)
        setBody(first.body)
      }
    } catch {
      showToast('Erreur lors du chargement des modèles', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const openTemplate = (t: WhatsAppTemplate) => {
    setSelected(t)
    setName(t.name)
    setBody(t.body)
    setIsNew(false)
  }

  const openNew = () => {
    setSelected(null)
    setName('')
    setBody('')
    setIsNew(true)
  }

  const insertPlaceholder = (token: string) => {
    setBody((b) => b + token)
  }

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) {
      showToast('Le nom et le message sont requis', 'error')
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        const created = await whatsappTemplatesApi.create({ name, body })
        showToast('Modèle créé', 'success')
        setIsNew(false)
        setSelected(created)
        setTemplates((prev) => [...prev, created])
      } else if (selected) {
        const updated = await whatsappTemplatesApi.update(selected.id, { name, body })
        showToast('Modèle enregistré', 'success')
        setSelected(updated)
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? 'Erreur lors de l\'enregistrement', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Supprimer le modèle « ${selected.name} » ?`)) return
    try {
      await whatsappTemplatesApi.delete(selected.id)
      showToast('Modèle supprimé', 'success')
      setTemplates((prev) => prev.filter((t) => t.id !== selected.id))
      setSelected(null)
      setName('')
      setBody('')
    } catch {
      showToast('Erreur lors de la suppression', 'error')
    }
  }

  const handleSetDefault = async () => {
    if (!selected) return
    try {
      const updated = await whatsappTemplatesApi.setDefault(selected.id)
      showToast('Modèle défini par défaut', 'success')
      setTemplates((prev) => prev.map((t) => ({ ...t, isDefault: t.id === updated.id })))
      setSelected(updated)
    } catch {
      showToast('Erreur', 'error')
    }
  }

  const preview = body ? renderWhatsAppTemplate(body, PREVIEW_ORDER) : ''

  return (
    <Page
      section="onlineWhatsApp"
      title="Modèles WhatsApp"
      bare
      fill
      actions={
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openNew}>
          Nouveau modèle
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1">
        {/* Template list */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="text" />)}
            </div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center text-sm text-fg-subtle">Aucun modèle</div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => openTemplate(t)}
                className={cn(
                  'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-2',
                  selected?.id === t.id && !isNew && 'bg-[var(--accent-soft)] shadow-[inset_2px_0_0_var(--accent)]'
                )}
              >
                <p className="flex items-center gap-1 truncate text-sm font-medium text-fg">
                  {t.isDefault && <Star className="h-3 w-3 fill-[var(--caution)] text-[var(--caution)]" />}
                  {t.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-fg-subtle">{t.body.replace(/\n/g, ' ')}</p>
              </button>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected && !isNew ? (
            <EmptyState title="Aucun modèle sélectionné" description="Sélectionnez un modèle ou créez-en un nouveau." compact />
          ) : (
            <div className="max-w-2xl space-y-4">
              <Input label="Nom du modèle" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Confirmation express" />

              <Textarea
                label="Message"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="font-mono"
              />

              <div>
                <p className="mb-1.5 text-xs font-medium text-fg-subtle">Insérer une variable</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.token}
                      onClick={() => insertPlaceholder(p.token)}
                      title={p.label}
                      className="rounded-inset bg-sunken px-2 py-1 font-mono text-xs text-fg-muted transition-colors hover:bg-surface-3"
                    >
                      {p.token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} loading={saving}>
                  {isNew ? 'Créer le modèle' : 'Enregistrer'}
                </Button>
                {!isNew && selected && (
                  <>
                    {!selected.isDefault && (
                      <Button variant="outline" onClick={handleSetDefault}>
                        Définir par défaut
                      </Button>
                    )}
                    <Button variant="danger-ghost" icon={<Trash2 className="h-4 w-4" />} onClick={handleDelete}>
                      Supprimer
                    </Button>
                  </>
                )}
              </div>

              {body && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-medium text-fg-subtle">Aperçu (avec des données d'exemple)</p>
                  {/* WhatsApp's own message-bubble green - a brand recreation,
                      not a design-system colour, so it stays a literal value
                      like the print-preview islands elsewhere in the app. */}
                  <div className="max-w-sm whitespace-pre-wrap rounded-xl rounded-tl-none bg-[#e7ffdb] p-3 font-sans text-sm text-slate-800 shadow-sm">
                    {preview}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
