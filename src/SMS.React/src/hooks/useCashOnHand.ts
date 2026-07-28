import { useEffect, useState } from 'react'
import { cashDrawerApi } from '../api/cashDrawer'
import { useAuthStore } from '../store/authStore'

// Admin-only figure - the endpoint itself is role-locked, so a non-admin request would just
// 403. Skip the call entirely for non-admins rather than surfacing an error toast for a widget
// they were never meant to see.
export function useCashOnHand() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'Admin')
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(isAdmin)

  useEffect(() => {
    if (!isAdmin) return
    cashDrawerApi.getSummary()
      .then((s) => setBalance(s.balance))
      .catch(() => setBalance(null))
      .finally(() => setLoading(false))
  }, [isAdmin])

  return { isAdmin, balance, loading }
}
