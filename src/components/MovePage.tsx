import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Db, MoveInfo } from '../types';
import { loadMoveExtra } from '../data';
import { nav } from '../nav';
import { BackButton, GENS, MiniMon, MoveClass, Spinner, TypeBadge } from './bits';

const METHODS: [number, string, string][] = [[0, 'Todos', ''], [1, 'Nivel', 'Nv'], [8, 'MT', 'MT'], [2, 'Huevo', 'Huevo'], [4, 'Tutor', 'Tutor']];
const methodTag = (mask: number) => METHODS.filter(([m]) => m && mask & m).map(([, , t]) => t).join(' · ');

/** Dibujo del emblema según la clase de movimiento */
export function ClassIcon({ c }: { c: number }) {
  if (c === 2) return <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden><path d="M24 4l4.6 11.2L40 10l-5.2 11.4L46 26l-11.4 4.6L40 42l-11.4-5.2L24 48l-4.6-11.2L8 42l5.2-11.4L2 26l11.2-4.6L8 10l11.4 5.2Z" fill="currentColor" /></svg>;
  if (c === 3) return <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden><circle cx="24" cy="24" r="6" fill="currentColor" /><circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" opacity=".6" /></svg>;
  return <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden><path d="M24 6a18 18 0 1 0 0 36Z" fill="currentColor" /><circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="4" /></svg>;
}

export default function MovePage({ db, id }: { db: Db; id: number }) {
  const m = db.moves[id];
  const [extra, setExtra] = useState<{ info: Record<string, MoveInfo>; learners: Record<string, [number, number][]> } | null>(null);
  const [failed, setFailed] = useState(false);
  const [method, setMethod] = useState(0);

  useEffect(() => {
    let alive = true;
    loadMoveExtra().then((x) => alive && setExtra(x)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  const info = extra?.info[id];
  const learners = useMemo(() => extra?.learners[id] ?? [], [extra, id]);
  const counts = useMemo(() => Object.fromEntries(METHODS.map(([k]) => [k, k ? learners.filter(([, mask]) => mask & k).length : learners.length])), [learners]);
  const shown = method ? learners.filter(([, mask]) => mask & method) : learners;
  const idx = METHODS.findIndex(([k]) => k === method);
  const typeId = db.meta.types[m[1]]?.[1] ?? 'normal';
  const prio = info?.[2] ?? 0;

  return (
    <div className={`detail movepage t-bg-${typeId}`}>
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="emblem"><span className="emblem__icon"><ClassIcon c={m[2]} /></span></div>
          <div className="hero__info">
            <span className="hero__num">Movimiento{info ? ` · Gen. ${GENS[info[1] - 1]}` : ''}</span>
            <h2 className="hero__name">{m[0]}</h2>
            <div className="hero__types"><TypeBadge db={db} id={m[1]} style={{ '--i': 0 } as CSSProperties} /><MoveClass c={m[2]} /></div>
          </div>
        </div>
      </section>

      <main className="body">
        <div className="stack-gap">
          <div className="tiles">
            <div className="tile"><span>Potencia</span><strong>{m[3] ?? '—'}</strong></div>
            <div className="tile"><span>Precisión</span><strong>{m[4] != null ? `${m[4]} %` : '—'}</strong></div>
            <div className="tile"><span>PP</span><strong>{m[5] ?? '—'}</strong></div>
            <div className="tile"><span>Prioridad</span><strong>{prio > 0 ? `+${prio}` : prio}</strong></div>
          </div>

          <section className="dexentry">
            <div className="dexentry__head"><span className="dexentry__led" aria-hidden /><span>Descripción</span></div>
            <p className="dexentry__text">{info ? info[0] || 'Todavía no hay descripción en español.' : failed ? 'No se pudo cargar. ¿Tiene conexión?' : 'Cargando…'}</p>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h3>Lo aprenden</h3>
              {extra && <span className="pill">{learners.length} Pokémon</span>}
            </div>
            {!extra && !failed && <div className="empty"><Spinner /> Cargando…</div>}
            {extra && learners.length === 0 && <p className="muted">Ningún Pokémon lo aprende en los juegos registrados.</p>}
            {extra && learners.length > 0 && (
              <>
                <div className="seg" role="group" aria-label="Forma de aprendizaje" style={{ '--idx': idx, '--n': METHODS.length } as CSSProperties}>
                  <span className="seg__pill" aria-hidden />
                  {METHODS.map(([k, label]) => (
                    <button key={k} className={`seg__btn${k === method ? ' is-on' : ''}`} disabled={!counts[k]} onClick={() => setMethod(k)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="minigrid">
                  {shown.map(([pid, mask]) => (
                    <MiniMon key={pid} db={db} pid={pid} tag={methodTag(mask)} onClick={() => nav.push(`pokemon-${db.forms[pid]?.[0] ?? pid}`)} />
                  ))}
                </div>
                <p className="note">Incluye todos los juegos. Nv = por nivel, MT = máquina técnica u oculta.</p>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
