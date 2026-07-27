import { useState, useRef, useEffect, useCallback } from 'react'
import { clientsApi, type Client } from '../../api/clients'
import { showToast } from '../shared/Toast'

interface ClientLookupProps {
  onClientFound: (client: Client) => void
  onNewClient: (phone: string) => void
  onClose: () => void
}

export default function ClientLookup({ onClientFound, onNewClient, onClose }: ClientLookupProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'scan' | 'search'>('search')
  const [suggestions, setSuggestions] = useState<Client[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode === 'scan' && scanInputRef.current) {
      scanInputRef.current.focus()
    } else if (mode === 'search' && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [mode])

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const results = await clientsApi.getAll(value.trim())
      setSuggestions(results.slice(0, 8))
      setShowSuggestions(results.length > 0)
    } catch {
      setSuggestions([])
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 250)
  }

  const handleSelectClient = (client: Client) => {
    showToast(`Bienvenue ${client.name}!`, 'success')
    onClientFound(client)
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)

    try {
      // Try QR code first
      const byQr = await clientsApi.getByQrCode(query.trim()).catch(() => null)
      if (byQr) {
        showToast(`Bienvenue ${byQr.name}!`, 'success')
        onClientFound(byQr)
        return
      }

      // Try phone
      const byPhone = await clientsApi.getByPhone(query.trim()).catch(() => null)
      if (byPhone) {
        showToast(`Bienvenue ${byPhone.name}!`, 'success')
        onClientFound(byPhone)
        return
      }

      // Try name search
      const byName = await clientsApi.getAll(query.trim()).catch(() => null)
      if (byName && byName.length > 0) {
        showToast(`Bienvenue ${byName[0].name}!`, 'success')
        onClientFound(byName[0])
        return
      }

      // Not found — offer to register
      showToast('Client introuvable. Enregistrer un nouveau?', 'info')
      onNewClient(query.trim())
    } catch {
      showToast('Recherche échouée', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && suggestions.length > 0) {
        handleSelectClient(suggestions[0])
      } else {
        handleSearch()
      }
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[440px] border border-slate-200 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Client Fidélité</h2>
              <p className="text-xs text-slate-500">Scanner, rechercher par nom ou téléphone</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode('scan'); setQuery(''); setSuggestions([]); setShowSuggestions(false) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'scan'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Scanner QR Code
          </button>
          <button
            onClick={() => { setMode('search'); setQuery(''); setSuggestions([]); setShowSuggestions(false) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'search'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Rechercher client
          </button>
        </div>

        {/* Input */}
        <div className="relative mb-4">
          {mode === 'scan' ? (
            <input
              ref={scanInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scanner le code QR ici..."
              className="w-full px-4 py-3 text-base border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-400 font-mono text-center tracking-wider"
              autoFocus
            />
          ) : (
            <>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Nom du client ou numéro de téléphone..."
                  className="w-full pl-10 pr-4 py-3 text-base border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-auto">
                  {suggestions.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={() => handleSelectClient(client)}
                      className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{client.name}</p>
                        <p className="text-xs text-slate-500">{client.phone} · {client.totalPoints} points</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="w-full py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Recherche...' : 'Rechercher client'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="text-xs text-slate-400">ou</span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        {/* New Client Button */}
        <button
          onClick={() => onNewClient('')}
          className="w-full py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Enregistrer un nouveau client
        </button>
      </div>
    </div>
  )
}
