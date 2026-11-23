import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Fuentes incluidas en la app (funcionan sin conexión)
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-600.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
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
