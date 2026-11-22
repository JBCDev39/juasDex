import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { loadDb } from './data';
import type { Db } from './types';
import List from './components/List';
import Detail from './components/Detail';
import { Spinner, reducedMotion } from './components/bits';

const parseHash = () => {
  const m = location.hash.match(/^#pokemon-(\d+)$/);
  return m ? Number(m[1]) : null;
};

type VTDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<number | null>(parseHash);

  useEffect(() => {
    loadDb().then(setDb).catch((e: Error) => setError(e.message));
    const onHash = () => {
      const next = parseHash();
      const doc = document as VTDoc;
      if (doc.startViewTransition && !reducedMotion()) {
        // Transición animada entre pantallas (el sprite "vuela" de la lista a la ficha)
        const t = doc.startViewTransition(() => flushSync(() => setCurrent(next)));
        t.finished.finally(() => { document.documentElement.dataset.nav = ''; });
      } else {
        setCurrent(next);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (error) return <div className="center-msg">Diay, algo falló: {error}. Intente recargar.</div>;
  if (!db) return <div className="center-msg"><Spinner /> Encendiendo la JuasDex…</div>;

  const valid = current && current >= 1 && current <= db.index.length ? current : null;
  return valid ? <Detail db={db} id={valid} /> : <List db={db} />;
}
