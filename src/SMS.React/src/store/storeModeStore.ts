import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type StoreMode = 'local' | 'online'

interface StoreModeState {
  mode: StoreMode
  setMode: (mode: StoreMode) => void
  toggleMode: () => void
}

export const useStoreModeStore = create<StoreModeState>()(
  persist(
    (set, get) => ({
      mode: 'local',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === 'local' ? 'online' : 'local' }),
    }),
    {
      name: 'sms-store-mode',
    }
  )
)
