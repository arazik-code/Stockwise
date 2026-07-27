import { useState, useEffect } from 'react'

interface ToastMessage {
  id: number
  text: string
  type: 'success' | 'error' | 'info' | 'warning'
}

let toastId = 0
let listeners: React.Dispatch<React.SetStateAction<ToastMessage[]>>[] = []

export function showToast(text: string, type: ToastMessage['type'] = 'info') {
  const msg = { id: ++toastId, text, type }
  listeners.forEach((fn) => fn((prev) => [...prev, msg]))
  setTimeout(() => {
    listeners.forEach((fn) => fn((prev) => prev.filter((t) => t.id !== msg.id)))
  }, 4000)
}

export default function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  useEffect(() => {
    listeners.push(setMessages)
    return () => {
      listeners = listeners.filter((l) => l !== setMessages)
    }
  }, [])

  if (messages.length === 0) return null

  const config: Record<ToastMessage['type'], { bg: string; icon: React.ReactElement }> = {
    success: {
      bg: 'bg-emerald-600',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-600',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-blue-600',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-amber-600',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
    },
  }

  const dismiss = (id: number) => {
    listeners.forEach((fn) => fn((prev) => prev.filter((t) => t.id !== id)))
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`${config[m.type].bg} text-white px-4 py-3 rounded-lg shadow-lg text-sm min-w-64 flex items-center gap-3 animate-slide-in`}
        >
          {config[m.type].icon}
          <span className="flex-1">{m.text}</span>
          <button onClick={() => dismiss(m.id)} className="text-white/70 hover:text-white">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
