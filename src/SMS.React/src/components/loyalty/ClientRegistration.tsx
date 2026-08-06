import { useState } from 'react'
import { clientsApi, type Client } from '../../api/clients'
import { showToast } from '../shared/Toast'
import ClientQrCard from './ClientQrCard'

interface ClientRegistrationProps {
  onRegistered: (client: Client) => void
  onCancel: () => void
  initialPhone?: string
}

export default function ClientRegistration({ onRegistered, onCancel, initialPhone = '' }: ClientRegistrationProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(initialPhone)
  const [loading, setLoading] = useState(false)
  const [registeredClient, setRegisteredClient] = useState<Client | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return

    setLoading(true)
    try {
      const client = await clientsApi.create({ name: name.trim(), phone: phone.trim() })
      showToast(`Bienvenue ${client.name}! 50 points bonus ajoutés.`, 'success')
      setRegisteredClient(client)
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string; clientId?: number } } }
      if (apiErr.response?.data?.clientId) {
        showToast('Téléphone déjà enregistré. Recherche du client existant...', 'info')
        try {
          const existing = await clientsApi.getById(apiErr.response.data.clientId)
          setRegisteredClient(existing)
        } catch {
          showToast('Échec de la recherche du client existant', 'error')
        }
      } else {
        showToast('Échec de l\'enregistrement du client', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  if (registeredClient) {
    return (
      <ClientQrCard
        client={registeredClient}
        onClose={() => {
          onRegistered(registeredClient)
          setRegisteredClient(null)
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Enregistrer client fidélité</h2>
            <p className="text-xs text-slate-500">Nouveau client? 50 points bonus!</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Nom complet *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du client"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Numéro de téléphone *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6XX XXX XXX"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
