// Navegación por el hash (#pokemon-25, #mov-89, #hab-26).
// Cada pantalla que se abre se apila en el historial; "atrás" la quita.
// Anterior/siguiente reemplazan la pantalla actual para no llenar el historial.

export type RouteKind = 'pokemon' | 'mov' | 'hab' | 'obj' | 'equipo' | 'equipos' | 'importar' | 'generar';
export type Route = { kind: RouteKind; id: number; data?: string } | null;

export const parseRoute = (hash = location.hash): Route => {
  if (hash === '#equipos') return { kind: 'equipos', id: 0 };
  if (hash === '#generar') return { kind: 'generar', id: 0 };
  const imp = hash.match(/^#importar-([A-Za-z0-9_-]+)$/);
  if (imp) return { kind: 'importar', id: 0, data: imp[1] };
  const m = hash.match(/^#(pokemon|mov|hab|obj|equipo)-(\d+)$/);
  return m ? { kind: m[1] as RouteKind, id: Number(m[2]) } : null;
};

const depth = () => (history.state as { d?: number } | null)?.d ?? 0;
const fire = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const setDir = (dir: string) => { document.documentElement.dataset.nav = dir; };
const url = (hash: string) => (hash ? `#${hash}` : location.pathname + location.search);

export const nav = {
  /** Abre una pantalla nueva encima */
  push(hash: string, dir = '') {
    setDir(dir);
    history.pushState({ d: depth() + 1 }, '', url(hash));
    fire();
  },
  /** Cambia la pantalla actual sin apilar */
  replace(hash: string, dir = '') {
    setDir(dir);
    history.replaceState({ d: depth() }, '', url(hash));
    fire();
  },
  /** Vuelve a la pantalla anterior (o a la lista si se entró directo por un enlace) */
  back() {
    setDir('');
    if (depth() > 0) history.back();
    else nav.replace('');
  },
  /** Vuelve hasta la lista */
  home() {
    setDir('');
    const d = depth();
    if (d > 0) history.go(-d);
    else nav.replace('');
  },
  depth,
};
