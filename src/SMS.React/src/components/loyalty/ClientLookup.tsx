import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, QrCode, Search, User } from 'lucide-react'
import { clientsApi, type Client } from '../../api/clients'
import { showToast } from '../shared/Toast'
import { Button, Input, Modal, Tabs } from '../ui'

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
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-[var(--accent-soft)] text-[var(--accent)]">
            <QrCode className="h-4 w-4" />
          </span>
          <span>Client Fidélité</span>
        </div>
      }
      description="Scanner, rechercher par nom ou téléphone"
    >
      <div className="space-y-4">
        {/* Mode Toggle */}
        <Tabs
          variant="segmented"
          layoutGroupId="client-lookup-mode"
          value={mode}
          onChange={(v) => {
            setMode(v as 'scan' | 'search')
            setQuery('')
            setSuggestions([])
            setShowSuggestions(false)
          }}
          items={[
            { value: 'scan', label: 'Scanner QR Code' },
            { value: 'search', label: 'Rechercher client' },
          ]}
          className="w-full [&>button]:flex-1"
        />

        {/* Input */}
        <div className="relative">
          {mode === 'scan' ? (
            <Input
              ref={scanInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scanner le code QR ici..."
              className="text-center font-mono text-base tracking-wider"
              size="lg"
              autoFocus
            />
          ) : (
            <>
              <Input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Nom du client ou numéro de téléphone..."
                leading={<Search />}
                size="lg"
                autoFocus
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface shadow-e3">
                  {suggestions.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={() => handleSelectClient(client)}
                      className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-2"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-[var(--accent-soft)] text-[var(--accent)]">
                        <User className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">{client.name}</span>
                        <span className="block text-xs text-fg-subtle">
                          {client.phone} · <span className="num">{client.totalPoints}</span> points
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Search Button */}
        <Button fullWidth onClick={handleSearch} disabled={loading || !query.trim()} loading={loading}>
          {loading ? 'Recherche...' : 'Rechercher client'}
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-fg-subtle">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* New Client Button */}
        <Button variant="outline" fullWidth onClick={() => onNewClient('')}>
          Enregistrer un nouveau client
        </Button>
      </div>
    </Modal>
  )
}
