import { useState } from 'react'
import type { Client } from '../../api/clients'
import { printHtml } from '../../utils/printBridge'
import { openWhatsApp } from '../../utils/whatsapp'
import { copyImageToClipboard, downloadDataUrl } from '../../utils/clipboardImage'
import { showToast } from '../shared/Toast'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Printer, Send } from 'lucide-react'
import { Button, Modal } from '../ui'

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
    <Modal open onClose={onClose} size="sm" showClose={false}>
      <div className="mb-5 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-chip bg-[var(--positive-soft)] text-[var(--positive)]">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-semibold text-fg">{title ?? 'Client enregistré!'}</h2>
        <p className="text-sm text-fg-subtle">{subtitle ?? client.name}</p>
      </div>

      <div className="mb-5 flex justify-center">
        {/* The QR must stay true black-on-white to keep scanning reliable across cameras and print - a deliberate light island, like the print surfaces. */}
        <div className="rounded-card border-2 border-[color-mix(in_oklab,var(--positive)_28%,transparent)] bg-white p-4">
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

      <div className="mb-5 text-center">
        <p className="mb-1 text-xs text-fg-subtle">Code du client</p>
        <p className="num inline-block rounded-inset bg-sunken px-3 py-1.5 font-mono text-sm font-medium text-fg-muted">
          {client.qrCode}
        </p>
        <p className="num mt-2 text-sm font-medium text-[var(--positive)]">
          {client.totalPoints} points disponibles
        </p>
      </div>

      <div className="mb-3 flex gap-2">
        <Button variant="success" className="flex-1" icon={<Printer className="h-4 w-4" />} onClick={handlePrintQr}>
          Imprimer QR Code
        </Button>
        <Button
          variant="success"
          className="flex-1"
          icon={<Send className="h-4 w-4" />}
          disabled={sendingWhatsApp}
          loading={sendingWhatsApp}
          onClick={handleSendWhatsApp}
        >
          {sendingWhatsApp ? 'Préparation...' : 'Envoyer WhatsApp'}
        </Button>
      </div>

      <Button variant="outline" fullWidth onClick={onClose}>
        {closeLabel ?? 'Continuer'}
      </Button>
    </Modal>
  )
}
