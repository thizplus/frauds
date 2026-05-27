import { create } from 'zustand'

interface SearchState {
  query: string
  type: string
  setSearch: (query: string, type: string) => void
  clear: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  type: 'all',
  setSearch: (query, type) => set({ query, type }),
  clear: () => set({ query: '', type: 'all' }),
}))
