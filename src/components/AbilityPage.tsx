import { useEffect, useState } from 'react';
import type { Db } from '../types';
import { loadHolders } from '../data';
import { nav } from '../nav';
import { BackButton, GENS, MiniMon, Spinner } from './bits';

export default function AbilityPage({ db, id }: { db: Db; id: number }) {
  const a = db.abilities[id];
  const [holders, setHolders] = useState<[number, number][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadHolders().then((h) => alive && setHolders(h[id] ?? [])).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id]);

  const normal = holders?.filter(([, h]) => !h) ?? [];
  const hidden = holders?.filter(([, h]) => h) ?? [];
  const open = (pid: number) => nav.push(`pokemon-${db.forms[pid]?.[0] ?? pid}`);

  return (
    <div className="detail abilitypage">
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="emblem emblem--ability">
            <span className="emblem__icon">
              <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden><path d="M24 4l17.3 10v20L24 44 6.7 34V14Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /><path d="M24 14l2.8 6.4 7 .7-5.3 4.6 1.6 6.9L24 29l-6.1 3.6 1.6-6.9-5.3-4.6 7-.7Z" fill="currentColor" /></svg>
            </span>
          </div>
          <div className="hero__info">
            <span className="hero__num">Habilidad{a[2] ? ` · Gen. ${GENS[a[2] - 1]}` : ''}</span>
            <h2 className="hero__name">{a[0]}</h2>
            {holders && <span className="hero__genus">{holders.length} Pokémon la pueden tener</span>}
          </div>
        </div>
      </section>

      <main className="body">
        <div className="stack-gap">
          <section className="dexentry">
            <div className="dexentry__head"><span className="dexentry__led" aria-hidden /><span>Qué hace</span></div>
            <p className="dexentry__text">{a[1] || 'Todavía no hay descripción en español.'}</p>
          </section>

          {!holders && !failed && <div className="empty"><Spinner /> Cargando…</div>}
          {failed && <div className="empty">No se pudo cargar. ¿Tiene conexión?</div>}
          {normal.length > 0 && (
            <section className="panel">
              <div className="panel__head"><h3>Como habilidad normal</h3><span className="pill">{normal.length}</span></div>
              <div className="minigrid">{normal.map(([pid]) => <MiniMon key={pid} db={db} pid={pid} onClick={() => open(pid)} />)}</div>
            </section>
          )}
          {hidden.length > 0 && (
            <section className="panel">
              <div className="panel__head"><h3>Como habilidad oculta</h3><span className="pill">{hidden.length}</span></div>
              <div className="minigrid">{hidden.map(([pid]) => <MiniMon key={pid} db={db} pid={pid} tag="Oculta" onClick={() => open(pid)} />)}</div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
