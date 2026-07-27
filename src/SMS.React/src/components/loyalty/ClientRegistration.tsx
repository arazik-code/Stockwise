import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { clientsApi, type Client } from '../../api/clients'
import { showToast } from '../shared/Toast'

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

  const handlePrintQr = async () => {
    if (!registeredClient) return

    const QRCode = (await import('qrcode')).default
    const qrDataUrl = await QRCode.toDataURL(registeredClient.qrCode, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#065f46', light: '#ffffff' },
    })

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code Fidelite - ${registeredClient.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .card {
              border: 2px solid #10b981;
              border-radius: 12px;
              padding: 30px;
              text-align: center;
              max-width: 300px;
            }
            .title { font-size: 18px; font-weight: bold; color: #065f46; margin-bottom: 5px; }
            .subtitle { font-size: 12px; color: #047857; margin-bottom: 20px; }
            .qr-container { margin: 20px 0; }
            .qr-container img { width: 200px; height: 200px; }
            .client-info { margin-top: 20px; font-size: 14px; color: #374151; }
            .client-name { font-weight: bold; font-size: 16px; }
            .client-phone { color: #6b7280; margin-top: 5px; }
            .qr-code { font-family: monospace; font-size: 12px; color: #6b7280; margin-top: 10px; }
            .points { margin-top: 15px; padding: 8px 16px; background: #ecfdf5; border-radius: 20px; color: #065f46; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">Carte Fidelite</div>
            <div class="subtitle">Programme de fidelite</div>
            <div class="qr-container">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>
            <div class="client-info">
              <div class="client-name">${registeredClient.name}</div>
              <div class="client-phone">${registeredClient.phone}</div>
            </div>
            <div class="qr-code">${registeredClient.qrCode}</div>
            <div class="points">${registeredClient.totalPoints} points</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleSendWhatsApp = () => {
    if (!registeredClient) return
    const message = encodeURIComponent(
      `Bienvenue ${registeredClient.name}! Vous êtes inscrit à notre programme de fidélité.\n\n` +
      `Votre code QR: ${registeredClient.qrCode}\n` +
      `Vous avez ${registeredClient.totalPoints} points.\n\n` +
      `Présentez ce QR code lors de votre prochaine visite pour gagner et utiliser des points!`
    )
    const phone = registeredClient.phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
  }

  if (registeredClient) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Client enregistré!</h2>
            <p className="text-sm text-slate-500">{registeredClient.name}</p>
          </div>

          <div className="flex justify-center mb-5">
            <div className="p-4 bg-white border-2 border-emerald-200 rounded-lg">
              <QRCodeSVG
                value={registeredClient.qrCode}
                size={160}
                level="H"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#065f46"
              />
            </div>
          </div>

          <div className="text-center mb-5">
            <p className="text-xs text-slate-500 mb-1">Code du client</p>
            <p className="font-mono text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded inline-block">
              {registeredClient.qrCode}
            </p>
            <p className="text-sm text-emerald-600 mt-2 font-medium">
              {registeredClient.totalPoints} points disponibles
            </p>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={handlePrintQr}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
            >
              Imprimer QR Code
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors"
            >
              Envoyer WhatsApp
            </button>
          </div>

          <button
            onClick={() => {
              onRegistered(registeredClient)
              setRegisteredClient(null)
            }}
            className="w-full py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            Continuer
          </button>
        </div>
      </div>
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

export function sendQrViaWhatsApp(client: Client) {
  const message = encodeURIComponent(
    `Bienvenue ${client.name}! Vous êtes inscrit à notre programme de fidélité.\n\n` +
    `Votre code QR: ${client.qrCode}\n` +
    `Vous avez ${client.totalPoints} points.\n\n` +
    `Présentez ce QR code lors de votre prochaine visite pour gagner et utiliser des points!`
  )
  const phone = client.phone.replace(/[^0-9]/g, '')
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
}
