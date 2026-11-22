// Formas de los datos generados por scripts/build-data.mjs

/** [id, nombre, tipos, generación] */
export type IndexEntry = [number, string, number[], number];

/** [nombre, tipo, clase (1 estado, 2 físico, 3 especial), potencia, precisión, PP] */
export type Move = [string, number, number, number | null, number | null, number | null];

/** [nombre, descripción] */
export type Ability = [string, string];

/** [movimiento, método (1 nivel, 2 huevo, 3 tutor, 4 MT), nivel o etiqueta MT] */
export type Learn = [number, number, number | string];

/** [lugar, método, nivel mín, nivel máx, probabilidad] */
export type Encounter = [string, string, number, number, number];

export interface Variety {
  pid: number;
  name: string;
  types: number[];
  abil: [number, number][];
  stats: number[];
  h: number;
  w: number;
  moves: Record<string, Learn[]>;
  enc: Record<string, Encounter[]>;
}

export interface EvoNode {
  id: number;
  c: string[];
  n: EvoNode[];
}

export interface Species {
  id: number;
  name: string;
  genus: string;
  flavor: string;
  gen: number;
  gender: number;
  capture: number;
  happy: number | null;
  hatch: number | null;
  egg: string[];
  legendary: boolean;
  mythical: boolean;
  baby: boolean;
  chain: EvoNode;
  varieties: Variety[];
}

export interface Meta {
  chunk: number;
  types: Record<string, [string, string]>;
  chart: Record<string, Record<string, number>>;
  versionGroups: { id: number; gen: number; name: string }[];
  versions: Record<string, [string, number]>;
  encVersions: number[];
}

export interface Db {
  index: IndexEntry[];
  meta: Meta;
  moves: Record<string, Move>;
  abilities: Record<string, Ability>;
  sprites: Record<string, [number, number]>;
}
