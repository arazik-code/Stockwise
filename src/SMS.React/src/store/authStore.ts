import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/client'

interface User {
  id: number
  username: string
  fullName: string
  role: string
}

interface AuthState {
  token: string | null
  user: User | null
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/login', { username, password })
          set({
            token: data.token,
            user: data.user,
            isLoading: false,
            error: null,
          })
        } catch (err: any) {
          const message =
            err.response?.data?.message || 'Invalid credentials'
          set({ isLoading: false, error: message })
          throw err
        }
      },

      logout: () => {
        set({ token: null, user: null, error: null })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'sms-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
