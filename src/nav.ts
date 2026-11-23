// Navegación por el hash (#pokemon-25, #mov-89, #hab-26).
// Cada pantalla que se abre se apila en el historial; "atrás" la quita.
// Anterior/siguiente reemplazan la pantalla actual para no llenar el historial.

export type Route = { kind: 'pokemon' | 'mov' | 'hab'; id: number } | null;

export const parseRoute = (hash = location.hash): Route => {
  const m = hash.match(/^#(pokemon|mov|hab)-(\d+)$/);
  return m ? { kind: m[1] as 'pokemon' | 'mov' | 'hab', id: Number(m[2]) } : null;
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
