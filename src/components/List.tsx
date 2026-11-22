import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { Db } from '../types';
import { pad, store } from '../data';
import { Ball, GENS, GEN_STARTER, REGIONS, Sprite, TypeBadge, go } from './bits';
import { flight } from '../flight';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Panel = '' | 'type' | 'region';

// La vista "Todos" solo se recuerda durante la sesión: al abrir la app siempre arranca en el buscador
const session = {
  get: (k: string, d: string) => { try { return sessionStorage.getItem('juasdex:' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem('juasdex:' + k, v); } catch { /* sin almacenamiento */ } },
};

export default function List({ db }: { db: Db; stamp?: number }) {
  const [q, setQ] = useState(() => store.get('q', ''));
  const [types, setTypes] = useState<number[]>(() => store.get('types', [] as number[]));
  const [gen, setGen] = useState(() => store.get('gen', 0));
  const [all, setAll] = useState(() => session.get('all', '0') === '1');
  const [panel, setPanel] = useState<Panel>('');
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const padsRef = useRef<HTMLDivElement>(null);
  const searchPad = useRef<HTMLButtonElement>(null);
  const [edge, setEdge] = useState({ l: 0, r: 0 });
  const recent = store.get<number[]>('recent', []).filter((id) => id >= 1 && id <= db.index.length);
  const active = Boolean(q.trim() || types.length || gen || all);

  useLayoutEffect(() => {
    window.scrollTo(0, store.get('scroll', 0));
  }, []);

  // Dónde está el botón de búsqueda dentro de la fila: la barra crece desde ahí
  useLayoutEffect(() => {
    const measure = () => {
      const cap = searchPad.current?.querySelector('.pad__cap')?.getBoundingClientRect();
      const row = padsRef.current?.getBoundingClientRect();
      if (!cap || !row) return;
      const l = Math.round(cap.left - row.left), r = Math.round(row.right - cap.right);
      setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
    };
    measure();
    const row = padsRef.current;
    window.addEventListener('resize', measure);
    row?.addEventListener('transitionend', measure);
    return () => { window.removeEventListener('resize', measure); row?.removeEventListener('transitionend', measure); };
  });

  // "/" abre la búsqueda en computadora
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); openSearch(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const openSearch = () => {
    setPanel('');
    setSearching(true);
    input.current?.focus({ preventScroll: true }); // en el mismo toque, para que salga el teclado
  };

  const results = useMemo(() => {
    if (!active) return [];
    const nq = norm(q.trim().replace(/^#/, ''));
    return db.index.filter(([id, name, ts, g]) => {
      if (types.length && !types.every((t) => ts.includes(t))) return false;
      if (gen && g !== gen) return false;
      if (!nq) return true;
      return /^\d+$/.test(nq) ? String(id).startsWith(String(+nq)) : norm(name).includes(nq);
    });
  }, [db, q, types, gen, active]);

  const save = (k: string, v: unknown) => { store.set(k, v); store.set('scroll', 0); };
  const setQuery = (v: string) => { setQ(v); save('q', v); };
  const toggleType = (t: number) => {
    // Hasta 2 tipos; si ya hay 2, el más viejo sale
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t].slice(-2);
    setTypes(next); save('types', next);
  };
  const pickGen = (g: number) => { const v = g === gen ? 0 : g; setGen(v); save('gen', v); setPanel(''); };
  const toggleAll = () => { const v = !all; setAll(v); session.set('all', v ? '1' : '0'); setPanel(''); store.set('scroll', 0); };
  const clearAll = () => {
    setQuery(''); setTypes([]); setGen(0); setAll(false);
    save('types', []); save('gen', 0); session.set('all', '0'); setPanel('');
  };

  const open = (id: number, el?: HTMLElement) => {
    // El sprite tocado "vuela" hacia la ficha
    flight.id = id;
    flight.el = el?.querySelector<HTMLElement>('.sprite') ?? null;
    flight.fromList = true;
    store.set('scroll', window.scrollY);
    go(`pokemon-${id}`);
  };

  const typeColor = (t: number) => `var(--c-${db.meta.types[t]?.[1]})`;
  const typeFace: CSSProperties | undefined = types.length === 1
    ? { background: typeColor(types[0]) }
    : types.length === 2
      ? { background: `linear-gradient(135deg, ${typeColor(types[0])} 50%, ${typeColor(types[1])} 50%)` }
      : undefined;

  return (
    <div className={`home${active ? ' is-active' : ''}`}>
      <header className="home__hero">
        <Ball className="home__ball" size={520} />
        <span className="leds" aria-hidden><i /><i /><i /></span>
        <div className="home__inner">
          <h1 className="wordmark">JuasDex</h1>


          <div className={`pads${searching ? ' is-searching' : ''}`} ref={padsRef}>
            <PadButton
              ref={searchPad}
              label={q ? `«${q}»` : 'Buscar'}
              color="white"
              on={Boolean(q)}
              onClick={openSearch}
              extraClass="pad--search"
            >
              <SearchIcon />
            </PadButton>
            <PadButton
              label={types.length ? types.map((t) => db.meta.types[t][0]).join(' + ') : 'Tipo'}
              color="blue"
              on={panel === 'type' || types.length > 0}
              open={panel === 'type'}
              face={typeFace}
              onClick={() => setPanel(panel === 'type' ? '' : 'type')}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M12 3c3.5 4.2 6 7.5 6 10.5A6 6 0 0 1 6 13.5C6 10.5 8.5 7.2 12 3Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /></svg>
            </PadButton>
            <PadButton
              label={gen ? REGIONS[gen - 1] : 'Región'}
              color="yellow"
              on={panel === 'region' || gen > 0}
              open={panel === 'region'}
              onClick={() => setPanel(panel === 'region' ? '' : 'region')}
            >
              {gen ? <Sprite db={db} pid={GEN_STARTER[gen - 1]} size={44} /> : (
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z M9 4v13.5 M15 6.5V20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg>
              )}
            </PadButton>
            <PadButton label="Todos" color="green" on={all} onClick={toggleAll}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="4.5" cy="6" r="1.6" fill="currentColor" /><circle cx="4.5" cy="12" r="1.6" fill="currentColor" /><circle cx="4.5" cy="18" r="1.6" fill="currentColor" /></svg>
            </PadButton>

            <div className="sbar" style={{ '--l': `${edge.l}px`, '--r': `${edge.r}px` } as CSSProperties} aria-hidden={!searching}>
              <SearchIcon className="sbar__icon" />
              <input
                ref={input}
                type="search"
                value={q}
                placeholder="¿Qué Pokémon busca?"
                aria-label="Buscar Pokémon"
                tabIndex={searching ? 0 : -1}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearching(true)}
                onBlur={() => setSearching(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                autoComplete="off"
                enterKeyHint="search"
              />
              {q && (
                <button
                  type="button"
                  className="sbar__clear"
                  tabIndex={searching ? 0 : -1}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setQuery('')}
                  aria-label="Borrar búsqueda"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>
          </div>

          <div className={`drawer${panel ? ' is-open' : ''}`}>
            <div className="drawer__clip">
              <div className="drawer__body">
                {panel === 'type' && (
                  <>
                    <div className="drawer__head">
                      <span>Elija hasta 2 tipos</span>
                      {types.length > 0 && <button className="drawer__link" onClick={() => { setTypes([]); save('types', []); }}>Quitar</button>}
                    </div>
                    <div className="typegrid">
                      {Object.entries(db.meta.types).map(([id, [name, ident]]) => (
                        <button
                          key={id}
                          className={`tchip t-${ident}${types.includes(+id) ? ' is-on' : ''}`}
                          aria-pressed={types.includes(+id)}
                          onClick={() => toggleType(+id)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {panel === 'region' && (
                  <>
                    <div className="drawer__head">
                      <span>Elija una región</span>
                      {gen > 0 && <button className="drawer__link" onClick={() => pickGen(gen)}>Quitar</button>}
                    </div>
                    <div className="regiongrid">
                      {GENS.map((g, i) => (
                        <button key={g} className={`rchip${gen === i + 1 ? ' is-on' : ''}`} aria-pressed={gen === i + 1} onClick={() => pickGen(i + 1)}>
                          <Sprite db={db} pid={GEN_STARTER[i]} size={40} />
                          <span className="rchip__name">{REGIONS[i]}</span>
                          <span className="rchip__hint">Gen. {g}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {!active && recent.length > 0 && (
            <div className="recent">
              <span className="recent__label">Recientes</span>
              <div className="recent__row">
                {recent.map((id) => (
                  <button key={id} className="recent__chip" data-card={id} onClick={(e) => open(id, e.currentTarget)}>
                    <Sprite db={db} pid={id} size={32} />
                    {db.index[id - 1][1]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {active && (
        <main className="list-wrap">
          <p className="count">
            <span key={results.length} className="count__n">{results.length === 1 ? '1 Pokémon' : `${results.length} Pokémon`}</span>
            <button className="link-btn" onClick={clearAll}>{all && !q && !types.length && !gen ? 'Volver al buscador' : 'Limpiar'}</button>
          </p>
          {results.length === 0 ? (
            <div className="empty">
              <Ball className="empty__ball" size={44} />
              {types.length === 2 ? 'Diay, no hay ningún Pokémon con esa combinación de tipos.' : 'Diay, no hay ningún Pokémon así. Pruebe con otro nombre o quite algún filtro.'}
            </div>
          ) : (
            <ul className="grid">
              {results.map(([id, name, ts], i) => (
                <li key={id} style={i < 24 ? ({ '--i': i } as CSSProperties) : undefined} className={i < 24 ? 'in' : undefined}>
                  <button className="card" data-card={id} onClick={(e) => open(id, e.currentTarget)}>
                    <span className="card__num">#{pad(id)}</span>
                    <span className="card__sprite">
                      <Sprite db={db} pid={id} size={80} />
                    </span>
                    <span className="card__name">{name}</span>
                    <span className="card__types">{ts.map((t) => <TypeBadge key={t} db={db} id={t} small />)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <footer className="foot">
            Datos de <a href="https://pokeapi.co" target="_blank" rel="noreferrer">PokéAPI</a>. Pokémon y sus nombres son marcas de Nintendo, Game Freak y The Pokémon Company.
          </footer>
        </main>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.6" /><path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
  );
}

function PadButton({ label, color, on, open, face, onClick, children, ref, extraClass = '' }: {
  label: string; color: 'blue' | 'yellow' | 'green' | 'white'; on: boolean; open?: boolean; face?: CSSProperties;
  onClick: () => void; children: ReactNode; ref?: Ref<HTMLButtonElement>; extraClass?: string;
}) {
  return (
    <button ref={ref} type="button" className={`pad pad--${color} ${extraClass}${on ? ' is-on' : ''}`} aria-expanded={open} onClick={onClick}>
      <span className="pad__cap" style={face}>{children}</span>
      <span className="pad__label">{label}</span>
    </button>
  );
}
