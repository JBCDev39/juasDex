import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { Db } from '../types';
import { favs, pad, store } from '../data';
import { Ball, Chevron, GENS, GEN_STARTER, MoveClass, REGIONS, Sprite, TypeBadge, reducedMotion } from './bits';
import { flight } from '../flight';
import { nav } from '../nav';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Panel = '' | 'type' | 'region';
type Tab = 'pokemon' | 'mov' | 'hab';
const TAB_LABEL: Record<Tab, string> = { pokemon: 'Pokémon', mov: 'Movimientos', hab: 'Habilidades' };

// La pestaña elegida solo se recuerda durante la sesión
const session = {
  get: (k: string, d: string) => { try { return sessionStorage.getItem('juasdex:' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem('juasdex:' + k, v); } catch { /* sin almacenamiento */ } },
};

export default function List({ db }: { db: Db; stamp?: number }) {
  const [q, setQ] = useState(() => store.get('q', ''));
  const [types, setTypes] = useState<number[]>(() => store.get('types', [] as number[]));
  const [gen, setGen] = useState(() => store.get('gen', 0));
  const [favOnly, setFavOnly] = useState(() => store.get('favOnly', false));
  const [tab, setTabState] = useState<Tab>(() => session.get('tab', 'pokemon') as Tab);
  const [panel, setPanel] = useState<Panel>('');
  const [searching, setSearching] = useState(false);
  const [ready, setReady] = useState(false);
  const [past, setPast] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const padsRef = useRef<HTMLDivElement>(null);
  const searchPad = useRef<HTMLButtonElement>(null);
  const hero = useRef<HTMLElement>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: 0, r: 0 });
  const recent = store.get<number[]>('recent', []).filter((id) => id >= 1 && id <= db.index.length);
  const favList = favs.list();
  const favSet = new Set(favList);
  const active = Boolean(q.trim() || types.length || gen || favOnly);

  // La lista completa se dibuja después de mostrar el inicio, para que la app abra rápido
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setReady(true), { timeout: 600 });
    else window.setTimeout(() => setReady(true), 200);
  }, []);

  // Botón flotante para volver arriba cuando el inicio ya no se ve
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPast(window.scrollY > (hero.current?.offsetHeight ?? 600) * 0.7));
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
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
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !document.querySelector('.sheet')) { e.preventDefault(); openSearch(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const openSearch = () => {
    setPanel('');
    setSearching(true);
    input.current?.focus({ preventScroll: true }); // en el mismo toque, para que salga el teclado
  };

  /* ---------- Filtros ---------- */
  const nq = norm(q.trim().replace(/^#/, ''));
  const pokemon = useMemo(() => db.index.filter(([id, name, ts, g]) => {
    if (favOnly && !favSet.has(id)) return false;
    if (types.length && !types.every((t) => ts.includes(t))) return false;
    if (gen && g !== gen) return false;
    if (!nq) return true;
    return /^\d+$/.test(nq) ? String(id).startsWith(String(+nq)) : norm(name).includes(nq);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [db, nq, types, gen, favOnly, favList.join()]);
  const allMoves = useMemo(() => Object.entries(db.moves).map(([id, m]) => [+id, m] as const).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es')), [db]);
  const moves = useMemo(() => allMoves.filter(([, m]) => {
    if (types.length && !types.includes(m[1])) return false;
    if (gen && m[6] !== gen) return false;
    return !nq || norm(m[0]).includes(nq);
  }), [allMoves, nq, types, gen]);
  const allAbil = useMemo(() => Object.entries(db.abilities).map(([id, a]) => [+id, a] as const).filter(([, a]) => a[2] > 0).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es')), [db]);
  const abil = useMemo(() => allAbil.filter(([, a]) => (!gen || a[2] === gen) && (!nq || norm(a[0]).includes(nq))), [allAbil, nq, gen]);
  const counts: Record<Tab, number> = { pokemon: pokemon.length, mov: moves.length, hab: abil.length };

  const save = (k: string, v: unknown) => { store.set(k, v); store.set('scroll', 0); };
  const setQuery = (v: string) => { setQ(v); save('q', v); };
  const setTab = (t: Tab) => { setTabState(t); session.set('tab', t); };
  const toggleType = (t: number) => {
    // Hasta 2 tipos; si ya hay 2, el más viejo sale
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t].slice(-2);
    setTypes(next); save('types', next);
  };
  const pickGen = (g: number) => { const v = g === gen ? 0 : g; setGen(v); save('gen', v); setPanel(''); };
  const toggleFav = () => { const v = !favOnly; setFavOnly(v); save('favOnly', v); setPanel(''); if (v) setTab('pokemon'); };
  const clearAll = () => {
    setQuery(''); setTypes([]); setGen(0); setFavOnly(false);
    save('types', []); save('gen', 0); save('favOnly', false); setPanel('');
  };
  const toList = () => listTop.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  const toTop = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });

  const open = (id: number, el?: HTMLElement) => {
    // El sprite tocado "vuela" hacia la ficha
    flight.id = id;
    flight.el = el?.querySelector<HTMLElement>('.sprite') ?? null;
    store.set('scroll', window.scrollY);
    nav.push(`pokemon-${id}`);
  };

  // Las tarjetas aparecen al entrar en pantalla (todas las que se ven, no solo las primeras)
  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>('.reveal:not(.seen)');
    if (reducedMotion() || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('seen')); return; }
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      vis.forEach((e, i) => {
        const el = e.target as HTMLElement;
        el.style.setProperty('--d', `${Math.min(i, 16) * 32}ms`);
        el.classList.add('seen');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -4% 0px' });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pokemon, moves, abil, tab, ready]);

  const typeColor = (t: number) => `var(--c-${db.meta.types[t]?.[1]})`;
  const typeFace: CSSProperties | undefined = types.length === 1
    ? { background: typeColor(types[0]) }
    : types.length === 2 ? { background: `linear-gradient(135deg, ${typeColor(types[0])} 50%, ${typeColor(types[1])} 50%)` } : undefined;
  const tabIdx = (['pokemon', 'mov', 'hab'] as Tab[]).indexOf(tab);
  const otherHits = (['pokemon', 'mov', 'hab'] as Tab[]).filter((t) => t !== tab && nq && counts[t] > 0);

  return (
    <div className={`home${active ? ' is-active' : ''}`}>
      <header className="home__hero" ref={hero}>
        <Ball className="home__ball" size={520} />
        <span className="leds" aria-hidden><i /><i /><i /></span>
        <div className="home__inner">
          <h1 className="wordmark">JuasDex</h1>

          <div className={`pads${searching ? ' is-searching' : ''}`} ref={padsRef}>
            <PadButton ref={searchPad} label={q ? `«${q}»` : 'Buscar'} color="white" on={Boolean(q)} onClick={openSearch} extraClass="pad--search">
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
            <PadButton label={favOnly ? `Favoritos (${favList.length})` : 'Favoritos'} color="orange" on={favOnly} onClick={toggleFav}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" fill={favOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg>
            </PadButton>

            <div className="sbar" style={{ '--l': `${edge.l}px`, '--r': `${edge.r}px` } as CSSProperties} aria-hidden={!searching}>
              <SearchIcon className="sbar__icon" />
              <input
                ref={input}
                type="search"
                value={q}
                placeholder="Pokémon, movimiento o habilidad"
                aria-label="Buscar"
                tabIndex={searching ? 0 : -1}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearching(true)}
                onBlur={() => setSearching(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                autoComplete="off"
                enterKeyHint="search"
              />
              {q && (
                <button type="button" className="sbar__clear" tabIndex={searching ? 0 : -1} onPointerDown={(e) => e.preventDefault()} onClick={() => setQuery('')} aria-label="Borrar búsqueda">
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
                        <button key={id} className={`tchip t-${ident}${types.includes(+id) ? ' is-on' : ''}`} aria-pressed={types.includes(+id)} onClick={() => toggleType(+id)}>{name}</button>
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
        {!active && (
          <button className="scroll-hint" onClick={toList}>
            <span>Ver toda la Pokédex</span>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </header>

      <section className="dexlist">
        <div ref={listTop} className="dexlist__anchor" />
        <div className="dexlist__bar">
          <div className="seg seg--tabs" role="tablist" style={{ '--idx': tabIdx, '--n': 3 } as CSSProperties}>
            <span className="seg__pill" aria-hidden />
            {(['pokemon', 'mov', 'hab'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={t === tab} className={`seg__btn${t === tab ? ' is-on' : ''}`} onClick={() => setTab(t)}>
                {TAB_LABEL[t]}{nq ? <small> {counts[t]}</small> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="list-wrap">
          <p className="count">
            <span key={`${tab}${counts[tab]}`} className="count__n">
              {counts[tab]} {tab === 'pokemon' ? 'Pokémon' : tab === 'mov' ? (counts[tab] === 1 ? 'movimiento' : 'movimientos') : (counts[tab] === 1 ? 'habilidad' : 'habilidades')}
              {favOnly && tab === 'pokemon' ? ' favoritos' : ''}
            </span>
            {active && <button className="link-btn" onClick={clearAll}>Limpiar filtros</button>}
          </p>
          {tab === 'hab' && types.length > 0 && <p className="note note--inline">El filtro de tipo no aplica a habilidades.</p>}
          {tab !== 'pokemon' && favOnly && <p className="note note--inline">Favoritos solo aplica a Pokémon.</p>}

          <div ref={gridRef}>
            {(ready || active) && tab === 'pokemon' && (
              pokemon.length === 0 ? (
                <Empty>
                  {favOnly && favList.length === 0
                    ? 'Todavía no tiene favoritos. Toque la estrella en la ficha de un Pokémon para guardarlo aquí.'
                    : types.length === 2 ? 'Diay, no hay ningún Pokémon con esa combinación de tipos.' : 'Diay, no hay ningún Pokémon así.'}
                  {otherHits.length > 0 && <Hits tabs={otherHits} counts={counts} onPick={setTab} />}
                </Empty>
              ) : (
                <ul className="grid">
                  {pokemon.map(([id, name, ts]) => (
                    <li key={id} className="reveal">
                      <button className={`card t-${db.meta.types[ts[0]]?.[1]}`} data-card={id} onClick={(e) => open(id, e.currentTarget)}>
                        <span className="card__num">#{pad(id)}</span>
                        {favSet.has(id) && (
                          <svg className="card__fav" viewBox="0 0 24 24" width="16" height="16" aria-label="Favorito"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" fill="currentColor" /></svg>
                        )}
                        <span className="card__sprite"><Sprite db={db} pid={id} size={88} /></span>
                        <span className="card__name">{name}</span>
                        <span className="card__types">{ts.map((t) => <TypeBadge key={t} db={db} id={t} small />)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {(ready || active) && tab === 'mov' && (
              moves.length === 0 ? (
                <Empty>Diay, no hay ningún movimiento así.{otherHits.length > 0 && <Hits tabs={otherHits} counts={counts} onPick={setTab} />}</Empty>
              ) : (
                <ul className="rows">
                  {moves.map(([id, m]) => (
                    <li key={id} className="reveal">
                      <button className={`mrow t-${db.meta.types[m[1]]?.[1]}`} onClick={() => nav.push(`mov-${id}`)}>
                        <span className="mrow__main">
                          <strong>{m[0]}</strong>
                          <span className="mrow__meta"><TypeBadge db={db} id={m[1]} small /><MoveClass c={m[2]} /></span>
                        </span>
                        <span className="mrow__nums">
                          <span><small>Pot.</small>{m[3] ?? '—'}</span>
                          <span><small>Prec.</small>{m[4] ?? '—'}</span>
                          <span><small>PP</small>{m[5] ?? '—'}</span>
                        </span>
                        <Chevron />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {(ready || active) && tab === 'hab' && (
              abil.length === 0 ? (
                <Empty>Diay, no hay ninguna habilidad así.{otherHits.length > 0 && <Hits tabs={otherHits} counts={counts} onPick={setTab} />}</Empty>
              ) : (
                <ul className="rows">
                  {abil.map(([id, a]) => (
                    <li key={id} className="reveal">
                      <button className="arow" onClick={() => nav.push(`hab-${id}`)}>
                        <span className="arow__main">
                          <span className="arow__top"><strong>{a[0]}</strong><span className="arow__gen">{REGIONS[a[2] - 1]}</span></span>
                          {a[1] && <span className="arow__desc">{a[1]}</span>}
                        </span>
                        <Chevron />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          <footer className="foot">
            Datos de <a href="https://pokeapi.co" target="_blank" rel="noreferrer">PokéAPI</a>. Pokémon y sus nombres son marcas de Nintendo, Game Freak y The Pokémon Company.
          </footer>
        </div>
      </section>

      <button className={`fab-top${past ? ' is-on' : ''}`} onClick={toTop} aria-label="Volver al inicio" tabIndex={past ? 0 : -1}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><Ball className="empty__ball" size={44} />{children}</div>;
}

function Hits({ tabs, counts, onPick }: { tabs: Tab[]; counts: Record<Tab, number>; onPick: (t: Tab) => void }) {
  return (
    <span className="hits">
      Pero sí hay coincidencias en:
      {tabs.map((t) => <button key={t} className="hits__btn" onClick={() => onPick(t)}>{TAB_LABEL[t]} ({counts[t]})</button>)}
    </span>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.6" /><path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
  );
}

function PadButton({ label, color, on, open, face, onClick, children, ref, extraClass = '' }: {
  label: string; color: 'blue' | 'yellow' | 'green' | 'white' | 'orange'; on: boolean; open?: boolean; face?: CSSProperties;
  onClick: () => void; children: ReactNode; ref?: Ref<HTMLButtonElement>; extraClass?: string;
}) {
  return (
    <button ref={ref} type="button" className={`pad pad--${color} ${extraClass}${on ? ' is-on' : ''}`} aria-expanded={open} onClick={onClick}>
      <span className="pad__cap" style={face}>{children}</span>
      <span className="pad__label">{label}</span>
    </button>
  );
}
