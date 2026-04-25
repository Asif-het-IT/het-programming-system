import { create } from 'zustand';

const STORAGE_KEY = 'app_theme';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),
  applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggleTheme() {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().applyTheme(next);
  },
}));
