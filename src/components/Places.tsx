import { useMemo, useState } from 'react';
import type { Db } from '../types';
import { pidInfo } from '../data';
import { GENS, Picker, Sprite, type Opt } from './bits';

/** [lugar, [[pid, método, nivel mín, nivel máx, %], ...]] */
export type Place = [string, [number, string, number, number, number][]];

const cache = new Map<number, Promise<Place[]>>();
export const loadPlaces = (v: number) => {
  let p = cache.get(v);
  if (!p) {
    p = fetch(`data/places/${v}.json`).then((r) => { if (!r.ok) throw new Error('lugares'); return r.json() as Promise<Place[]>; });
    p.catch(() => cache.delete(v));
    cache.set(v, p);
  }
  return p;
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Juegos con lugares, del más viejo al más nuevo (los DLC junto a su juego) */
export function placeVersions(db: Db): number[] {
  const order = new Map(db.meta.versionGroups.map((g, i) => [g.id, i]));
  const rank = (vg: number) => order.get(vg) ?? Math.max(-1, ...db.meta.versionGroups.filter((g) => g.id < vg).map((g) => order.get(g.id) ?? -1)) + 0.5;
  return [...db.meta.encVersions].filter((v) => db.meta.versions[v]).sort((a, b) => rank(db.meta.versions[a][1]) - rank(db.meta.versions[b][1]) || a - b);
}

/** Filtra por nombre del lugar o por nombre de un Pokémon que aparece ahí */
export function filterPlaces(db: Db, places: Place[] | null, nq: string) {
  if (!places) return null;
  if (!nq) return places.map((p) => ({ p, rows: p[1], byMon: false }));
  const out: { p: Place; rows: Place[1]; byMon: boolean }[] = [];
  for (const p of places) {
    if (norm(p[0]).includes(nq)) { out.push({ p, rows: p[1], byMon: false }); continue; }
    const rows = p[1].filter((r) => norm(pidInfo(db, r[0]).name).includes(nq));
    if (rows.length) out.push({ p, rows, byMon: true });
  }
  return out;
}

export default function PlacesView({ db, version, onVersion, list, loading, failed, onOpen }: {
  db: Db; version: number; onVersion: (v: number) => void;
  list: ReturnType<typeof filterPlaces>; loading: boolean; failed: boolean;
  onOpen: (species: number, el: HTMLElement) => void;
}) {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const versions = useMemo(() => placeVersions(db), [db]);
  const opts: Opt[] = useMemo(() => [...versions].reverse().map((v) => {
    const g = db.meta.versionGroups.find((x) => x.id === db.meta.versions[v][1]);
    return { value: v, label: db.meta.versions[v][0], group: g ? `Generación ${GENS[g.gen - 1]}` : 'Contenido descargable' };
  }), [db, versions]);
  const toggle = (k: string) => setOpenSet((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="places">
      <div className="places__game">
        <span className="places__label">Juego</span>
        <Picker title="Elija un juego" value={version} options={opts} onChange={(v) => { onVersion(v); setOpenSet(new Set()); }} searchable />
      </div>
      {failed && <div className="empty">Diay, no se pudieron cargar los lugares. ¿Tiene conexión?</div>}
      {loading && !list && <div className="places__loading">Cargando lugares…</div>}
      {list && list.length === 0 && <div className="empty">No hay ningún lugar ni Pokémon con ese nombre en este juego.</div>}
      {list && list.length > 0 && (
        <ul className="lplist">
          {list.map(({ p, rows, byMon }) => {
            const [name] = p;
            const isOpen = byMon || openSet.has(name);
            const mons = [...new Set(p[1].map((r) => r[0]))];
            // Agrupar por método (Hierba, Surf, Caña…)
            const groups = new Map<string, Place[1]>();
            for (const r of rows) { if (!groups.has(r[1])) groups.set(r[1], []); groups.get(r[1])!.push(r); }
            return (
              <li key={name} className={`lplace${isOpen ? ' is-open' : ''}`}>
                <button className="lplace__head" aria-expanded={isOpen} onClick={() => toggle(name)}>
                  <span className="lplace__pin" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9.5A2.5 2.5 0 1 1 12 7.5a2.5 2.5 0 0 1 0 5Z" fill="currentColor" /></svg>
                  </span>
                  <span className="lplace__main">
                    <strong>{name}</strong>
                    <small>{mons.length} Pokémon</small>
                  </span>
                  {!isOpen && (
                    <span className="lplace__peek" aria-hidden>
                      {mons.slice(0, 4).map((pid) => <Sprite key={pid} db={db} pid={pid} size={34} />)}
                      {mons.length > 4 && <em>+{mons.length - 4}</em>}
                    </span>
                  )}
                  <svg className="lplace__chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {isOpen && (
                  <div className="lplace__body">
                    {[...groups].map(([method, rs]) => (
                      <div key={method} className="lgroup">
                        <span className="lgroup__title">{method}</span>
                        {rs.map((r, i) => {
                          const info = pidInfo(db, r[0]);
                          return (
                            <button key={`${r[0]}-${i}`} className="lmon" onClick={(e) => onOpen(info.species, e.currentTarget)}>
                              <Sprite db={db} pid={r[0]} size={44} />
                              <span className="lmon__name">{info.name}{info.form ? <small> {info.form}</small> : null}</span>
                              <span className="lmon__lvl">Nv. {r[2] === r[3] ? r[2] : `${r[2]}–${r[3]}`}</span>
                              {r[4] > 0 && <span className="lmon__rate">{r[4]} %</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">Toque un lugar para ver qué Pokémon aparecen y cómo encontrarlos. También puede buscar un Pokémon para ver dónde sale en este juego.</p>
    </div>
  );
}
