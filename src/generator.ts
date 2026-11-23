// Generador de equipos: reglas sencillas pero sensatas.
// 1) Elige 6 Pokémon que se cubran las debilidades y peguen a muchos tipos.
// 2) Arma cada uno: movimientos del juego elegido, naturaleza, habilidad y objeto.
import type { Db, Team, TeamMember } from './types';
import { loadSpecies } from './data';

export type Purpose = 'historia' | 'combates' | 'monotipo' | 'sorpresa';
export interface GenOptions { vg: number; purpose: Purpose; monoType: number; anchors: number[]; legends: boolean }
/** pid -> [total, stats, final, legendario, especial] */
export type Pool = Record<string, [number, number[], number, number, number]>;

let poolP: Promise<Pool> | null = null;
export const loadPool = () => (poolP ??= fetch('data/pool.json').then((r) => { if (!r.ok) throw new Error('pool'); return r.json() as Promise<Pool>; }).catch((e) => { poolP = null; throw e; }));

// Paradoja y Ultraentes: no están marcados como legendarios, pero se tratan como tales
const QUASI = new Set([984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1009, 1010, 1020, 1021, 1022, 1023, 793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);
const TRAPS = new Set([289, 292]); // Slaking (Ausente) y Shedinja: solo en Sorpréndame
const TYPES = Array.from({ length: 18 }, (_, i) => i + 1);
// Movimientos que el generador evita (cargan un turno, se debilitan, fallan mucho, etc.)
const AVOID = new Set([802, 851, 798, 173, 704, 690, 507, 905, 165, 237, 120, 153, 63, 416, 307, 308, 338, 439, 459, 264, 138, 76, 143, 13, 19, 91, 291, 340, 467, 566, 387, 562, 485, 682, 720, 796, 130, 553, 554, 669, 248, 353, 800, 252, 263, 371, 382]);
const SETUP_PHYS = [14, 349, 339, 504]; // Danza Espada, Danza Dragón, Corpulencia, Rompecoraza
const SETUP_SPEC = [417, 347, 483, 504]; // Maquinación, Paz Mental, Danza Aleteo, Rompecoraza
const NATURE = { adamant: 11, jolly: 16, modest: 3, timid: 5 };
const ITEM = { leftovers: 211, lifeOrb: 247, scarf: 264, band: 197, specs: 274, sitrus: 135, vest: 683, sash: 252, shellBell: 230, expert: 245 };

const defMult = (db: Db, atk: number, types: number[]) => types.reduce((f, d) => f * (db.meta.chart[atk]?.[d] ?? 1), 1);

/** Qué tan mal está la defensa de un grupo de tipos (más alto = peor) */
function defensePenalty(db: Db, team: number[][]): number {
  let pen = 0;
  for (const a of TYPES) {
    let w = 0, r = 0;
    for (const t of team) { const m = defMult(db, a, t); if (m > 1) w += m >= 4 ? 1.5 : 1; else if (m < 1) r += 1; }
    pen += Math.max(0, w - r - 1) * 1.6 + (w >= 3 ? 3 : 0);
  }
  return pen;
}

/** Tipos a los que el grupo pega súper eficaz con sus propios tipos (STAB) */
function stabCoverage(db: Db, team: number[][]): Set<number> {
  const out = new Set<number>();
  for (const t of team) for (const a of t) for (const d of TYPES) if ((db.meta.chart[a]?.[d] ?? 1) >= 2) out.add(d);
  return out;
}

export function candidatePool(db: Db, pool: Pool, vgDex: Record<string, number[]>, o: GenOptions): number[] {
  const minBst = o.purpose === 'combates' ? 470 : o.purpose === 'historia' ? 420 : 390;
  const allowLegend = o.purpose === 'combates' && o.legends;
  const seen = new Set<number>();
  return (vgDex[o.vg] ?? []).filter((pid) => {
    const p = pool[pid];
    if (!p || !p[2] || p[4]) return false; // solo evoluciones finales, sin megas ni formas especiales
    if (p[3] === 2 && !allowLegend) return false;
    if (p[3] === 1 && !allowLegend) return false;
    if (p[0] < minBst) return false;
    const sid = db.forms[pid]?.[0] ?? pid;
    if (QUASI.has(sid) && !allowLegend) return false;
    if (TRAPS.has(sid) && o.purpose !== 'sorpresa') return false;
    const types = typesOf(db, pid);
    if (o.purpose === 'monotipo' && !types.includes(o.monoType)) return false;
    const sp = db.forms[pid]?.[0] ?? pid;
    if (seen.has(sp) && !db.forms[pid]) return false;
    seen.add(sp);
    return true;
  });
}

// Los tipos de una forma no están en el índice; se guardan aquí cuando se cargan
const formTypes = new Map<number, number[]>();
const typesOf = (db: Db, pid: number) => formTypes.get(pid) ?? db.index[(db.forms[pid]?.[0] ?? pid) - 1]?.[2] ?? [1];

async function preloadFormTypes(db: Db, pids: number[]) {
  const forms = pids.filter((p) => db.forms[p] && !formTypes.has(p));
  await Promise.all(forms.map(async (pid) => {
    const sp = await loadSpecies(db.forms[pid][0], db.meta.chunk);
    const v = sp.varieties.find((x) => x.pid === pid);
    if (v) formTypes.set(pid, v.types);
  }));
}

/** Elige los 6 Pokémon */
async function pickSix(db: Db, pool: Pool, cands: number[], o: GenOptions): Promise<number[]> {
  await preloadFormTypes(db, [...cands, ...o.anchors]);
  const team: number[] = [...new Set(o.anchors)].slice(0, 6);
  const usedSpecies = new Set(team.map((p) => db.forms[p]?.[0] ?? p));
  const jitter = o.purpose === 'sorpresa' ? 6 : o.purpose === 'historia' ? 2.6 : o.purpose === 'monotipo' ? 2.2 : 1.8;
  const bstW = o.purpose === 'combates' ? 1.6 : o.purpose === 'sorpresa' ? 0.4 : 1;
  while (team.length < 6) {
    const teamTypes = team.map((p) => typesOf(db, p));
    const basePen = defensePenalty(db, teamTypes);
    const baseCov = stabCoverage(db, teamTypes);
    let best = -1, bestScore = -Infinity;
    for (const pid of cands) {
      const sp = db.forms[pid]?.[0] ?? pid;
      if (usedSpecies.has(sp)) continue;
      const t = typesOf(db, pid);
      const newPen = defensePenalty(db, [...teamTypes, t]);
      const cov = stabCoverage(db, [t]);
      let gain = 0;
      cov.forEach((d) => { if (!baseCov.has(d)) gain++; });
      const overlap = o.purpose === 'monotipo' ? 0 : t.filter((x) => teamTypes.some((tt) => tt.includes(x))).length;
      const score = (pool[pid][0] / 100) * bstW + (basePen - newPen) * 0.9 + gain * 0.45 - overlap * 1.8 + Math.random() * jitter;
      if (score > bestScore) { bestScore = score; best = pid; }
    }
    if (best < 0) break;
    team.push(best);
    usedSpecies.add(db.forms[best]?.[0] ?? best);
  }
  return team;
}

/** Arma un Pokémon: movimientos, naturaleza, habilidad y objeto */
async function buildSet(db: Db, pool: Pool, pid: number, o: GenOptions, teamCovered: Set<number>, slot: number, usedItems: Set<number>): Promise<TeamMember> {
  const species = db.forms[pid]?.[0] ?? pid;
  const sp = await loadSpecies(species, db.meta.chunk);
  const v = sp.varieties.find((x) => x.pid === pid) ?? sp.varieties[0];
  const stats = pool[pid]?.[1] ?? v.stats;
  const [, atk, , spa, , spe] = stats;
  const role: 2 | 3 = atk >= spa ? 2 : 3;
  const mixed = Math.abs(atk - spa) <= 10;
  const learn = [...new Set((v.moves[o.vg] ?? []).map((x) => x[0]))].filter((mid) => db.moves[mid] && !AVOID.has(mid));

  const value = (mid: number) => {
    const m = db.moves[mid];
    if (!m[3] || m[3] < 50) return 0;
    if (m[2] !== role && !(mixed && m[2] !== 1)) return 0;
    const acc = m[4] ?? 100;
    if (acc < 80) return 0;
    const stab = v.types.includes(m[1]) ? 1.5 : 1;
    return m[3] * (acc / 100) * stab * (m[5] && m[5] <= 5 ? 0.92 : 1);
  };
  const dmg = learn.map((mid) => [mid, value(mid)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const moves: number[] = [];
  const usedTypes = new Set<number>();
  // 1) El mejor ataque de cada uno de sus tipos (STAB)
  for (const t of v.types) {
    const best = dmg.find(([mid]) => db.moves[mid][1] === t);
    if (best && !moves.includes(best[0])) { moves.push(best[0]); usedTypes.add(t); }
  }
  // 2) Un movimiento para potenciarse en Combates/Historia si lo aprende
  const setupList = role === 2 ? SETUP_PHYS : SETUP_SPEC;
  const setup = o.purpose !== 'sorpresa' ? setupList.find((mid) => learn.includes(mid)) : undefined;
  const wantSetup = setup && (o.purpose === 'combates' ? Math.random() < 0.7 : Math.random() < 0.35);
  // 3) Cobertura: ataques de otros tipos que peguen a lo que el equipo todavía no cubre
  const coverage = (mid: number) => {
    const t = db.moves[mid][1];
    let s = 0;
    for (const d of TYPES) if ((db.meta.chart[t]?.[d] ?? 1) >= 2) s += teamCovered.has(d) ? 0.35 : 1;
    return s;
  };
  const cov = dmg.filter(([mid]) => !usedTypes.has(db.moves[mid][1]))
    .map(([mid, s]) => [mid, s * (0.6 + coverage(mid) * 0.18) * (0.85 + Math.random() * 0.3)] as const)
    .sort((a, b) => b[1] - a[1]);
  const slots = wantSetup ? 3 : 4;
  for (const [mid] of cov) {
    if (moves.length >= slots) break;
    const t = db.moves[mid][1];
    if (usedTypes.has(t)) continue;
    moves.push(mid); usedTypes.add(t);
  }
  // Si faltan, rellenar con los mejores ataques que queden
  for (const [mid] of dmg) { if (moves.length >= slots) break; if (!moves.includes(mid)) moves.push(mid); }
  if (wantSetup && setup) moves.push(setup);
  for (const mid of moves) { const t = db.moves[mid][1]; for (const d of TYPES) if ((db.meta.chart[t]?.[d] ?? 1) >= 2) teamCovered.add(d); }
  while (moves.length < 4) moves.push(0);

  // Naturaleza según su fuerte y su velocidad
  const fast = spe >= 85;
  const nature = role === 2 ? (fast ? NATURE.jolly : NATURE.adamant) : (fast ? NATURE.timid : NATURE.modest);

  // Habilidad: la primera (normal); en Sorpréndame, cualquiera de las suyas
  const abil = o.purpose === 'sorpresa' ? v.abil[Math.floor(Math.random() * v.abil.length)]?.[0] ?? 0 : v.abil[0]?.[0] ?? 0;

  // Objeto: una lista de preferencias; se toma el primero que el equipo no tenga todavía
  const bulky = stats[0] + stats[2] + stats[4] >= 300;
  let prefs: number[];
  if (o.purpose === 'combates') {
    const choice = role === 2 ? ITEM.band : ITEM.specs;
    prefs = wantSetup ? [ITEM.lifeOrb, ITEM.leftovers, ITEM.sitrus, ITEM.expert]
      : fast ? [ITEM.scarf, ITEM.lifeOrb, ITEM.sash, choice, ITEM.expert]
      : bulky ? [ITEM.vest, ITEM.leftovers, ITEM.sitrus, ITEM.shellBell]
      : [choice, ITEM.expert, ITEM.lifeOrb, ITEM.sitrus];
  } else if (o.purpose === 'sorpresa') {
    prefs = [ITEM.leftovers, ITEM.lifeOrb, ITEM.sash, ITEM.sitrus, ITEM.scarf, ITEM.expert, ITEM.shellBell].sort(() => Math.random() - 0.5);
  } else {
    prefs = bulky ? [ITEM.leftovers, ITEM.sitrus, ITEM.shellBell, ITEM.expert] : [ITEM.expert, ITEM.shellBell, ITEM.sitrus, ITEM.leftovers];
    prefs = [...prefs.slice(slot % 2), ...prefs.slice(0, slot % 2)];
  }
  const item = prefs.find((x) => db.items[x] && !usedItems.has(x)) ?? prefs.find((x) => db.items[x]) ?? 0;
  if (item) usedItems.add(item);

  return { pid: v.pid, species, types: v.types, origTypes: v.types, abil, nature, item, moves: moves.slice(0, 4) };
}

export async function generateTeam(db: Db, pool: Pool, vgDex: Record<string, number[]>, o: GenOptions): Promise<Omit<Team, 'id'> | null> {
  const cands = candidatePool(db, pool, vgDex, o);
  if (cands.length + o.anchors.length < 1) return null;
  const pids = await pickSix(db, pool, cands, o);
  const covered = new Set<number>();
  const usedItems = new Set<number>();
  const members: (TeamMember | null)[] = [];
  for (let i = 0; i < pids.length; i++) members.push(await buildSet(db, pool, pids[i], o, covered, i, usedItems));
  while (members.length < 6) members.push(null);
  return { name: '', vg: o.vg, members };
}
