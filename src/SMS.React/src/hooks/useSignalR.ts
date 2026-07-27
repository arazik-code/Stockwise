import { useEffect, useRef } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useInventoryStore } from '../store/inventoryStore'
import { showToast } from '../components/shared/Toast'

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('sms-auth')
    if (raw) {
      const { state } = JSON.parse(raw)
      return state?.token ?? null
    }
  } catch {}
  return null
}

export function useSignalR() {
  const connectionRef = useRef<ReturnType<typeof HubConnectionBuilder.prototype.build> | null>(null)
  const updateStock = useInventoryStore((s) => s.updateStock)

  useEffect(() => {
    const token = getToken()
    if (!token) return

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/inventory', { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('StockChanged', ({ productVariantId, newQuantity }: { productVariantId: number; newQuantity: number }) => {
      updateStock(productVariantId, newQuantity)
    })

    connection.on('LowStockAlert', ({ productName, quantity }: { productName: string; quantity: number }) => {
      showToast(`Low stock: ${productName} (${quantity} left)`, 'warning')
    })

    connection.on('NewShopifyOrder', ({ orderNumber, total }: { orderNumber: string; total: number }) => {
      showToast(`Nouvelle commande en ligne : ${orderNumber} (${total} MAD)`, 'info')
      window.dispatchEvent(new CustomEvent('sms:orders-updated'))
    })

    connection.on('NewOnlineOrder', ({ channel, orderNumber, total }: { channel: string; orderNumber: string; total: number }) => {
      showToast(`Nouvelle commande ${channel}: ${orderNumber} (${total} MAD)`, 'info')
      window.dispatchEvent(new CustomEvent('sms:orders-updated'))
    })

    connection.on('OrderStatusChanged', (_payload: { orderId: number; status: string }) => {
      // Broadcast so any open order list / dashboard refreshes live.
      window.dispatchEvent(new CustomEvent('sms:orders-updated'))
    })

    connection.start()
      .then(() => connection.invoke('JoinPosRoom'))
      .catch(console.error)
    connectionRef.current = connection

    return () => {
      connection.stop()
    }
  }, [updateStock])
}
