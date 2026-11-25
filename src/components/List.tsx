import { uiZoom } from '../zoom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { Db } from '../types';
import { favs, pad, store } from '../data';
import { Ball, Chevron, FLAVORS, GENS, ItemIcon, MoveClass, Picker, REGIONS, STAT_SHORT, Sprite, TypeBadge, reducedMotion, type Opt } from './bits';
import { glyphPaths } from './glyphs';
import PlacesView, { filterPlaces, loadPlaces, placeVersions, type Place } from './Places';
import { flight } from '../flight';
import { useBackClose } from '../backstack';
import { nav } from '../nav';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Panel = '' | 'type' | 'region';
type Tab = 'pokemon' | 'mov' | 'hab' | 'obj' | 'nat' | 'lug';
const TAB_LABEL: Record<Tab, string> = { pokemon: 'Pokémon', mov: 'Movimientos', hab: 'Habilidades', obj: 'Objetos', nat: 'Naturalezas', lug: 'Lugares' };
const TABS: Tab[] = ['pokemon', 'mov', 'hab', 'obj', 'nat', 'lug'];

/** Pokédex de cada juego: número regional y especie */
type Dex = { vg: number; name: string; n: [number, number][] };
let dexesP: Promise<Dex[]> | null = null;
const loadDexes = () => (dexesP ??= fetch('data/dexes.json').then((r) => { if (!r.ok) throw new Error('dex'); return r.json() as Promise<Dex[]>; }).catch((e) => { dexesP = null; throw e; }));
const dexGame = (d: Dex) => d.name.split(' · ')[0];
const dexPart = (d: Dex) => d.name.split(' · ')[1] ?? '';
/** Letras para el botón: "Platino" -> PL, "Espada / Escudo" -> EE, "Leyendas: Arceus" -> LA */
const dexInitials = (d: Dex) => {
  const src = dexPart(d) || dexGame(d);
  const pieces = src.split(' / ');
  if (pieces.length > 1) return pieces.map((x) => x.trim()[0]).join('').toUpperCase();
  const caps = src.split(/[\s:·]+/).filter((w) => /^[A-ZÁÉÍÓÚÑ0-9]/.test(w)).map((w) => w[0]).join('');
  return (caps.length >= 2 ? caps : src.slice(0, 2)).slice(0, 3).toUpperCase();
};
const dexLabel = (d: Dex) => { const t = dexPart(d) || dexGame(d); return t.length <= 11 ? t : dexInitials(d); };
const ITEM_GROUPS: [string, string][] = [['', 'Todos'], ['equip', 'Equipables'], ['evo', 'Evolución'], ['baya', 'Bayas'], ['ball', 'Poké Balls'], ['med', 'Medicinas']];

