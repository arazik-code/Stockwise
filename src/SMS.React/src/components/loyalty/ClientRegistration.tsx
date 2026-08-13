import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { clientsApi, type Client } from '../../api/clients'
import { showToast } from '../shared/Toast'
import ClientQrCard from './ClientQrCard'
import { Button, Input, Modal } from '../ui'

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
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title={
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-[var(--accent-soft)] text-[var(--accent)]">
            <UserPlus className="h-4 w-4" />
          </span>
          <span>Enregistrer client fidélité</span>
        </div>
      }
      description="Nouveau client? 50 points bonus!"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="submit" form="client-registration-form" loading={loading} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <form id="client-registration-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nom complet"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du client"
          autoFocus
        />
        <Input
          type="tel"
          label="Numéro de téléphone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+212 6XX XXX XXX"
        />
      </form>
    </Modal>
  )
}
