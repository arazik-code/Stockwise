import { useState } from 'react'
import type { Client } from '../../api/clients'
import { printHtml } from '../../utils/printBridge'
import { openWhatsApp } from '../../utils/whatsapp'
import { copyImageToClipboard, downloadDataUrl } from '../../utils/clipboardImage'
import { showToast } from '../shared/Toast'
import { QRCodeSVG } from 'qrcode.react'

interface ClientQrCardProps {
  client: Client
  onClose: () => void
  title?: string
  subtitle?: string
  closeLabel?: string
}

async function buildQrPngDataUrl(client: Client): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(client.qrCode, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#065f46', light: '#ffffff' },
  })
}

/** The QR-code / print / WhatsApp card - shown after POS registration and from the Clients page. */
export default function ClientQrCard({ client, onClose, title, subtitle, closeLabel }: ClientQrCardProps) {
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

  const handlePrintQr = async () => {
    const qrDataUrl = await buildQrPngDataUrl(client)

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code Fidelite - ${client.name}</title>
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
              <div class="client-name">${client.name}</div>
              <div class="client-phone">${client.phone}</div>
            </div>
            <div class="qr-code">${client.qrCode}</div>
            <div class="points">${client.totalPoints} points</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `
    printHtml(html)
  }

  const handleSendWhatsApp = async () => {
    if (sendingWhatsApp) return
    setSendingWhatsApp(true)
    try {
      const qrDataUrl = await buildQrPngDataUrl(client)
      const copied = await copyImageToClipboard(qrDataUrl)

      const baseMessage =
        `Bienvenue ${client.name}! Vous êtes inscrit à notre programme de fidélité.\n\n` +
        `Votre code QR: ${client.qrCode}\n` +
        `Vous avez ${client.totalPoints} points.\n\n` +
        `Présentez ce QR code lors de votre prochaine visite pour gagner et utiliser des points!`
      const message = copied
        ? `${baseMessage}\n\n(L'image du QR code a été copiée - collez-la avec Ctrl+V dans cette conversation)`
        : baseMessage

      const sent = openWhatsApp(client.phone, message)
      if (!sent) {
        showToast('Numéro de téléphone invalide pour WhatsApp', 'error')
        return
      }

      if (copied) {
        showToast('Image du QR code copiée - collez-la (Ctrl+V) dans WhatsApp', 'success')
      } else {
        downloadDataUrl(qrDataUrl, `qr-${client.qrCode}.png`)
        showToast('Image du QR code téléchargée - joignez-la manuellement dans WhatsApp', 'info')
      }
    } finally {
      setSendingWhatsApp(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{title ?? 'Client enregistré!'}</h2>
          <p className="text-sm text-slate-500">{subtitle ?? client.name}</p>
        </div>

        <div className="flex justify-center mb-5">
          <div className="p-4 bg-white border-2 border-emerald-200 rounded-lg">
            <QRCodeSVG
              value={client.qrCode}
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
            {client.qrCode}
          </p>
          <p className="text-sm text-emerald-600 mt-2 font-medium">
            {client.totalPoints} points disponibles
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
            disabled={sendingWhatsApp}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {sendingWhatsApp ? 'Préparation...' : 'Envoyer WhatsApp'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
        >
          {closeLabel ?? 'Continuer'}
        </button>
      </div>
    </div>
  )
}
