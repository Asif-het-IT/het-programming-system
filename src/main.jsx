import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { useThemeStore } from '@/store/themeStore'

useThemeStore.getState().applyTheme(useThemeStore.getState().theme);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failure should not block app startup.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
