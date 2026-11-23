import type { Db, MoveInfo, Species, Team } from './types';

const getJson = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.json() as Promise<T>;
};

export const loadDb = async (): Promise<Db> => {
  const [index, meta, moves, abilities, sprites, forms, items, itemSprites, natures] = await Promise.all([
    getJson<Db['index']>('data/index.json'),
    getJson<Db['meta']>('data/meta.json'),
    getJson<Db['moves']>('data/moves.json'),
    getJson<Db['abilities']>('data/abilities.json'),
    getJson<Db['sprites']>('data/sprite-map.json'),
    getJson<Db['forms']>('data/forms.json'),
    getJson<Db['items']>('data/items.json'),
    getJson<Db['itemSprites']>('data/item-sprite-map.json'),
    getJson<Db['natures']>('data/natures.json'),
  ]);
  return { index, meta, moves, abilities, sprites, forms, items, itemSprites, natures };
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

/** Datos que solo se cargan al abrir un movimiento o una habilidad */
let moveExtra: Promise<{ info: Record<string, MoveInfo>; learners: Record<string, [number, number][]> }> | null = null;
export const loadMoveExtra = () => (moveExtra ??= Promise.all([
  getJson<Record<string, MoveInfo>>('data/move-info.json'),
  getJson<Record<string, [number, number][]>>('data/move-learners.json'),
]).then(([info, learners]) => ({ info, learners })).catch((e) => { moveExtra = null; throw e; }));

let holders: Promise<Record<string, [number, number][]>> | null = null;
export const loadHolders = () => (holders ??= getJson<Record<string, [number, number][]>>('data/ability-holders.json')
  .catch((e) => { holders = null; throw e; }));

let vgDex: Promise<Record<string, number[]>> | null = null;
export const loadVgDex = () => (vgDex ??= getJson<Record<string, number[]>>('data/vg-dex.json').catch((e) => { vgDex = null; throw e; }));

/** Nombre y especie de cualquier Pokémon o forma */
export const pidInfo = (db: Db, pid: number): { species: number; name: string; form?: string } => {
  const f = db.forms[pid];
  if (f) return { species: f[0], name: db.index[f[0] - 1]?.[1] ?? '', form: f[1] };
  return { species: pid, name: db.index[pid - 1]?.[1] ?? '' };
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

/* Favoritos: se guardan en este aparato */
export const favs = {
  list: () => store.get<number[]>('favs', []),
  has: (id: number) => favs.list().includes(id),
  toggle(id: number) {
    const l = favs.list();
    const next = l.includes(id) ? l.filter((x) => x !== id) : [...l, id].sort((a, b) => a - b);
    store.set('favs', next);
    return next.includes(id);
  },
};

/* Equipos: se guardan en este aparato */
export const teams = {
  list: () => store.get<Team[]>('teams', []),
  get: (id: number) => teams.list().find((t) => t.id === id) ?? null,
  save(team: Team) {
    const l = teams.list();
    const i = l.findIndex((t) => t.id === team.id);
    if (i >= 0) l[i] = team; else l.push(team);
    store.set('teams', l);
  },
  remove(id: number) { store.set('teams', teams.list().filter((t) => t.id !== id)); },
  /** Guarda un equipo nuevo (por ejemplo, importado) y devuelve su id */
  add(t: Omit<Team, 'id'>): Team {
    const l = teams.list();
    const team: Team = { ...t, id: l.reduce((m, x) => Math.max(m, x.id), 0) + 1 };
    teams.save(team);
    return team;
  },
  create(): Team {
    const l = teams.list();
    const id = l.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    const team: Team = { id, name: `Equipo ${l.length + 1}`, vg: 25, members: [null, null, null, null, null, null] };
    teams.save(team);
    return team;
  },
};
