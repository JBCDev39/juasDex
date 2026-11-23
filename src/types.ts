// Formas de los datos generados por scripts/build-data.mjs

/** [id, nombre, tipos, generación] */
export type IndexEntry = [number, string, number[], number];

/** [nombre, tipo, clase (1 estado, 2 físico, 3 especial), potencia, precisión, PP, generación] */
export type Move = [string, number, number, number | null, number | null, number | null, number];

/** [nombre, descripción, generación] */
export type Ability = [string, string, number];

/** [descripción, generación, prioridad] */
export type MoveInfo = [string, number, number];

/** [movimiento, método (1 nivel, 2 huevo, 3 tutor, 4 MT), nivel o etiqueta MT] */
export type Learn = [number, number, number | string];

/** [lugar, método, nivel mín, nivel máx, probabilidad] */
export type Encounter = [string, string, number, number, number];

/** [nombre, categoría, grupo, descripción, id del dibujo, evoluciones [especie, modo][], lo llevan en estado salvaje] */
export type Item = [string, string, 'equip' | 'evo' | 'baya' | 'ball' | 'med', string, string, [number, string][], number[]];

/** [nombre, stat que sube, stat que baja, sabor favorito, sabor odiado] (stats 2-6) */
export type Nature = [string, number, number, number, number];

export interface TeamMember {
  pid: number;
  species: number;
  types: number[];
  /** tipos originales (para volver a ellos al apagar el Modo Randomizer) */
  origTypes?: number[];
  abil: number;
  nature: number;
  item: number;
  moves: number[];
}

export interface Team {
  id: number;
  name: string;
  vg: number;
  members: (TeamMember | null)[];
  /** Modo Randomizer: cualquier Pokémon, tipo, habilidad y movimiento */
  randomizer?: boolean;
}

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
  /** formas alternativas: pid -> [especie, nombre de la forma] */
  forms: Record<string, [number, string]>;
  items: Record<string, Item>;
  itemSprites: Record<string, number>;
  natures: Record<string, Nature>;
}