// La pestaña elegida solo se recuerda durante la sesión
const session = {
  get: (k: string, d: string) => { try { return sessionStorage.getItem('juasdex:' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem('juasdex:' + k, v); } catch { /* sin almacenamiento */ } },
};

export default function List({ db }: { db: Db; stamp?: number }) {
  const [q, setQ] = useState(() => store.get('q', ''));
  const [types, setTypes] = useState<number[]>(() => store.get('types', [] as number[]));
  const [gen, setGen] = useState(() => store.get('gen', 0));
  const [dex, setDex] = useState(() => store.get('dex', 0)); // 0 = ninguna; si no, posición + 1
  const [dexes, setDexes] = useState<Dex[] | null>(null);
  const [regionMode, setRegionMode] = useState<'gen' | 'game'>(() => (store.get('dex', 0) ? 'game' : 'gen'));
  const [lugV, setLugV] = useState(() => store.get('lugV', 0));
  const [lugData, setLugData] = useState<Place[] | null>(null);
  const [lugState, setLugState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [favOnly, setFavOnly] = useState(() => store.get('favOnly', false));
  const [tab, setTabState] = useState<Tab>(() => session.get('tab', 'pokemon') as Tab);
  const [panel, setPanel] = useState<Panel>('');
  const [itemGroup, setItemGroup] = useState(() => session.get('itemGroup', ''));
  const [searching, setSearching] = useState(false);
  const [listSearch, setListSearch] = useState(false);
  const [listFilters, setListFilters] = useState(false);
  const [ready, setReady] = useState(false);
  const [past, setPast] = useState(false);
  useBackClose(Boolean(panel), () => setPanel(''));
  useBackClose(listFilters, () => setListFilters(false));
  useBackClose(listSearch, () => { setListSearch(false); listInput.current?.blur(); });
  const input = useRef<HTMLInputElement>(null);
  const listInput = useRef<HTMLInputElement>(null);
  const padsRef = useRef<HTMLDivElement>(null);
  const searchPad = useRef<HTMLButtonElement>(null);
  const hero = useRef<HTMLElement>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const homeInner = useRef<HTMLDivElement>(null);
  const listBar = useRef<HTMLDivElement>(null);
  const anchorList = useRef(false); // si se busca/filtra desde la lista, la vista se queda en la lista
  const [edge, setEdge] = useState({ l: 0, r: 0 });
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabPill, setTabPill] = useState<{ left: number; width: number }>({ left: 3, width: 0 });
  const favList = favs.list();
  const favSet = new Set(favList);
  const curDex = dex && dexes ? dexes[dex - 1] ?? null : null;
  const dexNum = useMemo(() => (curDex ? new Map(curDex.n.map(([num, sid]) => [sid, num])) : null), [curDex]);
  const active = Boolean(q.trim() || types.length || gen || dex || favOnly);
  const filterCount = (types.length ? 1 : 0) + (gen || dex ? 1 : 0) + (favOnly ? 1 : 0);
  useEffect(() => { loadDexes().then(setDexes).catch(() => undefined); }, []);

  // La lista completa se dibuja después de mostrar el inicio, para que la app abra rápido
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setReady(true), { timeout: 600 });
    else window.setTimeout(() => setReady(true), 200);
  }, []);

  // ¿Ya no se ven los botones del inicio? → aparecen los botones flotantes
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const pads = padsRef.current?.getBoundingClientRect();
        setPast(pads ? pads.bottom < 0 : window.scrollY > 400);
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  // Dónde está el botón de búsqueda dentro de la fila: la barra crece desde ahí
  useLayoutEffect(() => {
    const measure = () => {
      const cap = searchPad.current?.querySelector('.pad__cap')?.getBoundingClientRect();
      const row = padsRef.current?.getBoundingClientRect();
      if (!cap || !row) return;
      const z = uiZoom();
      const l = Math.round((cap.left - row.left) / z), r = Math.round((row.right - cap.right) / z);
      setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
    };
    measure();
    const row = padsRef.current;
    window.addEventListener('resize', measure);
    row?.addEventListener('transitionend', measure);
    return () => { window.removeEventListener('resize', measure); row?.removeEventListener('transitionend', measure); };
  });

  // Si la búsqueda de la lista está abierta y se vuelve al inicio, se cierra sola
  useEffect(() => {
    if (past) return;
    anchorList.current = false;
    if (listSearch) listInput.current?.blur();
    if (listFilters) setListFilters(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past]);

  // "/" abre la búsqueda en computadora
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !document.querySelector('.sheet')) {
        e.preventDefault();
        if (past) openListSearch(); else openSearch();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // Tocar afuera cierra los paneles de filtros
  useEffect(() => {
    if (!panel && !listFilters) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel && !homeInner.current?.querySelector('.drawer')?.contains(t) && !padsRef.current?.contains(t)) setPanel('');
      if (listFilters && !listBar.current?.contains(t)) setListFilters(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [panel, listFilters]);

  const openSearch = () => {
    setPanel('');
    setSearching(true);
    anchorList.current = false;
    input.current?.focus({ preventScroll: true }); // en el mismo toque, para que salga el teclado
  };
  const openListSearch = () => {
    setListFilters(false);
    setListSearch(true);
    anchorList.current = true;
    listInput.current?.focus({ preventScroll: true });
  };

  /* ---------- Filtros ---------- */
  const nq = norm(q.trim().replace(/^#/, ''));
  const pokemon = useMemo(() => {
    const list = db.index.filter(([id, name, ts, g]) => {
      if (favOnly && !favSet.has(id)) return false;
      if (types.length && !types.every((t) => ts.includes(t))) return false;
      if (gen && g !== gen) return false;
      if (dexNum && !dexNum.has(id)) return false;
      if (!nq) return true;
      if (/^\d+$/.test(nq)) return String(dexNum ? dexNum.get(id) : id).startsWith(String(+nq));
      return norm(name).includes(nq);
    });
    // Con la Pokédex de un juego, en el orden de ese juego
    return dexNum ? list.sort((a, b) => (dexNum.get(a[0]) ?? 0) - (dexNum.get(b[0]) ?? 0)) : list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, nq, types, gen, dexNum, favOnly, favList.join()]);
  const allMoves = useMemo(() => Object.entries(db.moves).map(([id, m]) => [+id, m] as const).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es')), [db]);
  const moves = useMemo(() => allMoves.filter(([, m]) => {
    if (types.length && !types.includes(m[1])) return false;
    if (gen && m[6] !== gen) return false;
    return !nq || norm(m[0]).includes(nq);
  }), [allMoves, nq, types, gen]);
  const allAbil = useMemo(() => Object.entries(db.abilities).map(([id, a]) => [+id, a] as const).filter(([, a]) => a[2] > 0).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es')), [db]);
  const abil = useMemo(() => allAbil.filter(([, a]) => (!gen || a[2] === gen) && (!nq || norm(a[0]).includes(nq))), [allAbil, nq, gen]);
  const allItems = useMemo(() => Object.entries(db.items).map(([id, it]) => [+id, it] as const).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es')), [db]);
  const items = useMemo(() => allItems.filter(([, it]) => (!itemGroup || it[2] === itemGroup) && (!nq || norm(it[0]).includes(nq))), [allItems, itemGroup, nq]);
  const allNat = useMemo(() => Object.entries(db.natures).map(([id, n]) => [+id, n] as const).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es')), [db]);
  const natures = useMemo(() => allNat.filter(([, n]) => !nq || norm(n[0]).includes(nq)), [allNat, nq]);
  // Lugares: se cargan al abrir la pestaña o al buscar
  const lugVersions = useMemo(() => placeVersions(db), [db]);
  // Por defecto, el juego completo más nuevo (no un DLC de un solo lugar)
  const lugVersion = lugV && lugVersions.includes(lugV) ? lugV : [...lugVersions].reverse().find((v) => ![48, 50, 51].includes(v)) ?? lugVersions[lugVersions.length - 1] ?? 0;
  useEffect(() => {
    if (!lugVersion || (tab !== 'lug' && !nq)) return;
    let alive = true;
    setLugState('loading');
    loadPlaces(lugVersion).then((d) => { if (alive) { setLugData(d); setLugState('idle'); } }).catch(() => { if (alive) setLugState('error'); });
    return () => { alive = false; };
  }, [lugVersion, tab, nq]);
  const places = useMemo(() => filterPlaces(db, lugData, nq), [db, lugData, nq]);
  const counts: Record<Tab, number> = { pokemon: pokemon.length, mov: moves.length, hab: abil.length, obj: items.length, nat: natures.length, lug: places?.length ?? 0 };

  // Al buscar o filtrar desde la lista: el inicio se acomoda sin animar (está fuera de la vista)
  // y la vista se queda al principio de los resultados, sin saltos.
  useLayoutEffect(() => {
    if (!anchorList.current || !listTop.current) return;
    const y = listTop.current.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior: 'auto' });
  }, [nq, types, gen, dex, favOnly, tab]);

  const save = (k: string, v: unknown) => { store.set(k, v); store.set('scroll', 0); };
  const setQuery = (v: string) => { setQ(v); save('q', v); };
  const setTab = (t: Tab) => { setTabState(t); session.set('tab', t); };
  const toggleType = (t: number) => {
    // Hasta 2 tipos; si ya hay 2, el más viejo sale
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t].slice(-2);
    setTypes(next); save('types', next);
  };
  const clearTypes = () => { setTypes([]); save('types', []); };
  const pickGen = (g: number, close = true) => { const v = g === gen ? 0 : g; setGen(v); save('gen', v); if (v) { setDex(0); save('dex', 0); } if (close) setPanel(''); };
  const pickDex = (d: number, close = true) => {
    const v = d === dex ? 0 : d; setDex(v); save('dex', v);
    if (v) { setGen(0); save('gen', 0); setTab('pokemon'); }
    if (close) setPanel('');
  };
  const clearRegion = (close = true) => { setGen(0); setDex(0); save('gen', 0); save('dex', 0); if (close) setPanel(''); };
  const pickLug = (v: number) => { setLugV(v); store.set('lugV', v); setLugData(null); };
  const toggleFav = (close = true) => { const v = !favOnly; setFavOnly(v); save('favOnly', v); if (close) setPanel(''); if (v) setTab('pokemon'); };
  const clearAll = () => {
    setQuery(''); setTypes([]); setGen(0); setDex(0); setFavOnly(false);
    save('types', []); save('gen', 0); save('dex', 0); save('favOnly', false); setPanel('');
  };
  const toList = () => listTop.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  const toTop = () => { anchorList.current = false; window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); };

  const open = (id: number, el?: HTMLElement) => {
    flight.id = id; // el sprite tocado "vuela" hacia la ficha
    flight.el = el?.querySelector<HTMLElement>('.sprite') ?? null;
    store.set('scroll', window.scrollY);
    nav.push(`pokemon-${id}`);
  };

  // Las tarjetas aparecen al entrar en pantalla (todas las que se ven)
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
  }, [pokemon, moves, abil, items, natures, places, tab, ready]);

  const tabIdx = TABS.indexOf(tab);
  // La píldora roja se mide sobre la pestaña activa (las pestañas no miden lo mismo)
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabsRef.current?.querySelectorAll<HTMLElement>('.seg__btn')[tabIdx];
      if (el) setTabPill((p) => (p.left === el.offsetLeft && p.width === el.offsetWidth ? p : { left: el.offsetLeft, width: el.offsetWidth }));
      const bar = tabsRef.current;
      if (el && bar && (el.offsetLeft < bar.scrollLeft || el.offsetLeft + el.offsetWidth > bar.scrollLeft + bar.clientWidth)) {
        bar.scrollTo({ left: el.offsetLeft - 12, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tabIdx, nq]);
  const otherHits = TABS.filter((t) => t !== tab && nq && counts[t] > 0);
  const instant = anchorList.current && (listSearch || listFilters || past);

  return (
    <div className={`home${active ? ' is-active' : ''}${panel ? ' has-panel' : ''}${instant ? ' is-instant' : ''}`}>
      <header className="home__hero" ref={hero}>
        <Ball className="home__ball" size={520} />
        <span className="leds" aria-hidden><i /><i /><i /></span>
        <button className="teams-btn" onClick={() => nav.push('equipos')} aria-label="Equipos" title="Equipos">
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
            {([[11.5, 25, '#e62829'], [28.5, 25, '#2980ef'], [20, 12, '#ffd23f']] as const).map(([cx, cy, top], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="8.2" fill="#f6f5f2" stroke="#0e1317" strokeWidth="2" />
                <path d={`M${cx - 8.2} ${cy}a8.2 8.2 0 0 1 16.4 0Z`} fill={top} stroke="#0e1317" strokeWidth="2" />
                <circle cx={cx} cy={cy} r="2.6" fill="#f6f5f2" stroke="#0e1317" strokeWidth="1.8" />
              </g>
            ))}
          </svg>
        </button>
        <div className="home__inner" ref={homeInner}>
          <h1 className="wordmark">JuasDex</h1>

          <div className={`pads${searching ? ' is-searching' : ''}`} ref={padsRef}>
            <PadButton ref={searchPad} label={q ? `«${q}»` : 'Buscar'} color="white" on={Boolean(q)} onClick={openSearch} extraClass="pad--search">
              <SearchIcon />
            </PadButton>
            <PadButton
              label={types.length ? types.map((t) => db.meta.types[t][0]).join(' + ') : 'Tipo'}
              color="ball"
              on={panel === 'type' || types.length > 0}
              open={panel === 'type'}
              onClick={() => setPanel(panel === 'type' ? '' : 'type')}
            >
              <TypeBall db={db} selected={types} />
            </PadButton>
            <PadButton
              label={curDex ? dexLabel(curDex) : gen ? REGIONS[gen - 1] : 'Región'}
              color="yellow"
              on={panel === 'region' || gen > 0 || dex > 0}
              open={panel === 'region'}
              onClick={() => setPanel(panel === 'region' ? '' : 'region')}
            >
              {curDex ? <span key={`d${dex}`} className="pad__numeral pad__numeral--dex">{dexInitials(curDex)}</span> : gen ? <span key={gen} className="pad__numeral">{GENS[gen - 1]}</span> : (
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z M9 4v13.5 M15 6.5V20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg>
              )}
            </PadButton>
            <PadButton label={favOnly ? `Favoritos (${favList.length})` : 'Favoritos'} color="orange" on={favOnly} onClick={() => toggleFav()}>
              <StarIcon filled={favOnly} />
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
              {q && <ClearButton tabbable={searching} onClear={() => setQuery('')} />}
            </div>
          </div>

          <Drawer open={Boolean(panel)} which={panel === 'region' ? `region-${regionMode}` : panel}>
            {(which) => which.startsWith('region') ? (
              <>
                <div className="drawer__head">
                  <div className="rmode" role="tablist" aria-label="Filtrar por">
                    <button role="tab" aria-selected={which === 'region-gen'} className={which === 'region-gen' ? 'is-on' : ''} onClick={() => setRegionMode('gen')}>Por generación</button>
                    <button role="tab" aria-selected={which === 'region-game'} className={which === 'region-game' ? 'is-on' : ''} onClick={() => setRegionMode('game')}>Por juego</button>
                  </div>
                  {(gen > 0 || dex > 0) && <button className="drawer__link" onClick={() => clearRegion()}>Quitar</button>}
                </div>
                {which === 'region-gen'
                  ? <RegionGrid gen={gen} onPick={(g) => pickGen(g)} />
                  : <DexGrid db={db} dexes={dexes} dex={dex} onPick={(d) => pickDex(d)} />}
              </>
            ) : (
              <>
                <div className="drawer__head">
                  <span>Elija hasta 2 tipos</span>
                  {types.length > 0 && <button className="drawer__link" onClick={clearTypes}>Quitar</button>}
                </div>
                <TypeGrid db={db} types={types} onToggle={toggleType} />
              </>
            )}
          </Drawer>

          <div className={`recent-wrap${active || panel ? ' is-hidden' : ''}`}>
            <div className="recent-wrap__clip">
              <div className="keypad">
                {([
                  ['mov', 'Movimientos', <svg key="i" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M13 2 5 13h6l-1 9 8-11h-6Z" fill="currentColor" /></svg>],
                  ['hab', 'Habilidades', <svg key="i" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M12 3l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L12 15.8 6.9 18.9l1.4-5.9L3.7 9.1l6-.5Z" fill="currentColor" /></svg>],
                  ['obj', 'Objetos', <svg key="i" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7h2.5A1.5 1.5 0 0 1 20 8.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7Zm2 0h4V5.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z" fill="currentColor" /></svg>],
                  ['nat', 'Naturalezas', <svg key="i" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M7 4l4 5H8v7H6V9H3Zm10 16-4-5h3V8h2v7h3Z" fill="currentColor" /></svg>],
                  ['lug', 'Lugares', <svg key="i" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9.5A2.5 2.5 0 1 1 12 7.5a2.5 2.5 0 0 1 0 5Z" fill="currentColor" /></svg>],
                ] as [Tab, string, ReactNode][]).map(([t, label, icon]) => (
                  <button key={t} className={`key${t === 'lug' ? ' key--wide' : ''}`} tabIndex={active || panel ? -1 : 0} onClick={() => { setTab(t); anchorList.current = false; window.setTimeout(toList, 30); }}>
                    <span className="key__icon">{icon}</span>{label}
                  </button>
                ))}
              </div>
            </div>
          </div>

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
        <div className="dexlist__bar" ref={listBar}>
          <div className="dexlist__row">
            <div ref={tabsRef} className={`seg seg--tabs${nq ? ' has-counts' : ''}`} role="tablist">
              <span className="seg__pill" aria-hidden style={tabPill} />
              {TABS.map((t) => (
                <button key={t} role="tab" aria-selected={t === tab} className={`seg__btn${t === tab ? ' is-on' : ''}`} onClick={() => setTab(t)}>
                  <span className="seg__label">{TAB_LABEL[t]}</span>
                  {nq ? <small key={counts[t]} className="seg__count">{counts[t]}</small> : null}
                </button>
              ))}
            </div>
            <button
              className={`filter-btn${listFilters ? ' is-open' : ''}${filterCount ? ' has-filters' : ''}`}
              aria-expanded={listFilters}
              aria-label="Filtros"
              onClick={() => { setListSearch(false); anchorList.current = true; setListFilters((x) => !x); }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
              <span className="filter-btn__label">Filtros</span>
              {filterCount > 0 && <span key={filterCount} className="filter-btn__count">{filterCount}</span>}
            </button>
          </div>
          <Drawer open={listFilters} which="all" variant="list">
            {() => (
              <>
                <div className="lf__row">
                  <span className="lf__title">Favoritos</span>
                  <button className={`lf__fav${favOnly ? ' is-on' : ''}`} aria-pressed={favOnly} onClick={() => toggleFav(false)}>
                    <StarIcon filled={favOnly} size={18} /> {favOnly ? 'Solo favoritos' : 'Mostrar solo favoritos'}
                  </button>
                </div>
                <div className="lf__row lf__row--head">
                  <span className="lf__title">Tipo <small>(hasta 2)</small></span>
                  {types.length > 0 && <button className="lf__link" onClick={clearTypes}>Quitar</button>}
                </div>
                <TypeGrid db={db} types={types} onToggle={toggleType} />
                <div className="lf__row lf__row--head">
                  <span className="lf__title">Región</span>
                  {gen > 0 && <button className="lf__link" onClick={() => pickGen(gen, false)}>Quitar</button>}
                </div>
                <RegionGrid gen={gen} onPick={(g) => pickGen(g, false)} plain />
                <div className="lf__row lf__row--head">
                  <span className="lf__title">Pokédex de un juego</span>
                  {dex > 0 && <button className="lf__link" onClick={() => pickDex(dex, false)}>Quitar</button>}
                </div>
                <Picker title="Pokédex de un juego" value={dex} placeholder="Todas (Pokédex nacional)" searchable
                  options={(dexes ?? []).map((d, i): Opt => ({ value: i + 1, label: d.name, group: `Generación ${GENS[(db.meta.versionGroups.find((g) => g.id === d.vg)?.gen ?? 1) - 1]}` })).reverse()}
                  onChange={(v) => pickDex(v, false)} />
                <div className="lf__foot">
                  {filterCount > 0 && <button className="lf__link" onClick={() => { setTypes([]); setFavOnly(false); save('types', []); save('favOnly', false); clearRegion(false); }}>Quitar todos</button>}
                  <button className="lf__done" onClick={() => setListFilters(false)}>Listo</button>
                </div>
              </>
            )}
          </Drawer>
        </div>

        <div className="list-wrap">
          <p className="count">
            <span key={`${tab}${counts[tab]}`} className="count__n">
              {counts[tab]} {({ pokemon: ['Pokémon', 'Pokémon'], mov: ['movimiento', 'movimientos'], hab: ['habilidad', 'habilidades'], obj: ['objeto', 'objetos'], nat: ['naturaleza', 'naturalezas'], lug: ['lugar', 'lugares'] } as Record<Tab, [string, string]>)[tab][counts[tab] === 1 ? 0 : 1]}
              {favOnly && tab === 'pokemon' ? ' favoritos' : ''}
              {curDex && tab === 'pokemon' ? ` · Pokédex de ${curDex.name.replace(' · ', ', ')}` : ''}
            </span>
            {active && <button className="link-btn" onClick={clearAll}>Limpiar todo</button>}
          </p>
          {(tab === 'hab' || tab === 'obj' || tab === 'nat' || tab === 'lug') && types.length > 0 && <p className="note note--inline">El filtro de tipo no aplica aquí.</p>}
          {(tab === 'obj' || tab === 'nat' || tab === 'lug') && gen > 0 && <p className="note note--inline">El filtro de región no aplica aquí.</p>}
          {tab !== 'pokemon' && dex > 0 && <p className="note note--inline">La Pokédex de un juego solo aplica a Pokémon.</p>}
          {tab !== 'pokemon' && favOnly && <p className="note note--inline">Favoritos solo aplica a Pokémon.</p>}
          {tab === 'obj' && (
            <div className="chips-row" role="group" aria-label="Clase de objeto">
              {ITEM_GROUPS.map(([g, label]) => (
                <button key={g} className={`fchip${itemGroup === g ? ' is-on' : ''}`} aria-pressed={itemGroup === g} onClick={() => { setItemGroup(g); session.set('itemGroup', g); }}>{label}</button>
              ))}
            </div>
          )}

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
                        <span className="card__num" title={dexNum ? `Nacional #${pad(id)}` : undefined}>#{dexNum ? String(dexNum.get(id)).padStart(3, '0') : pad(id)}</span>
                        {favSet.has(id) && <StarIcon filled size={16} className="card__fav" />}
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

            {(ready || active) && tab === 'obj' && (
              items.length === 0 ? (
                <Empty>Diay, no hay ningún objeto así.{otherHits.length > 0 && <Hits tabs={otherHits} counts={counts} onPick={setTab} />}</Empty>
              ) : (
                <ul className="rows">
                  {items.map(([id, it]) => (
                    <li key={id} className="reveal">
                      <button className="irow" onClick={() => nav.push(`obj-${id}`)}>
                        <span className="irow__icon"><ItemIcon db={db} ident={it[4]} size={40} /></span>
                        <span className="arow__main">
                          <span className="arow__top"><strong>{it[0]}</strong><span className="arow__gen">{it[1]}</span></span>
                          {it[3] && <span className="arow__desc">{it[3]}</span>}
                        </span>
                        <Chevron />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === 'lug' && (
              <PlacesView db={db} version={lugVersion} onVersion={pickLug} list={places} loading={lugState === 'loading'} failed={lugState === 'error'}
                onOpen={(sid, el) => open(sid, el)} />
            )}

            {(ready || active) && tab === 'nat' && (
              natures.length === 0 ? (
                <Empty>Diay, no hay ninguna naturaleza así.{otherHits.length > 0 && <Hits tabs={otherHits} counts={counts} onPick={setTab} />}</Empty>
              ) : (
                <>
                  <ul className="rows">
                    {natures.map(([id, n]) => {
                      const neutral = n[1] === n[2];
                      return (
                        <li key={id} className="reveal">
                          <div className={`nrow${neutral ? ' is-neutral' : ''}`}>
                            <strong className="nrow__name">{n[0]}</strong>
                            {neutral ? <span className="nrow__neutral">Neutral</span> : (
                              <span className="nrow__stats">
                                <span className="nrow__up">▲ {STAT_SHORT[n[1]]}</span>
                                <span className="nrow__down">▼ {STAT_SHORT[n[2]]}</span>
                              </span>
                            )}
                            {!neutral && <span className="nrow__flavor">Le gusta lo {FLAVORS[n[3]].toLowerCase()} · odia lo {FLAVORS[n[4]].toLowerCase()}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="note">Cada naturaleza sube un 10 % una estadística y baja un 10 % otra. Las neutrales no cambian nada.</p>
                </>
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
                          <span className="arow__top"><strong>{a[0]}</strong><span className="arow__gen">Gen. {GENS[a[2] - 1]}</span></span>
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

      {/* Búsqueda flotante (abajo a la izquierda) y botón para volver arriba */}
      <div className={`lsearch${past || listSearch ? ' is-on' : ''}${listSearch ? ' is-open' : ''}${q ? ' has-query' : ''}`}>
        <button className="lsearch__cap" onClick={openListSearch} aria-label="Buscar" tabIndex={past && !listSearch ? 0 : -1}>
          <SearchIcon />
        </button>
        <input
          ref={listInput}
          type="search"
          value={q}
          placeholder={`Buscar en ${TAB_LABEL[tab]}`}
          aria-label="Buscar en la lista"
          tabIndex={listSearch ? 0 : -1}
          onChange={(e) => { anchorList.current = true; setQuery(e.target.value); }}
          onFocus={() => setListSearch(true)}
          onBlur={() => setListSearch(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
          autoComplete="off"
          enterKeyHint="search"
        />
        {q && <ClearButton tabbable={listSearch} onClear={() => { anchorList.current = true; setQuery(''); }} />}
      </div>
      <button className={`fab-top${past && !listSearch ? ' is-on' : ''}`} onClick={toTop} aria-label="Volver al inicio" tabIndex={past ? 0 : -1}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

/* ---------- Piezas ---------- */

/** Panel que se despliega: al cerrar conserva su contenido; al cambiar de contenido, cambia de alto suavemente */
function Drawer({ open, which, variant, children }: { open: boolean; which: string; variant?: 'list'; children: (which: string) => ReactNode }) {
  const last = useRef(which);
  if (which) last.current = which;
  const shown = which || last.current; // al cerrarse, sigue mostrando lo último mientras se pliega
  const clip = useRef<HTMLDivElement>(null);
  const prevH = useRef(0);
  const prevShown = useRef(shown);
  useLayoutEffect(() => {
    const el = clip.current;
    if (!el) return;
    const h = el.offsetHeight;
    if (open && prevShown.current !== shown && prevH.current > 0 && !reducedMotion()) {
      el.animate([{ height: `${prevH.current}px` }, { height: `${h}px` }], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    }
    prevShown.current = shown;
    prevH.current = h;
  });
  return (
    <div className={`drawer${open ? ' is-open' : ''}${variant ? ` drawer--${variant}` : ''}`}>
      <div className="drawer__clip" ref={clip}>
        <div className="drawer__body">
          {shown && <div key={shown} className="drawer__content">{children(shown)}</div>}
        </div>
      </div>
    </div>
  );
}

/** Pokébola de tipos: la mitad de arriba y el símbolo del centro van cambiando de tipo */
function TypeBall({ db, selected }: { db: Db; selected: number[] }) {
  const all = useMemo(() => Object.keys(db.meta.types).map(Number), [db]);
  const pool = selected.length ? selected : all;
  const [i, setI] = useState(() => Math.floor(Math.random() * 18));
  useEffect(() => {
    if (selected.length) setI(0);
    if (pool.length < 2 || reducedMotion()) return;
    const t = window.setInterval(() => {
      if (document.hidden || document.documentElement.classList.contains('locked')) return;
      setI((x) => x + 1);
    }, 4200); // lento a propósito: que acompañe sin llamar la atención
    return () => window.clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.join()]);
  const t = pool[i % pool.length];
  const ident = db.meta.types[t]?.[1] ?? 'normal';
  const color = `var(--c-${ident})`;
  return (
    <svg className="tball" viewBox="0 0 40 40" aria-hidden>
      <path className="tball__top" d="M0 20a20 20 0 0 1 40 0Z" style={{ fill: color }} />
      <path d="M0 20a20 20 0 0 0 40 0Z" fill="#f6f5f2" />
      <rect x="0" y="18.4" width="40" height="3.2" fill="#0e1317" />
      <circle cx="20" cy="20" r="9.4" fill="#f6f5f2" stroke="#0e1317" strokeWidth="2.6" />
      <g key={`${t}-${i}`} className="tball__glyph" style={{ color, '--glyph-cut': '#f6f5f2' } as CSSProperties}>
        <svg x="13.25" y="13.25" width="13.5" height="13.5" viewBox="0 0 24 24">{glyphPaths(ident)}</svg>
      </g>
    </svg>
  );
}

function TypeGrid({ db, types, onToggle }: { db: Db; types: number[]; onToggle: (t: number) => void }) {
  return (
    <div className="typegrid">
      {Object.entries(db.meta.types).map(([id, [name, ident]]) => (
        <button key={id} className={`tchip t-${ident}${types.includes(+id) ? ' is-on' : ''}`} aria-pressed={types.includes(+id)} onClick={() => onToggle(+id)}>
          <svg className="tchip__glyph" viewBox="0 0 24 24" width="16" height="16" aria-hidden style={{ '--glyph-cut': `var(--c-${ident})` } as CSSProperties}>{glyphPaths(ident)}</svg>
          {name}
        </button>
      ))}
    </div>
  );
}

function DexGrid({ db, dexes, dex, onPick }: { db: Db; dexes: Dex[] | null; dex: number; onPick: (d: number) => void }) {
  if (!dexes) return <p className="dexgrid__loading">Cargando juegos…</p>;
  const gens = new Map<number, [Dex, number][]>();
  dexes.forEach((d, i) => { const g = db.meta.versionGroups.find((x) => x.id === d.vg)?.gen ?? 1; if (!gens.has(g)) gens.set(g, []); gens.get(g)!.push([d, i + 1]); });
  return (
    <div className="dexgrid">
      {[...gens].reverse().map(([g, list]) => (
        <div key={g} className="dexgrid__gen">
          <span className={`dexgrid__title rchip--g${g}`}>Generación {GENS[g - 1]}</span>
          <div className="dexgrid__row">
            {list.map(([d, i]) => (
              <button key={i} className={`rchip rchip--g${g} dexchip${dex === i ? ' is-on' : ''}`} aria-pressed={dex === i} onClick={() => onPick(i)}>
                <span className="dexchip__name">{dexPart(d) || dexGame(d)}</span>
                <span className="dexchip__sub">{dexPart(d) ? dexGame(d) : `${d.n.length} Pokémon`}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RegionGrid({ gen, onPick, plain }: { gen: number; onPick: (g: number) => void; plain?: boolean }) {
  return (
    <div className="regiongrid">
      {GENS.map((g, i) => (
        <button key={g} className={`rchip rchip--g${i + 1}${plain ? ' rchip--plain' : ''}${gen === i + 1 ? ' is-on' : ''}`} aria-pressed={gen === i + 1} onClick={() => onPick(i + 1)}>
          <span className="rchip__num">{g}</span>
          <span className="rchip__name">{REGIONS[i]}</span>
        </button>
      ))}
    </div>
  );
}

function ClearButton({ tabbable, onClear }: { tabbable: boolean; onClear: () => void }) {
  return (
    <button type="button" className="sbar__clear" tabIndex={tabbable ? 0 : -1} onPointerDown={(e) => e.preventDefault()} onClick={onClear} aria-label="Borrar búsqueda">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
    </button>
  );
}

function StarIcon({ filled, size = 24, className }: { filled?: boolean; size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
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

function PadButton({ label, color, on, open, onClick, children, ref, extraClass = '' }: {
  label: string; color: 'yellow' | 'white' | 'orange' | 'ball'; on: boolean; open?: boolean;
  onClick: () => void; children: ReactNode; ref?: Ref<HTMLButtonElement>; extraClass?: string;
}) {
  return (
    <button ref={ref} type="button" className={`pad pad--${color} ${extraClass}${on ? ' is-on' : ''}`} aria-expanded={open} onClick={onClick}>
      <span className="pad__cap">{children}</span>
      <span className="pad__label">{label}</span>
    </button>
  );
}
