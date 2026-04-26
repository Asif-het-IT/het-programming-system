import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { useThemeStore } from '@/store/themeStore'

useThemeStore.getState().applyTheme(useThemeStore.getState().theme);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failure should not block app startup.
      });
    } else {
      // Prevent stale cached bundles from affecting local dev login flow.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
