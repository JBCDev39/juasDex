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
import { watchZoom } from './zoom';
import { watchStatusBar } from './statusbar';

watchZoom();
watchStatusBar();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Modo sin conexión: registra el service worker si el navegador lo permite.
// Además pide almacenamiento persistente para que el navegador no borre los datos.
// Cuando hay una versión nueva, se avisa con una ventanita (ver UpdateToast).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.storage?.persist?.().catch(() => {});
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const announce = (w: ServiceWorker | null) => { if (w && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent('juasdex:update', { detail: w })); };
      announce(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') announce(w); });
      });
      // Revisar si hay versión nueva al volver a la app y cada 30 minutos
      const check = () => { reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60 * 1000);
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !sessionStorage.getItem('juasdex:updating')) return;
      reloaded = true;
      sessionStorage.removeItem('juasdex:updating');
      location.reload();
    });
  });
}
