import { uiZoom } from '../zoom';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Db } from '../types';
import { ClassGlyph } from './glyphs';

const SHEET = 960; // ancho de cada hoja de sprites (10 x 96 px)

/** Sprite recortado de la hoja correspondiente */
export function Sprite({ db, pid, size = 96, fallback, shiny, style, vt }: {
  db: Db; pid: number; size?: number; fallback?: number; shiny?: boolean; style?: CSSProperties; vt?: number;
}) {
  const pos = db.sprites[pid] ?? (fallback ? db.sprites[fallback] : undefined);
  if (!pos) return <div className="sprite sprite--empty" style={{ width: size, height: size, ...style }} aria-hidden />;
  const [sheet, i] = pos;
  const k = size / 96;
  return (
    <div
      className="sprite"
      aria-hidden
      data-vt={vt}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(sprites/${shiny ? 'ss' : 's'}${sheet}.webp)`,
        backgroundSize: `${SHEET * k}px auto`,
        backgroundPosition: `${-(i % 10) * 96 * k}px ${-Math.floor(i / 10) * 96 * k}px`,
        ...style,
      }}
    />
  );
}

/** Dibujo de un objeto (de la hoja items.webp, celdas de 60 px, 16 columnas) */
export function ItemIcon({ db, ident, size = 30 }: { db: Db; ident: string; size?: number }) {
  const i = db.itemSprites[ident];
  if (i == null) return <span className="item-icon item-icon--empty" style={{ width: size, height: size }} aria-hidden />;
  const k = size / 60;
  return (
    <span
      className="item-icon"
      aria-hidden
      style={{
        width: size, height: size, backgroundImage: 'url(sprites/items.webp)',
        backgroundSize: `${960 * k}px auto`, backgroundPosition: `${-(i % 16) * 60 * k}px ${-Math.floor(i / 16) * 60 * k}px`,
      }}
    />
  );
}

export const STAT_SHORT = ['', 'PS', 'Ataque', 'Defensa', 'At. Esp.', 'Def. Esp.', 'Velocidad'];
export const FLAVORS = ['', 'Picante', 'Seco', 'Dulce', 'Amargo', 'Ácido'];

export function TypeBadge({ db, id, small, style }: { db: Db; id: number; small?: boolean; style?: CSSProperties }) {
  const t = db.meta.types[id];
  if (!t) return null;
  return <span className={`type t-${t[1]}${small ? ' type--sm' : ''}`} style={style}>{t[0]}</span>;
}

const CLASS = { 1: ['Estado', 'cls-status'], 2: ['Físico', 'cls-phys'], 3: ['Especial', 'cls-spec'] } as const;
/** Categoría del movimiento como símbolo (el nombre queda como etiqueta accesible) */
export function MoveClass({ c, big }: { c: number; big?: boolean }) {
  const v = CLASS[c as 1 | 2 | 3];
  return v ? (
    <span className={`cls ${v[1]}${big ? ' cls--big' : ''}`} role="img" aria-label={v[0]} title={v[0]}>
      <ClassGlyph c={c} size={big ? 18 : 14} />
    </span>
  ) : null;
}

export function Ball({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 4a46 46 0 0 1 46 46H66a16 16 0 0 0-32 0H4A46 46 0 0 1 50 4Z" fill="currentColor" />
      <path d="M4 50h30a16 16 0 0 0 32 0h30a46 46 0 0 1-92 0Z" fill="currentColor" opacity=".35" />
      <circle cx="50" cy="50" r="10" fill="currentColor" />
    </svg>
  );
}

export const Spinner = () => <Ball className="spin-ball" size={28} />;

/** Botón de volver de la barra roja: dice "JuasDex" si atrás está la lista, "Atrás" si hay otra pantalla */
export function BackButton({ onClick }: { onClick: () => void }) {
  const deep = (history.state as { d?: number } | null)?.d ?? 0;
  return (
    <button className="nav-btn" onClick={onClick} aria-label="Volver">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>{deep > 1 ? 'Atrás' : 'JuasDex'}</span>
    </button>
  );
}

export const Chevron = () => (
  <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** Tarjetita de Pokémon (para listas de quién aprende un movimiento o tiene una habilidad) */
export function MiniMon({ db, pid, tag, onClick }: { db: Db; pid: number; tag?: ReactNode; onClick: () => void }) {
  const f = db.forms[pid];
  const species = f ? f[0] : pid;
  const e = db.index[species - 1];
  if (!e) return null;
  return (
    <button type="button" className={`mini t-${db.meta.types[e[2][0]]?.[1] ?? 'normal'}`} onClick={onClick}>
      <Sprite db={db} pid={pid} size={56} fallback={species} />
      <span className="mini__name">{e[1]}</span>
      {f && <span className="mini__form">{f[1]}</span>}
      {tag && <span className="mini__tag">{tag}</span>}
    </button>
  );
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Selector personalizado ---------- */
export interface Opt {
  value: number;
  label: string;
  hint?: string;
  icon?: ReactNode;
  group?: string;
  className?: string;
}

const useNarrow = () => {
  const [n, setN] = useState(() => window.matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const on = () => setN(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return n;
};

export function Picker({ title, value, options, onChange, layout = 'list', tone = 'plain', display, placeholder, searchable }: {
  title: string;
  value: number;
  options: Opt[];
  onChange: (v: number) => void;
  layout?: 'list' | 'grid';
  tone?: 'plain' | 'red';
  display?: ReactNode;
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const nq = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = nq ? options.filter((o) => fold(`${o.label} ${o.hint ?? ''} ${o.group ?? ''}`).includes(nq)) : options;
  const [shown, setShown] = useState(false); // para animar la salida
  const [pos, setPos] = useState<CSSProperties>({});
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();
  const current = options.find((o) => o.value === value);

  const show = () => {
    if (!narrow && btn.current) {
      // Todo en las medidas del panel (que también crece con el zoom de pantallas grandes)
      const z = uiZoom();
      const b = btn.current.getBoundingClientRect();
      const r = { left: b.left / z, top: b.top / z, bottom: b.bottom / z, width: b.width / z };
      const vw = window.innerWidth / z, vh = window.innerHeight / z;
      const width = Math.max(r.width, layout === 'grid' ? 340 : 300);
      const left = Math.min(Math.max(12, r.left), vw - width - 12);
      const below = vh - r.bottom;
      const maxHeight = Math.max(240, Math.min(440, below > 300 ? below - 20 : r.top - 20));
      setPos(below > 300 || below > r.top
        ? { left, width, top: r.bottom + 8, maxHeight, transformOrigin: 'top' }
        : { left, width, bottom: vh - r.top + 8, maxHeight, transformOrigin: 'bottom' });
    }
    setQuery('');
    setShown(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  const hide = (refocus = true) => {
    setOpen(false);
    window.setTimeout(() => setShown(false), reducedMotion() ? 0 : 220);
    if (refocus) btn.current?.focus();
  };

  useEffect(() => {
    if (!shown) return undefined;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    const away = (e: Event) => {
      if (!narrow && !panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) hide(false);
    };
    // Solo cerrar si cambia el ancho (girar el teléfono). Cuando sale el teclado cambia solo el alto: no cerrar.
    const w0 = window.innerWidth;
    const onResize = () => { if (Math.abs(window.innerWidth - w0) > 40) hide(false); };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', away);
    window.addEventListener('resize', onResize);
    if (narrow) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, narrow]);

  // Al montar (antes de animar): llevar la opción elegida a la vista sin mover la página
  useLayoutEffect(() => {
    if (!shown || !panel.current) return;
    const sel = panel.current.querySelector<HTMLElement>('.is-sel');
    if (sel) panel.current.scrollTop = sel.offsetTop - panel.current.clientHeight / 2 + sel.offsetHeight / 2;
  }, [shown]);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if (searchable) panel.current?.querySelector<HTMLInputElement>('.pop__search')?.focus({ preventScroll: true });
      else (panel.current?.querySelector<HTMLElement>('.is-sel') ?? panel.current?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    }, 320);
    return () => window.clearTimeout(t);
  }, [open]);

  let lastGroup = '';
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`picker picker--${tone}${shown ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={shown}
        onClick={() => (shown ? hide() : show())}
      >
        <span className="picker__value">{display ?? current?.label ?? placeholder}</span>
        <svg className="picker__chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {shown && createPortal(
        <div className={`pop${narrow ? ' pop--sheet' : ''}${open ? ' is-open' : ''}`}>
          {narrow && <div className="pop__backdrop" onClick={() => hide()} />}
          <div ref={panel} className="pop__panel" style={narrow ? undefined : pos} role="listbox" aria-label={title}>
            {narrow && <div className="pop__grip" aria-hidden />}
            <div className="pop__title">{title}</div>
            {searchable && (
              <input className="pop__search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" aria-label={`Buscar en ${title}`} autoComplete="off" />
            )}
            <div className={`pop__opts pop__opts--${layout}`}>
              {visible.length === 0 && <div className="pop__none">Nada coincide.</div>}
              {visible.map((o) => {
                const header = o.group && o.group !== lastGroup ? o.group : '';
                if (o.group) lastGroup = o.group;
                return (
                  <FragmentGroup key={o.value} header={header}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.value === value}
                      className={`opt ${o.className ?? ''}${o.value === value ? ' is-sel' : ''}`}
                                            onClick={() => { onChange(o.value); hide(); }}
                    >
                      {o.icon}
                      <span className="opt__text">
                        <span className="opt__label">{o.label}</span>
                        {o.hint && <span className="opt__hint">{o.hint}</span>}
                      </span>
                      {o.value === value && layout === 'list' && (
                        <svg className="opt__check" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </button>
                  </FragmentGroup>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function FragmentGroup({ header, children }: { header: string; children: ReactNode }) {
  return header ? <><div className="pop__group">{header}</div>{children}</> : <>{children}</>;
}

export const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
export const GENS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const GEN_STARTER = [1, 152, 252, 387, 495, 650, 722, 810, 906];
export const GEN_RANGE = ['1–151', '152–251', '252–386', '387–493', '494–649', '650–721', '722–809', '810–905', '906–1025'];
