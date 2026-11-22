import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Modo sin conexión: registra el service worker si el navegador lo permite.
// Además pide almacenamiento persistente para que el navegador no borre los datos.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.storage?.persist?.().catch(() => {});
  });
}
