import { useEffect, useState } from 'react';
import { loadDb } from './data';
import type { Db } from './types';
import List from './components/List';
import Detail from './components/Detail';
import { Spinner } from './components/bits';

const parseHash = () => {
  const m = location.hash.match(/^#pokemon-(\d+)$/);
  return m ? Number(m[1]) : null;
};

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState('');
  const [hashId, setHashId] = useState<number | null>(parseHash);
  // La ficha es una capa encima de la lista: la lista nunca se desmonta ni se vuelve a dibujar
  const [shownId, setShownId] = useState<number | null>(hashId);
  const [closing, setClosing] = useState(false);
  const [stamp, setStamp] = useState(0); // para que la lista refresque "Recientes" al volver

  useEffect(() => {
    loadDb().then(setDb).catch((e: Error) => setError(e.message));
    const onHash = () => setHashId(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (hashId) { setShownId(hashId); setClosing(false); }
    else setClosing((c) => c || shownId !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashId]);

  if (error) return <div className="center-msg">Diay, algo falló: {error}. Intente recargar.</div>;
  if (!db) return <div className="center-msg"><Spinner /> Encendiendo la JuasDex…</div>;

  const valid = shownId && shownId >= 1 && shownId <= db.index.length ? shownId : null;
  return (
    <>
      <div inert={Boolean(valid && !closing)}>
        <List db={db} stamp={stamp} />
      </div>
      {valid && (
        <Detail
          db={db}
          id={valid}
          closing={closing}
          onClosed={() => { setShownId(null); setClosing(false); setStamp((x) => x + 1); }}
        />
      )}
    </>
  );
}
