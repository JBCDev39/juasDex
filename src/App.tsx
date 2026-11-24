import { useEffect, useState } from 'react';
import { loadDb } from './data';
import type { Db } from './types';
import { parseRoute, type Route } from './nav';
import List from './components/List';
import Sheet from './components/Sheet';
import UpdateToast from './components/UpdateToast';
import { Spinner } from './components/bits';

const valid = (db: Db, r: Route): Route => {
  if (!r) return null;
  if (r.kind === 'pokemon') return r.id >= 1 && r.id <= db.index.length ? r : null;
  if (r.kind === 'mov') return db.moves[r.id] ? r : null;
  if (r.kind === 'hab') return db.abilities[r.id] ? r : null;
  if (r.kind === 'obj') return db.items[r.id] ? r : null;
  return r; // equipos / equipo / importar

};

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState('');
  const [route, setRoute] = useState<Route>(parseRoute);
  // La capa vive encima de la lista: la lista nunca se desmonta ni se vuelve a dibujar
  const [shown, setShown] = useState<Route>(route);
  const [closing, setClosing] = useState(false);
  const [stamp, setStamp] = useState(0); // para que la lista refresque Recientes y Favoritos al volver

  useEffect(() => {
    loadDb().then(setDb).catch((e: Error) => setError(e.message));
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route) { setShown(route); setClosing(false); }
    else setClosing((c) => c || shown !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  if (error) return <div className="center-msg">Diay, algo falló: {error}. Intente recargar.</div>;
  if (!db) return <div className="center-msg"><Spinner /> Encendiendo la JuasDex…</div>;

  const r = valid(db, shown);
  return (
    <>
      <div inert={Boolean(r && !closing)}>
        <List db={db} stamp={stamp} />
      </div>
      {r && (
        <Sheet
          db={db}
          route={r}
          closing={closing}
          onClosed={() => { setShown(null); setClosing(false); setStamp((x) => x + 1); }}
        />
      )}
      <UpdateToast />
    </>
  );
}
