import { useState, useEffect, useCallback } from 'react'
import Header from '../../components/layout/Header'
import { showToast } from '../../components/shared/Toast'
import { whatsappTemplatesApi, type WhatsAppTemplate } from '../../api/whatsappTemplates'
import { renderWhatsAppTemplate } from '../../utils/whatsapp'

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
    <div className="flex flex-col flex-1">
      <Header
        title="Modèles WhatsApp"
        actions={
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau modèle
          </button>
        }
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Template list */}
        <div className="w-64 border-r border-slate-200 overflow-y-auto bg-white">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-400">Chargement...</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">Aucun modèle</div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => openTemplate(t)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  selected?.id === t.id && !isNew ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''
                }`}
              >
                <p className="text-sm font-medium text-slate-900 truncate flex items-center gap-1">
                  {t.isDefault && <span className="text-amber-500">★</span>}
                  {t.name}
                </p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{t.body.replace(/\n/g, ' ')}</p>
              </button>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected && !isNew ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Sélectionnez un modèle ou créez-en un nouveau.
            </div>
          ) : (
            <div className="max-w-2xl space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Nom du modèle</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Confirmation express"
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 text-sm font-mono border-2 border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Insérer une variable</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.token}
                      onClick={() => insertPlaceholder(p.token)}
                      title={p.label}
                      className="px-2 py-1 text-xs font-mono bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                    >
                      {p.token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '...' : isNew ? 'Créer le modèle' : 'Enregistrer'}
                </button>
                {!isNew && selected && (
                  <>
                    {!selected.isDefault && (
                      <button
                        onClick={handleSetDefault}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Définir par défaut
                      </button>
                    )}
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Supprimer
                    </button>
                  </>
                )}
              </div>

              {body && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">Aperçu (avec des données d'exemple)</p>
                  <div className="bg-[#e7ffdb] rounded-xl rounded-tl-none p-3 text-sm text-slate-800 whitespace-pre-wrap font-sans max-w-sm shadow-sm">
                    {preview}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
