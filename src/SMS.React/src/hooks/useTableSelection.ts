import { useState, useCallback } from 'react'

export function useTableSelection<T extends { id: number }>() {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((items: T[]) => {
    setSelected(prev => {
      if (prev.size === items.length) return new Set()
      return new Set(items.map(i => i.id))
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const isSelected = useCallback((id: number) => selected.has(id), [selected])

  const allSelected = useCallback((items: T[]) => items.length > 0 && selected.size === items.length, [selected])

  const someSelected = selected.size > 0

  return { selected, toggle, toggleAll, clear, isSelected, allSelected, someSelected, count: selected.size }
}
