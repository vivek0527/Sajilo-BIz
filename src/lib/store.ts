import { create } from 'zustand';
import { User } from './types';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  user: User | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setUser: (user: User | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'dark', // default to dark theme for premium aesthetics
  user: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(nextTheme);
    }
    return { theme: nextTheme };
  }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
    set({ theme });
  },
  setUser: (user) => set({ user }),
}));
