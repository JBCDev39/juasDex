import type { Db } from '../types';
import { nav } from '../nav';
import { BackButton, ItemIcon, MiniMon } from './bits';

const MODE: Record<string, string> = { usar: 'Usándolo', equipado: 'Equipado', intercambio: 'Intercambio' };
const GROUP_LABEL: Record<string, string> = { equip: 'Objeto equipable', evo: 'Objeto de evolución', baya: 'Baya', ball: 'Poké Ball', med: 'Medicina' };

export default function ItemPage({ db, id }: { db: Db; id: number }) {
  const it = db.items[id];
  const [name, cat, group, desc, ident, evo, wild] = it;
  const open = (pid: number) => nav.push(`pokemon-${db.forms[pid]?.[0] ?? pid}`);

  return (
    <div className="detail itempage">
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="emblem emblem--item"><span className="emblem__icon"><ItemIcon db={db} ident={ident} size={84} /></span></div>
          <div className="hero__info">
            <span className="hero__num">{GROUP_LABEL[group]}</span>
            <h2 className="hero__name">{name}</h2>
            <span className="hero__genus">{cat}</span>
          </div>
        </div>
      </section>

      <main className="body">
        <div className="stack-gap">
          <section className="dexentry">
            <div className="dexentry__head"><span className="dexentry__led" aria-hidden /><span>Descripción</span></div>
            <p className="dexentry__text">{desc || 'Todavía no hay descripción en español.'}</p>
          </section>

          {evo.length > 0 && (
            <section className="panel">
              <div className="panel__head"><h3>Hace evolucionar a</h3><span className="pill">{evo.length}</span></div>
              <div className="minigrid">
                {evo.map(([sid, mode]) => <MiniMon key={sid} db={db} pid={sid} tag={MODE[mode] ?? mode} onClick={() => open(sid)} />)}
              </div>
            </section>
          )}

          {wild.length > 0 && (
            <section className="panel">
              <div className="panel__head"><h3>Lo llevan en estado salvaje</h3><span className="pill">{wild.length}</span></div>
              <div className="minigrid">
                {wild.map((pid) => <MiniMon key={pid} db={db} pid={pid} onClick={() => open(pid)} />)}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
