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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export function useSignalR() {
  const connectionRef = useRef<ReturnType<typeof HubConnectionBuilder.prototype.build> | null>(null)
  const updateStock = useInventoryStore((s) => s.updateStock)

  useEffect(() => {
    const token = getToken()
    if (!token) return
    if (isTokenExpired(token)) {
      localStorage.removeItem('sms-auth')
      window.location.href = '/login'
      return
    }

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/inventory', {
        accessTokenFactory: () => getToken() || '',
      })
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
      window.dispatchEvent(new CustomEvent('sms:orders-updated'))
    })

    connection.onreconnecting(() => {
      const current = getToken()
      if (!current || isTokenExpired(current)) {
        connection.stop()
        localStorage.removeItem('sms-auth')
        window.location.href = '/login'
      }
    })

    // start() is async; a fast navigation away from a SignalR-backed page (POS, the online
    // dashboard, online orders) can unmount before it resolves. Calling stop() on a connection
    // still mid-start throws "Failed to start the HttpConnection before stop() was called" -
    // and because withAutomaticReconnect() then treats that as a dropped connection, it keeps
    // retrying a connection that was already torn down, hammering /hubs/inventory and starving
    // the browser's per-origin connection pool for every other request the next page needs.
    // Only ever call stop() after start() has actually settled, success or failure.
    let disposed = false
    const startPromise = connection.start()
      .then(() => {
        if (!disposed) return connection.invoke('JoinPosRoom')
      })
      .catch((err) => {
        if (!disposed) console.error(err)
      })
    connectionRef.current = connection

    return () => {
      disposed = true
      startPromise.finally(() => connection.stop())
    }
  }, [updateStock])
}
