import { useEffect, useState } from 'react';
import { store } from '../data';
import { CHANGES } from '../changelog';

type W = Window & { __juasdexWaiting?: ServiceWorker };

/** Ventanita abajo: "hay una versión nueva" y, después de actualizar, las novedades */
export default function UpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [news, setNews] = useState(false);
  const [out, setOut] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // ¿Acaba de actualizar? Mostrar novedades una vez
    const seen = store.get('seenVersion', '');
    const just = sessionStorage.getItem('juasdex:justUpdated');
    sessionStorage.removeItem('juasdex:justUpdated');
    if (seen !== CHANGES.v && (just || seen)) setNews(true);
    store.set('seenVersion', CHANGES.v);

    const onUpdate = (e: Event) => { const w = (e as CustomEvent<ServiceWorker>).detail; (window as W).__juasdexWaiting = w; setOut(false); setNews(false); setWaiting(w); };
    const pending = (window as W).__juasdexWaiting;
    if (pending) setWaiting(pending);
    window.addEventListener('juasdex:update', onUpdate);
    return () => window.removeEventListener('juasdex:update', onUpdate);
  }, []);

  const close = (after: () => void) => { setOut(true); window.setTimeout(() => { after(); setOut(false); }, 240); };
  const update = () => {
    if (!waiting) return;
    setBusy(true);
    sessionStorage.setItem('juasdex:updating', '1');
    sessionStorage.setItem('juasdex:justUpdated', '1');
    waiting.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(() => location.reload(), 4000); // por si el navegador no avisa del cambio
  };

  const Icon = () => (
    <span className="upd__icon" aria-hidden>
      <svg viewBox="0 0 24 24" width="24" height="24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );

  if (waiting) {
    return (
      <div className={`upd${out ? ' is-out' : ''}`} role="dialog" aria-live="polite" aria-label="Actualización disponible">
        <Icon />
        <strong>¡Qué chiva! Hay una versión nueva</strong>
        <p>Actualice para ver lo último de JuasDex. Sus equipos y favoritos no se pierden.</p>
        <div className="upd__actions">
          <button className="upd__btn" onClick={() => close(() => setWaiting(null))}>Después</button>
          <button className="upd__btn upd__btn--go" disabled={busy} onClick={update}>{busy ? 'Actualizando…' : 'Actualizar'}</button>
        </div>
      </div>
    );
  }
  if (news) {
    return (
      <div className={`upd${out ? ' is-out' : ''}`} role="dialog" aria-live="polite" aria-label="Novedades">
        <span className="upd__icon upd__icon--news" aria-hidden>
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 3l2.2 5.6L20 9.3l-4.5 3.8 1.5 5.9L12 15.8 7 19l1.5-5.9L4 9.3l5.8-.7Z" fill="currentColor" /></svg>
        </span>
        <strong>Tuanis, ya está al día</strong>
        <p>Esto es lo nuevo:</p>
        <ul>{CHANGES.items.map((x) => <li key={x}>{x}</li>)}</ul>
        <div className="upd__actions">
          <button className="upd__btn upd__btn--go" onClick={() => close(() => setNews(false))}>¡Pura vida!</button>
        </div>
      </div>
    );
  }
  return null;
}
