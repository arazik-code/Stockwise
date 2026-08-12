import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { playScanSuccess } from '../../utils/sound'
import { Input, cn } from '../ui'

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

  /* A REAL <input>, via the kit's <Input>. PosPage's global key handler gates on
     e.target.tagName === 'INPUT' - this is the element that gate is protecting,
     and it is also the scanner's landing pad. The ref still points at the native
     node, so the useImperativeHandle focus() above is unchanged.

     scanFlash is the one glow on this component: a state signal confirming a
     scan landed, not ambient decoration. */
  return (
    <div className="relative" data-tone="positive">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('pos.searchPlaceholder')}
        aria-label={t('pos.searchPlaceholder')}
        size="density"
        leading={<Search />}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          scanFlash &&
            'border-[var(--tone)] bg-[var(--tone-soft)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--tone)_25%,transparent)]'
        )}
      />
    </div>
  )
})

ProductSearch.displayName = 'ProductSearch'
export default ProductSearch
