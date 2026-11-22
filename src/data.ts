import type { Db, Species } from './types';

const getJson = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.json() as Promise<T>;
};

export const loadDb = async (): Promise<Db> => {
  const [index, meta, moves, abilities, sprites] = await Promise.all([
    getJson<Db['index']>('data/index.json'),
    getJson<Db['meta']>('data/meta.json'),
    getJson<Db['moves']>('data/moves.json'),
    getJson<Db['abilities']>('data/abilities.json'),
    getJson<Db['sprites']>('data/sprite-map.json'),
  ]);
  return { index, meta, moves, abilities, sprites };
};

const chunks = new Map<number, Promise<Record<string, Species>>>();

export const loadSpecies = async (id: number, chunkSize: number): Promise<Species> => {
  const c = Math.floor((id - 1) / chunkSize);
  if (!chunks.has(c)) {
    const p = getJson<Record<string, Species>>(`data/p/${c}.json`);
    p.catch(() => chunks.delete(c));
    chunks.set(c, p);
  }
  const data = await chunks.get(c)!;
  return data[id];
};

/** Multiplicador de daño que recibe una combinación de tipos */
export const defense = (db: Db, defTypes: number[]) => {
  const out: Record<number, number> = {};
  for (const atk of Object.keys(db.meta.types)) {
    let f = 1;
    for (const d of defTypes) f *= db.meta.chart[atk]?.[d] ?? 1;
    out[+atk] = f;
  }
  return out;
};

export const pad = (n: number) => String(n).padStart(4, '0');
export const fmt = (n: number, digits = 1) => n.toLocaleString('es', { maximumFractionDigits: digits });

// Pequeño almacenamiento local con try/catch (puede no existir)
export const store = {
  get<T>(k: string, def: T): T {
    try { const v = localStorage.getItem('juasdex:' + k); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
  },
  set(k: string, v: unknown) {
    try { localStorage.setItem('juasdex:' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
  },
};
