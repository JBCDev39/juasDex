import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Db, EvoNode, Species, Variety } from '../types';
import { defense, fmt, loadSpecies, pad, store } from '../data';
import { GENS, MoveClass, Picker, REGIONS, Spinner, Sprite, TypeBadge, go, reducedMotion, type Opt } from './bits';
import { animateSheet, flight, fly } from '../flight';

const TABS = ['Datos', 'Debilidades', 'Movimientos', 'Ubicación'] as const;
type Tab = (typeof TABS)[number];
const ident = (db: Db, t: number) => db.meta.types[t]?.[1] ?? 'normal';

const useNarrow = () => {
  const q = '(max-width: 520px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
};

export default function Detail({ db, id, closing, onClosed }: { db: Db; id: number; closing: boolean; onClosed: () => void }) {
  const narrow = useNarrow();
  const sheet = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const firstId = useRef(id);
  const [dir] = useState(() => ({ current: '' }));
  dir.current = document.documentElement.dataset.nav ?? '';

  // Entrada: la capa sube y el sprite vuela desde la tarjeta tocada
  useLayoutEffect(() => {
    if (entered.current || !sheet.current) return;
    entered.current = true;
    const hero = sheet.current.querySelector<HTMLElement>('.hero__sprite .sprite');
    const src = flight.id === id ? flight.el : null;
    flight.el = null;
    if (src && hero) void fly(src, hero, 440);
    void animateSheet(sheet.current, 'in');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mientras la ficha está abierta, la página de atrás no se mueve
  useEffect(() => {
    document.documentElement.classList.add('locked');
    return () => document.documentElement.classList.remove('locked');
  }, []);

  // Salida: la capa baja y el sprite vuelve a su tarjeta (si está a la vista)
  useLayoutEffect(() => {
    if (!closing || !sheet.current) return;
    document.documentElement.classList.remove('locked');
    const hero = sheet.current.querySelector<HTMLElement>('.hero__sprite .sprite');
    const card = document.querySelector<HTMLElement>(`[data-card="${id}"] .sprite`);
    const jobs: Promise<void>[] = [animateSheet(sheet.current, 'out')];
    if (hero && card) jobs.push(fly(hero, card, 400));
    void Promise.all(jobs).then(onClosed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  const back = () => {
    if (flight.fromList) { flight.fromList = false; history.back(); }
    else go('', '', true);
  };
  const [sp, setSp] = useState<Species | null>(null);
  const [failed, setFailed] = useState(false);
  const [vi, setVi] = useState(0);
  const [shiny, setShiny] = useState(false);
  const [hop, setHop] = useState(0);
  const [tab, setTab] = useState<Tab>(() => {
    const t = store.get<string>('tab', 'Datos');
    return (TABS as readonly string[]).includes(t) ? (t as Tab) : 'Datos';
  });
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setVi(0);
    loadSpecies(id, db.meta.chunk).then((s) => alive && setSp(s)).catch(() => alive && setFailed(true));
    if (id !== firstId.current && sheet.current) sheet.current.scrollTop = 0;
    firstId.current = -1;
    store.set('last', id);
    store.set('recent', [id, ...store.get<number[]>('recent', []).filter((x) => x !== id)].slice(0, 5));
    return () => { alive = false; };
  }, [db, id]);

  const chooseTab = (t: Tab) => { setTab(t); store.set('tab', t); };
  const total = db.index.length;
  // Anterior/siguiente reemplazan el historial: "atrás" siempre regresa a la lista
  const prev = () => id > 1 && go(`pokemon-${id - 1}`, 'prev', true);
  const next = () => id < total && go(`pokemon-${id + 1}`, 'next', true);

  // Teclado: flechas para cambiar de Pokémon
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, .pop')) return;
      if (e.key === 'Escape' && !document.querySelector('.pop')) back();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const entry = db.index[id - 1];
  const v = sp?.id === id ? sp.varieties[vi] ?? sp.varieties[0] : undefined;
  const types = v?.types ?? entry[2];
  const tags = sp?.id === id ? [sp.legendary && 'Legendario', sp.mythical && 'Singular', sp.baby && 'Bebé'].filter(Boolean) as string[] : [];

  return (
    <div ref={sheet} className={`sheet detail t-bg-${ident(db, types[0])}`} role="dialog" aria-modal="true" aria-label={entry[1]}>
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row">
          <button className="nav-btn" onClick={back} aria-label="Volver">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>JuasDex</span>
          </button>
          <div className="nav-arrows">
            <button className="nav-btn" disabled={id <= 1} onClick={prev} aria-label="Anterior">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button className="nav-btn" disabled={id >= total} onClick={next} aria-label="Siguiente">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      </header>

      <div key={id} className={`sheet__content from-${entered.current ? dir.current || 'none' : 'start'}`}>
      <section
        className="hero"
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const s = touch.current; touch.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) (dx < 0 ? next() : prev());
        }}
      >
        <div className="screen">
          <div className={`screen__glass${shiny ? ' is-shiny' : ''}`}>
            <button
              key={hop}
              type="button"
              className={`hero__sprite${hop ? ' hop' : ''}`}
              onClick={() => setHop((h) => h + 1)}
              aria-label={`Tocar a ${entry[1]}`}
            >
              <span className="float"><Sprite db={db} pid={v?.pid ?? id} size={narrow ? 120 : 192} fallback={id} shiny={shiny} /></span>
            </button>
            <button
              type="button"
              className={`shiny-btn${shiny ? ' is-on' : ''}`}
              aria-pressed={shiny}
              aria-label="Ver variocolor"
              title="Variocolor"
              onClick={() => setShiny((s) => !s)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4Z" fill="currentColor" /><path d="M19 2l.8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8Z" fill="currentColor" /></svg>
            </button>
            {shiny && <span key={`b${vi}${id}`} className="burst" aria-hidden><i /><i /><i /><i /><i /><i /></span>}
          </div>
          <div className="hero__info">
            <span className="hero__num">#{pad(id)}</span>
            <h2 className="hero__name">{v && vi > 0 ? v.name : entry[1]}</h2>
            {vi > 0 && <span className="hero__form">{entry[1]}</span>}
            {sp?.genus && sp.id === id && <span className="hero__genus">{sp.genus}</span>}
            <div className="hero__types">
              {types.map((t, i) => <TypeBadge key={`${id}-${t}`} db={db} id={t} style={{ '--i': i } as CSSProperties} />)}
            </div>
            {tags.length > 0 && <div className="hero__tags">{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
          </div>
        </div>
        {sp && sp.id === id && sp.varieties.length > 1 && (
          <div className="forms" role="group" aria-label="Formas">
            {sp.varieties.map((x, i) => (
              <button key={x.pid} className={`chip${i === vi ? ' is-on' : ''}`} onClick={() => setVi(i)}>{i === 0 ? 'Normal' : x.name}</button>
            ))}
          </div>
        )}
      </section>

      <Tabs tab={tab} onChange={chooseTab} />

      <main className="body">
        {failed && <div className="empty">No se pudieron cargar los datos. ¿Tiene conexión? Intente de nuevo.</div>}
        {!failed && (!sp || !v) && <div className="empty"><Spinner /> Cargando…</div>}
        {sp && v && sp.id === id && (
          <div key={`${tab}-${id}-${vi}`} className="tab-panel">
            {tab === 'Datos' && <Info db={db} sp={sp} v={v} />}
            {tab === 'Debilidades' && <Weak db={db} v={v} />}
            {tab === 'Movimientos' && <Moves db={db} v={v} />}
            {tab === 'Ubicación' && <Where db={db} v={v} />}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

/* ---------- Pestañas con indicador deslizante ---------- */
function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<CSSProperties>({ opacity: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLElement>('.tab.is-on');
      if (el) setBar({ transform: `translateX(${el.offsetLeft}px)`, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [tab]);
  return (
    <nav className="tabs" aria-label="Secciones">
      <div className="tabs__inner" ref={wrap}>
        {TABS.map((t) => (
          <button key={t} className={`tab${t === tab ? ' is-on' : ''}`} onClick={() => onChange(t)}>{t}</button>
        ))}
        <span className="tabs__bar" style={bar} aria-hidden />
      </div>
    </nav>
  );
}

/* ---------- Datos ---------- */
const STAT_NAMES = ['PS', 'Ataque', 'Defensa', 'At. Esp.', 'Def. Esp.', 'Velocidad'];
const STAT_LONG = ['PS', 'Ataque', 'Defensa', 'Ataque Especial', 'Defensa Especial', 'Velocidad'];
const tier = (t: number) =>
  t >= 600 ? '¡Qué bestia!' : t >= 500 ? 'Qué chiva' : t >= 420 ? 'Tuanis' : t >= 320 ? 'Ahí va' : 'Todavía es un chiquito';
const captureLabel = (r: number) =>
  r <= 3 ? 'Prepare muchas Ultra Balls' : r <= 25 ? 'Cuesta un montón' : r <= 60 ? 'Hay que sudarla' : r <= 120 ? 'Nada del otro mundo' : r <= 200 ? 'Fácil' : 'Pan comido';

function Info({ db, sp, v }: { db: Db; sp: Species; v: Variety }) {
  const tot = v.stats.reduce((a, b) => a + b, 0);
  const best = v.stats.indexOf(Math.max(...v.stats));
  return (
    <div className="stack-gap">
      <section className="dexentry">
        <div className="dexentry__head">
          <span className="dexentry__led" aria-hidden />
          <span>Entrada de la Pokédex</span>
        </div>
        <Typewriter text={sp.flavor || `Todavía no hay entrada en español para ${sp.name}. ¡Diay, paciencia!`} />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h3>Estadísticas base</h3>
          <span className="pill">{tier(tot)}</span>
        </div>
        <div className="stats-wrap">
          <Radar stats={v.stats} />
          <div className="stats">
            {v.stats.map((s, i) => (
              <div key={i} className={`stat${i === best ? ' is-best' : ''}`} style={{ '--i': i } as CSSProperties}>
                <span className="stat__name">{STAT_NAMES[i]}</span>
                <span className="stat__val">{s}</span>
                <span className="stat__bar"><i style={{ width: `${Math.min(100, (s / 200) * 100)}%` }} className={s >= 120 ? 'hi' : s >= 80 ? 'mid' : s >= 50 ? 'low' : 'vlow'} /></span>
              </div>
            ))}
            <div className="stat stat--total"><span className="stat__name">Total</span><span className="stat__val">{tot}</span><span className="stat__note">Su fuerte: {STAT_LONG[best]}</span></div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Línea evolutiva</h3>
        {sp.chain.n.length ? <EvoTree db={db} node={sp.chain} current={sp.id} /> : <p className="muted">{sp.name} no evoluciona. Así como está, está bien.</p>}
      </section>

      <section className="panel">
        <h3>Habilidades</h3>
        <ul className="abilities">
          {v.abil.map(([aid, hidden], i) => {
            const a = db.abilities[aid];
            return (
              <li key={aid} className={hidden ? 'is-hidden' : ''} style={{ '--i': i } as CSSProperties}>
                <div className="abilities__top">
                  <strong>{a?.[0] ?? '¿?'}</strong>
                  {hidden ? <span className="hidden-tag">Oculta</span> : null}
                </div>
                {a?.[1] && <p>{a[1]}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="duo">
        <section className="panel">
          <h3>Tamaño</h3>
          <SizeCompare db={db} v={v} />
        </section>
        <section className="panel">
          <h3>Crianza y captura</h3>
          <Gender rate={sp.gender} />
          <div className="capture">
            <div className="capture__top"><span>Captura</span><strong>{captureLabel(sp.capture)}</strong></div>
            <div className="meter"><i style={{ width: `${(sp.capture / 255) * 100}%` }} /></div>
            <span className="muted small">Ratio {sp.capture} de 255</span>
          </div>
          <dl className="facts">
            <div><dt>Grupos huevo</dt><dd>{sp.egg.join(', ') || '—'}</dd></div>
            <div><dt>Ciclos de eclosión</dt><dd>{sp.hatch ?? '—'}</dd></div>
            <div><dt>Amistad base</dt><dd>{sp.happy ?? '—'}</dd></div>
            <div><dt>Región</dt><dd>{REGIONS[sp.gen - 1]} · Gen. {GENS[sp.gen - 1]}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (reducedMotion()) { setN(text.length); return; }
    setN(0);
    let i = 0, t = 0;
    const start = window.setTimeout(() => {
      t = window.setInterval(() => { i += 2; setN(i); if (i >= text.length) window.clearInterval(t); }, 22);
    }, 380); // espera a que termine la entrada
    return () => { window.clearTimeout(start); window.clearInterval(t); };
  }, [text]);
  const done = n >= text.length;
  return (
    <p className="dexentry__text" onClick={() => setN(text.length)}>
      <span>{text.slice(0, n)}</span>
      <span className={`caret${done ? ' is-done' : ''}`} aria-hidden />
      <span className="dexentry__ghost" aria-hidden>{text.slice(n)}</span>
    </p>
  );
}

function Radar({ stats }: { stats: number[] }) {
  // Orden de los juegos: PS arriba, luego Ataque, Defensa, Velocidad, Def. Esp., At. Esp.
  const order = [0, 1, 2, 5, 4, 3];
  const labels = ['PS', 'Atq', 'Def', 'Vel', 'DEsp', 'AEsp'];
  const cx = 130, cy = 116, R = 78;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = order.map((s, i) => pt(i, (Math.min(stats[s], 180) / 180) * R).join(',')).join(' ');
  return (
    <svg className="radar" viewBox="0 0 260 232" role="img" aria-label="Gráfico de estadísticas">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={order.map((_, i) => pt(i, R * k).join(',')).join(' ')} className="radar__ring" />
      ))}
      {order.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar__axis" />; })}
      <polygon points={poly} className="radar__shape" />
      {order.map((s, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={i} x={x} y={y} className="radar__label" textAnchor="middle" dominantBaseline="middle">
            <tspan x={x} dy="-0.45em">{labels[i]}</tspan>
            <tspan x={x} dy="1.15em" className="radar__num">{stats[s]}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

function SizeCompare({ db, v }: { db: Db; v: Variety }) {
  const H = 150;
  const h = v.h / 10, trainer = 1.6;
  const maxM = Math.max(trainer, h) * 1.08;
  const px = H / maxM;
  const spriteSize = Math.max(28, Math.min(H / 0.78, (h * px) / 0.78));
  const tH = Math.max(6, trainer * px);
  return (
    <div className="size">
      <div className="size__stage" style={{ height: H + 8 }}>
        <div className="size__fig">
          <svg className="size__trainer" viewBox="0 0 40 100" style={{ height: tH }} aria-hidden>
            <circle cx="20" cy="11" r="10" />
            <path d="M8 26c0-3 3-5 6-5h12c3 0 6 2 6 5v30c0 2-2 3-4 3h-1v38c0 2-2 3-4 3h-3c-2 0-3-1-3-3V65h-2v32c0 2-1 3-3 3h-3c-2 0-4-1-4-3V59h-1c-2 0-4-1-4-3Z" />
          </svg>
          <span>Entrenador · 1,6 m</span>
        </div>
        <div className="size__fig">
          <Sprite db={db} pid={v.pid} size={Math.round(spriteSize)} />
          <span>{fmt(h)} m</span>
        </div>
      </div>
      <div className="size__row">
        <div><span className="muted small">Altura</span><strong>{fmt(h)} m</strong></div>
        <div><span className="muted small">Peso</span><strong>{fmt(v.w / 10)} kg</strong></div>
      </div>
    </div>
  );
}

function Gender({ rate }: { rate: number }) {
  if (rate < 0) return <div className="gender"><div className="gender__bar is-none"><i style={{ width: '100%' }} /></div><span className="muted small">Sin género</span></div>;
  const f = (rate / 8) * 100, m = 100 - f;
  return (
    <div className="gender">
      <div className="gender__labels"><span className="m">♂ {fmt(m)} %</span><span className="f">♀ {fmt(f)} %</span></div>
      <div className="gender__bar"><i className="m" style={{ width: `${m}%` }} /><i className="f" style={{ width: `${f}%` }} /></div>
    </div>
  );
}

/* ---------- Evolución ---------- */
// Cadenas lineales en fila; las ramas (como Eevee) en cuadrícula.
// La condición para evolucionar va dentro de la tarjeta del Pokémon que resulta.
function EvoTree({ db, node, current, rootHow, depth = 0 }: { db: Db; node: EvoNode; current: number; rootHow?: boolean; depth?: number }) {
  const line: EvoNode[] = [node];
  let cur = node;
  while (cur.n.length === 1) { cur = cur.n[0]; line.push(cur); }
  return (
    <div className="evo">
      <div className="evo__line">
        {line.map((x, i) => (
          <Fragment key={x.id}>
            {i > 0 && <Arrow />}
            <EvoCard db={db} id={x.id} current={current} i={depth + i} how={i > 0 || rootHow ? x.c : undefined} />
          </Fragment>
        ))}
      </div>
      {cur.n.length > 1 && (
        <>
          <Arrow down />
          <div className="evo__fork">
            {cur.n.map((k, j) => {
              let len = 1, c = k; while (c.n.length === 1) { c = c.n[0]; len++; }
              return (
                <div key={k.id} className={`evo__branch${len > 1 || c.n.length > 1 ? ' is-wide' : ''}`}>
                  <EvoTree db={db} node={k} current={current} rootHow depth={depth + line.length + j} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
function Arrow({ down }: { down?: boolean }) {
  return (
    <span className={`evo__arrow${down ? ' is-down' : ''}`} aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20"><path d={down ? 'M12 4v15m-6-6 6 6 6-6' : 'M4 12h15m-6-6 6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}
function EvoCard({ db, id, current, i, how }: { db: Db; id: number; current: number; i: number; how?: string[] }) {
  const e = db.index[id - 1];
  return (
    <button className={`evo__card${id === current ? ' is-on' : ''}`} style={{ '--i': Math.min(i, 10) } as CSSProperties} onClick={() => id !== current && go(`pokemon-${id}`, '', true)}>
      <Sprite db={db} pid={id} size={60} />
      <span className="evo__name">{e?.[1]}</span>
      <span className="evo__types">{e?.[2].map((t) => <i key={t} className={`dot t-${ident(db, t)}`} />)}</span>
      {how && <span className="evo__how">{how.length ? how.join(' · ') : 'Condición especial'}</span>}
    </button>
  );
}

/* ---------- Debilidades ---------- */
const GROUPS: [number, string, string][] = [
  [4, '×4', 'Muy débil'], [2, '×2', 'Débil'], [1, '×1', 'Normal'], [0.5, '×½', 'Resiste'], [0.25, '×¼', 'Resiste mucho'], [0, '×0', 'Inmune'],
];
function Weak({ db, v }: { db: Db; v: Variety }) {
  const d = defense(db, v.types);
  let k = 0;
  return (
    <div className="stack-gap">
      {GROUPS.map(([f, mult, label]) => {
        const list = Object.entries(d).filter(([, x]) => x === f).map(([t]) => +t);
        if (!list.length) return null;
        return (
          <section key={f} className={`weak weak--${String(f).replace('.', '')}`}>
            <div className="weak__mult"><strong>{mult}</strong><span>{label}</span></div>
            <div className="badges">{list.map((t) => <TypeBadge key={t} db={db} id={t} style={{ '--i': k++ } as CSSProperties} />)}</div>
          </section>
        );
      })}
      <p className="note">Daño que recibe según la tabla de tipos actual (desde la 6.ª generación). No tiene en cuenta habilidades como Levitación o Absorbe Agua.</p>
    </div>
  );
}

/* ---------- Movimientos ---------- */
const METHODS: [number, string][] = [[1, 'Nivel'], [4, 'MT / MO'], [2, 'Huevo'], [3, 'Tutor']];
function Moves({ db, v }: { db: Db; v: Variety }) {
  const games = db.meta.versionGroups.filter((g) => v.moves[g.id]?.length);
  const [vg, setVg] = useState<number>(() => store.get('vg', 0));
  const [method, setMethod] = useState(1);
  const game = games.find((g) => g.id === vg) ?? games.find((g) => g.id === 25) ?? games[games.length - 1];
  const all = game ? v.moves[game.id] : [];
  const counts = useMemo(() => Object.fromEntries(METHODS.map(([m]) => [m, all.filter((x) => x[1] === m).length])), [all]);
  const active = counts[method] ? method : (METHODS.find(([m]) => counts[m])?.[0] ?? 1);
  const rows = all.filter((x) => x[1] === active);
  const idx = METHODS.findIndex(([m]) => m === active);

  if (!game) return <div className="empty">No hay datos de movimientos para esta forma.</div>;
  const opts: Opt[] = [...games].reverse().map((g) => ({ value: g.id, label: g.name, group: `Generación ${GENS[g.gen - 1]}` }));
  return (
    <div className="stack-gap">
      <div className="field">
        <span>Juego</span>
        <Picker title="Elija un juego" value={game.id} options={opts} onChange={(x) => { setVg(x); store.set('vg', x); }} />
      </div>
      <div className="seg" role="group" aria-label="Forma de aprendizaje" style={{ '--idx': idx } as CSSProperties}>
        <span className="seg__pill" aria-hidden />
        {METHODS.map(([m, label]) => (
          <button key={m} className={`seg__btn${m === active ? ' is-on' : ''}`} disabled={!counts[m]} onClick={() => setMethod(m)}>
            {label} <small>{counts[m]}</small>
          </button>
        ))}
      </div>
      <div className="moves" key={`${game.id}-${active}`}>
        <div className="moves__head">
          <span>{active === 1 ? 'Nv.' : active === 4 ? 'MT' : ''}</span><span>Movimiento</span><span>Pot.</span><span>Prec.</span><span>PP</span>
        </div>
        {rows.map(([mid, , extra], i) => {
          const m = db.moves[mid];
          if (!m) return null;
          const lvl = active === 1 ? (extra === 0 ? 'Evo' : extra) : active === 4 ? extra : '';
          return (
            <div key={`${mid}-${i}`} className={`move t-${ident(db, m[1])}`} style={{ '--i': Math.min(i, 16) } as CSSProperties}>
              <span className="move__lvl">{lvl}</span>
              <span className="move__name">
                <strong>{m[0]}</strong>
                <span className="move__meta"><TypeBadge db={db} id={m[1]} small /><MoveClass c={m[2]} /></span>
              </span>
              <span className="move__n">{m[3] ?? '—'}</span>
              <span className="move__n">{m[4] ?? '—'}</span>
              <span className="move__n">{m[5] ?? '—'}</span>
            </div>
          );
        })}
      </div>
      {active === 1 && rows.some((r) => r[2] === 0) && <p className="note">«Evo» = lo aprende al evolucionar.</p>}
    </div>
  );
}

/* ---------- Ubicación ---------- */
const NO_DATA = 'Diamante Brillante / Perla Reluciente, Leyendas: Arceus, Escarlata / Púrpura y Leyendas: Z-A';
function Where({ db, v }: { db: Db; v: Variety }) {
  const order = new Map(db.meta.versionGroups.map((g, i) => [g.id, i]));
  const vers = Object.keys(v.enc).map(Number)
    .sort((a, b) => (order.get(db.meta.versions[a][1]) ?? 99) - (order.get(db.meta.versions[b][1]) ?? 99) || a - b);
  const [ver, setVer] = useState<number>(() => store.get('ver', 0));
  const current = vers.includes(ver) ? ver : vers[vers.length - 1];
  const genOf = (x: number) => db.meta.versionGroups.find((g) => g.id === db.meta.versions[x][1])?.gen ?? 1;
  const opts: Opt[] = [...vers].reverse().map((x) => ({ value: x, label: db.meta.versions[x][0], group: `Generación ${GENS[genOf(x) - 1]}` }));

  return (
    <div className="stack-gap">
      {vers.length === 0 ? (
        <div className="empty">No hay lugares registrados para esta forma. Puede que solo se consiga evolucionando, por evento o en juegos sin datos.</div>
      ) : (
        <>
          <div className="field">
            <span>Juego</span>
            <Picker title="Elija un juego" value={current} options={opts} onChange={(x) => { setVer(x); store.set('ver', x); }} />
          </div>
          <ul className="places" key={current}>
            {v.enc[current].map(([place, method, min, max, rate], i) => (
              <li key={i} className="place" style={{ '--i': Math.min(i, 16) } as CSSProperties}>
                <span className="place__pin" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" fill="currentColor" /><circle cx="12" cy="10" r="2.6" fill="var(--card)" /></svg>
                </span>
                <span className="place__body">
                  <strong>{place}</strong>
                  <span className="place__meta">
                    <span>{method}</span>
                    <span>Nv. {min === max ? min : `${min}–${max}`}</span>
                    {rate > 0 && rate <= 100 && <span>{rate} %</span>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="note">Todavía no hay datos de ubicación para {NO_DATA}. Algunos lugares aparecen con su nombre en inglés.</p>
    </div>
  );
}
