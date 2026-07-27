import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import { playScanSuccess } from '../../utils/sound'

// ponytail: scanner heuristic — real scanners emit each char faster than a human can type
const SCANNER_MAX_GAP_MS = 50
const MIN_BARCODE_LENGTH = 8

interface ProductSearchProps {
  onSearch: (query: string) => void
  onBarcodeScan: (barcode: string) => void
}

export interface ProductSearchHandle {
  focus: () => void
}

const ProductSearch = forwardRef<ProductSearchHandle, ProductSearchProps>(({ onSearch, onBarcodeScan }, ref) => {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [scanFlash, setScanFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastKeyTimeRef = useRef<number>(0)
  const scannerLikelyRef = useRef(true)
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  const triggerScan = useCallback(
    (barcode: string) => {
      onBarcodeScan(barcode)
      setQuery('')
      setScanFlash(true)
      playScanSuccess()
      setTimeout(() => setScanFlash(false), 600)
      inputRef.current?.focus()
    },
    [onBarcodeScan]
  )

  const handleChange = useCallback(
    (value: string) => {
      const now = performance.now()
      const gap = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now
      if (value.length <= 1) {
        scannerLikelyRef.current = true
      } else if (gap > SCANNER_MAX_GAP_MS) {
        scannerLikelyRef.current = false
      }

      setQuery(value)
      if (value.length >= 2) {
        onSearch(value)
      } else if (value.length === 0) {
        onSearch('')
      }

      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current)
      if (scannerLikelyRef.current && /^[A-Za-z0-9-]+$/.test(value) && value.length >= MIN_BARCODE_LENGTH) {
        // Debounce briefly to let the scanner's final characters land before auto-submitting.
        autoScanTimerRef.current = setTimeout(() => triggerScan(value), 80)
      }
    },
    [onSearch, triggerScan]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && /^[A-Za-z0-9-]+$/.test(query)) {
        if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current)
        triggerScan(query)
      }
    },
    [query, triggerScan]
  )

  useEffect(() => () => {
    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current)
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('pos.searchPlaceholder')}
        className={`w-full px-4 py-3 pl-10 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 transition-colors ${
          scanFlash ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'
        }`}
      />
      <svg
        className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  )
})

ProductSearch.displayName = 'ProductSearch'
export default ProductSearch
