// Generador de equipos.
// 1) Cada candidato recibe su mejor habilidad y un "rol" (físico/especial, rápido, aguantador).
// 2) Se califica el EQUIPO completo: defensa (con habilidades), cobertura, balance físico/especial,
//    velocidad, aguante y tipos repetidos.
// 3) Se arma con una elección codiciosa y luego se mejora probando cambios uno por uno
//    hasta que ningún cambio mejore la nota (búsqueda local).
// 4) Cada Pokémon recibe movimientos del juego elegido, naturaleza, habilidad y objeto.
import type { Db, Team, TeamMember } from './types';
import { loadSpecies } from './data';
import { ABIL_DEF, ABIL_SCORE } from './abilityfx';

export type Purpose = 'historia' | 'combates' | 'monotipo' | 'sorpresa';
export interface GenOptions { vg: number; purpose: Purpose; monoType: number; anchors: number[]; legends: boolean; starter?: number }
/** vg -> [especies de la Pokédex regional (sin DLC), iniciales [planta, fuego, agua]] */
export type Story = Record<string, [number[], number[]]>;
let storyP: Promise<Story> | null = null;
export const loadStory = () => (storyP ??= fetch('data/story.json').then((r) => { if (!r.ok) throw new Error('story'); return r.json() as Promise<Story>; }).catch((e) => { storyP = null; throw e; }));
// Juegos donde se pueden tener los tres iniciales (Amarillo, Let's Go) o no se elige uno (DLC)
const NO_STARTER_CHOICE = new Set([2, 19, 31]);
export const starterTrio = (story: Story | null, vg: number) => (NO_STARTER_CHOICE.has(vg) ? [] : story?.[vg]?.[1] ?? []);
const STARTER_BASES = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912];
/** especie -> especie base de su línea inicial (o undefined) */
export const starterBase = (sid: number) => STARTER_BASES.find((b) => sid >= b && sid <= b + 2);
/** ¿Qué Pokémon se pueden usar en el modo historia de ese juego? (null = sin límite) */
export const storySpecies = (story: Story | null, vg: number) => { const d = story?.[vg]?.[0]; return d?.length ? new Set(d) : null; };
/** pid -> [total, stats, final, legendario, especial, habilidades] */
export type Pool = Record<string, [number, number[], number, number, number, [number, number][]?]>;

let poolP: Promise<Pool> | null = null;
export const loadPool = () => (poolP ??= fetch('data/pool.json').then((r) => { if (!r.ok) throw new Error('pool'); return r.json() as Promise<Pool>; }).catch((e) => { poolP = null; throw e; }));

const TYPES = Array.from({ length: 18 }, (_, i) => i + 1);
// Paradoja y Ultraentes: no están marcados como legendarios, pero se tratan como tales
const QUASI = new Set([984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1009, 1010, 1020, 1021, 1022, 1023, 793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);
const TRAPS = new Set([289, 292]); // Slaking (Ausente) y Shedinja: solo en Sorpréndame
// Movimientos que el generador evita (cargan un turno, se debilitan, fallan mucho, dependen de algo raro…)
const AVOID = new Set([802, 851, 798, 173, 704, 690, 507, 905, 165, 237, 120, 153, 63, 416, 307, 308, 338, 439, 459, 264, 138, 76, 143, 13, 19, 91, 291, 340, 467, 566, 387, 562, 485, 682, 720, 796, 130, 553, 554, 669, 248, 353, 800, 252, 263, 371, 382]);
const LOCKING = new Set([200, 80, 37, 253]); // Enfado, Danza Pétalo, Golpe, Alboroto
const BODY_PRESS = 776;
const SETUP_PHYS = [14, 349, 339, 504]; // Danza Espada, Danza Dragón, Corpulencia, Rompecoraza
const SETUP_SPEC = [417, 347, 483, 504]; // Maquinación, Paz Mental, Danza Aleteo, Rompecoraza
const PRIORITY = [245, 389, 418, 420, 453, 183, 425, 709, 857]; // Velocidad Extrema, Golpe Bajo, Puño Bala, Canto Helado…
const NATURE = { adamant: 11, jolly: 16, modest: 3, timid: 5 };
const ITEM = { leftovers: 211, lifeOrb: 247, scarf: 264, band: 197, specs: 274, sitrus: 135, vest: 683, sash: 252, shellBell: 230, expert: 245, sludge: 258 };

interface Cand {
  pid: number; sid: number; types: number[]; bst: number; stats: number[]; legend: number;
  abil: number; role: 2 | 3; fast: boolean; bulky: boolean; quality: number;
  def: number[]; // multiplicador recibido por tipo atacante (índice 1..18)
}

const chartM = (db: Db, a: number, d: number) => db.meta.chart[a]?.[d] ?? 1;
const sidOf = (db: Db, pid: number) => db.forms[pid]?.[0] ?? pid;

// Los tipos de una forma no están en el índice; se guardan aquí cuando se cargan
const formTypes = new Map<number, number[]>();
const typesOf = (db: Db, pid: number) => formTypes.get(pid) ?? db.index[sidOf(db, pid) - 1]?.[2] ?? [1];
async function preloadFormTypes(db: Db, pids: number[]) {
  const forms = pids.filter((p) => db.forms[p] && !formTypes.has(p));
  const bySpecies = [...new Set(forms.map((p) => db.forms[p][0]))];
  await Promise.all(bySpecies.map(async (sid) => {
    const sp = await loadSpecies(sid, db.meta.chunk);
    for (const v of sp.varieties) formTypes.set(v.pid, v.types);
  }));
}

const vgGen = (db: Db, vg: number) => db.meta.versionGroups.find((g) => g.id === vg)?.gen ?? 9;

/** La mejor habilidad disponible en ese juego para ese Pokémon */
function pickAbility(db: Db, list: [number, number][], gen: number, purpose: Purpose): number {
  const ok = list.filter(([id, hidden]) => (db.abilities[id]?.[2] ?? 0) <= gen && (!hidden || gen >= 5));
  const opts = ok.length ? ok : list;
  if (!opts.length) return 0;
  if (purpose === 'sorpresa') return opts[Math.floor(Math.random() * opts.length)][0];
  return opts.reduce((best, x) => ((ABIL_SCORE[x[0]] ?? 0) > (ABIL_SCORE[best[0]] ?? 0) ? x : best))[0];
}

function makeCand(db: Db, pool: Pool, pid: number, o: GenOptions, gen: number): Cand | null {
  const p = pool[pid];
  if (!p) return null;
  const [bst, stats, , legend] = p;
  const types = typesOf(db, pid);
  const abil = pickAbility(db, p[5] ?? [], gen, o.purpose);
  const [hp, atk, df, spa, spd, spe] = stats;
  const role: 2 | 3 = atk >= spa ? 2 : 3;
  const def = [1, ...TYPES.map((a) => {
    let m = types.reduce((f, d) => f * chartM(db, a, d), 1);
    const fx = ABIL_DEF[abil]?.[a];
    if (fx !== undefined) m *= fx;
    return m;
  })];
  const offense = Math.max(atk, spa);
  const bstW = o.purpose === 'combates' ? 1.5 : o.purpose === 'sorpresa' ? 0.5 : 1;
  const quality = (bst / 100) * bstW + (ABIL_SCORE[abil] ?? 0) * 0.35 + (offense - 85) / 45 + (spe >= 100 ? 0.4 : 0);
  return { pid, sid: sidOf(db, pid), types, bst, stats, legend, abil, role, fast: spe >= 90, bulky: (hp + df + spd) / 3 >= 88, quality, def };
}

/** Nota de un equipo completo (más alta = mejor) */
function teamScore(db: Db, team: Cand[], o: GenOptions): number {
  if (!team.length) return 0;
  let s = 0;
  // Defensa: que ningún tipo le pegue fuerte a varios sin que otros lo aguanten
  for (const a of TYPES) {
    let w = 0, r = 0;
    for (const c of team) {
      const m = c.def[a];
      if (m > 1) w += m >= 4 ? 1.6 : 1;
      else if (m === 0) r += 1.3;
      else if (m < 1) r += 1;
    }
    s -= Math.max(0, w - r) * 2;
    if (w >= 3) s -= 3;
    if (w >= 2 && r === 0) s -= 1.5;
  }
  // Ataque con sus propios tipos: a cuántos tipos les pega súper eficaz, y cuántos lo resisten todo
  const stab = new Set(team.flatMap((c) => c.types));
  let se = 0, walled = 0;
  for (const d of TYPES) {
    let best = 0;
    stab.forEach((a) => { best = Math.max(best, chartM(db, a, d)); });
    if (best >= 2) se++;
    if (best < 1) walled++;
  }
  s += se * 0.6 - walled * 1.2;
  // Balance físico / especial
  const phys = team.filter((c) => c.role === 2).length;
  const spec = team.length - phys;
  s -= Math.max(0, Math.abs(phys - spec) - (team.length >= 5 ? 2 : 1)) * 1.6;
  // Velocidad y aguante (solo cuando el equipo ya tiene varios)
  if (team.length >= 4) {
    const fast = team.filter((c) => c.fast).length;
    const bulky = team.filter((c) => c.bulky).length;
    s -= Math.max(0, 2 - fast) * 2.2;
    s -= Math.max(0, 1 - bulky) * 2;
  }
  // Tipos repetidos (en Monotipo no cuenta el tipo elegido)
  const count = new Map<number, number>();
  for (const c of team) for (const t of c.types) if (!(o.purpose === 'monotipo' && t === o.monoType)) count.set(t, (count.get(t) ?? 0) + 1);
  count.forEach((n) => { if (n > 1) s -= (n - 1) * 1.8; });
  // Calidad individual
  for (const c of team) s += c.quality;
  return s;
}

export function candidatePool(db: Db, pool: Pool, vgDex: Record<string, number[]>, o: GenOptions, story: Story | null = null): number[] {
  const inStory = o.purpose === 'historia' ? storySpecies(story, o.vg) : null;
  const trio = o.purpose === 'historia' ? starterTrio(story, o.vg) : [];
  const minBst = o.purpose === 'combates' ? 470 : o.purpose === 'historia' ? 420 : 390;
  const allowLegend = o.purpose === 'combates' && o.legends;
  const seen = new Set<number>();
  return (vgDex[o.vg] ?? []).filter((pid) => {
    const p = pool[pid];
    if (!p || !p[2] || p[4]) return false; // solo evoluciones finales, sin megas ni formas especiales
    if (p[3] && !allowLegend) return false;
    if (p[0] < minBst) return false;
    const sid = sidOf(db, pid);
    if (QUASI.has(sid) && !allowLegend) return false;
    if (TRAPS.has(sid) && o.purpose !== 'sorpresa') return false;
    if (inStory && !inStory.has(sid)) return false; // no aparece en la historia de ese juego
    // Si dijo cuál inicial eligió, los otros dos no se pueden tener
    const sb = starterBase(sid);
    if (sb && o.starter && sb !== o.starter && trio.includes(sb)) return false;
    if (o.purpose === 'monotipo' && !typesOf(db, pid).includes(o.monoType)) return false;
    if (seen.has(pid)) return false;
    seen.add(pid);
    return true;
  });
}

// Memoria de lo que salió en los últimos intentos (se va olvidando), para que haya variedad
const recent = new Map<number, number>();
const remember = (sids: number[]) => {
  recent.forEach((v, k) => { const n = v * 0.55; if (n < 0.1) recent.delete(k); else recent.set(k, n); });
  for (const sid of sids) recent.set(sid, (recent.get(sid) ?? 0) + 1);
};

/** Elige los 6: codicioso + búsqueda local */
function pickSix(db: Db, cands: Cand[], anchors: Cand[], o: GenOptions, avoid: Set<number>): Cand[] {
  const jitterAmp = o.purpose === 'sorpresa' ? 5 : o.purpose === 'historia' ? 2.2 : o.purpose === 'monotipo' ? 1.8 : 1.5;
  // Un poco de azar fijo por candidato para que cada intento sea distinto pero consistente
  const jit = new Map(cands.map((c) => [c.pid, Math.random() * jitterAmp - (avoid.has(c.pid) ? 2.5 : 0) - (recent.get(c.sid) ?? 0) * 1.6]));
  const isLegend = (c: Cand) => c.legend > 0 || QUASI.has(c.sid);
  const score = (team: Cand[]) => teamScore(db, team, o) + team.reduce((s, c) => s + (jit.get(c.pid) ?? 0), 0);
  // Solo una línea inicial por equipo (en la historia solo se recibe uno)
  const oneStarter = o.purpose === 'historia';
  const allowed = (team: Cand[], c: Cand) =>
    !team.some((x) => x.sid === c.sid) && (!isLegend(c) || team.filter(isLegend).length < 2) &&
    !(oneStarter && starterBase(c.sid) && team.some((x) => starterBase(x.sid)));

  const team: Cand[] = [...anchors];
  while (team.length < 6) {
    let best: Cand | null = null, bestS = -Infinity;
    for (const c of cands) {
      if (!allowed(team, c)) continue;
      const s = score([...team, c]);
      if (s > bestS) { bestS = s; best = c; }
    }
    if (!best) break;
    team.push(best);
  }
  // Búsqueda local: probar reemplazar cada uno (menos los fijos) por cualquier otro
  const fixed = anchors.length;
  for (let round = 0; round < 4; round++) {
    let improved = false;
    for (let i = fixed; i < team.length; i++) {
      const rest = team.filter((_, k) => k !== i);
      let bestC = team[i], bestS = score(team);
      for (const c of cands) {
        if (c.pid === team[i].pid || !allowed(rest, c)) continue;
        const s = score([...rest, c]);
        if (s > bestS + 0.01) { bestS = s; bestC = c; }
      }
      if (bestC !== team[i]) { team[i] = bestC; improved = true; }
    }
    if (!improved) break;
  }
  return team;
}

/** Arma un Pokémon: movimientos, naturaleza, habilidad y objeto */
async function buildSet(db: Db, c: Cand, o: GenOptions, teamCovered: Set<number>, slot: number, usedItems: Set<number>): Promise<TeamMember> {
  const sp = await loadSpecies(c.sid, db.meta.chunk);
  const v = sp.varieties.find((x) => x.pid === c.pid) ?? sp.varieties[0];
  const [, atk, df, spa, , spe] = c.stats;
  const role = c.role;
  const mixed = Math.abs(atk - spa) <= 10;
  const learn = [...new Set((v.moves[o.vg] ?? []).map((x) => x[0]))].filter((mid) => db.moves[mid] && !AVOID.has(mid));

  const value = (mid: number) => {
    const m = db.moves[mid];
    if (!m[3] || m[3] < 50) return 0;
    if (mid === BODY_PRESS) return df >= 100 && df >= atk ? m[3] * (df / Math.max(atk, 1)) : 0;
    if (m[2] !== role && !(mixed && m[2] !== 1)) return 0;
    const acc = m[4] ?? 100;
    if (acc < 80) return 0;
    const stab = c.types.includes(m[1]) ? 1.5 : 1;
    const lock = LOCKING.has(mid) && o.purpose !== 'combates' ? 0.85 : 1;
    return m[3] * (acc / 100) * stab * lock * (m[5] && m[5] <= 5 ? 0.92 : 1);
  };
  const dmg = learn.map((mid) => [mid, value(mid)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const moves: number[] = [];
  const usedTypes = new Set<number>();
  // 1) El mejor ataque de cada uno de sus tipos (STAB)
  for (const t of c.types) {
    const best = dmg.find(([mid]) => db.moves[mid][1] === t);
    if (best && !moves.includes(best[0])) { moves.push(best[0]); usedTypes.add(t); }
  }
  // 2) Potenciador (Danza Espada, Maquinación…) si lo aprende
  const setupList = role === 2 ? SETUP_PHYS : SETUP_SPEC;
  const setup = o.purpose !== 'sorpresa' ? setupList.find((mid) => learn.includes(mid)) : undefined;
  const wantSetup = Boolean(setup) && (o.purpose === 'combates' ? Math.random() < 0.7 : Math.random() < 0.35);
  // 3) Prioridad para los físicos lentos en Combates
  const prio = o.purpose === 'combates' && role === 2 && spe < 90 && !wantSetup
    ? PRIORITY.find((mid) => learn.includes(mid) && db.moves[mid]?.[2] === 2) : undefined;
  // 4) Cobertura: ataques de otros tipos, sobre todo contra lo que el equipo todavía no cubre
  const coverage = (mid: number) => {
    const t = db.moves[mid][1];
    let s = 0;
    for (const d of TYPES) if (chartM(db, t, d) >= 2) s += teamCovered.has(d) ? 0.35 : 1;
    return s;
  };
  const cov = dmg.filter(([mid]) => !usedTypes.has(db.moves[mid][1]))
    .map(([mid, s]) => [mid, s * (0.6 + coverage(mid) * 0.18) * (0.88 + Math.random() * 0.24)] as const)
    .sort((a, b) => b[1] - a[1]);
  const slots = 4 - (wantSetup ? 1 : 0) - (prio ? 1 : 0);
  for (const [mid] of cov) {
    if (moves.length >= slots) break;
    const t = db.moves[mid][1];
    if (usedTypes.has(t)) continue;
    moves.push(mid); usedTypes.add(t);
  }
  for (const [mid] of dmg) { if (moves.length >= slots) break; if (!moves.includes(mid)) moves.push(mid); }
  if (prio && !moves.includes(prio)) moves.push(prio);
  if (wantSetup && setup) moves.push(setup);
  for (const mid of moves) { const t = db.moves[mid][1]; for (const d of TYPES) if (chartM(db, t, d) >= 2) teamCovered.add(d); }
  while (moves.length < 4) moves.push(0);

  // Naturaleza según su fuerte y su velocidad
  const nature = role === 2 ? (c.fast ? NATURE.jolly : NATURE.adamant) : (c.fast ? NATURE.timid : NATURE.modest);

  // Objeto: una lista de preferencias; se toma el primero que el equipo no tenga todavía
  const rest = c.types.includes(4) ? ITEM.sludge : ITEM.leftovers;
  let prefs: number[];
  if (o.purpose === 'combates') {
    const choice = role === 2 ? ITEM.band : ITEM.specs;
    prefs = wantSetup ? [ITEM.lifeOrb, rest, ITEM.sitrus, ITEM.expert]
      : c.fast ? [ITEM.scarf, ITEM.lifeOrb, ITEM.sash, choice, ITEM.expert]
      : c.bulky ? [ITEM.vest, rest, ITEM.sitrus, ITEM.shellBell]
      : [choice, ITEM.expert, ITEM.lifeOrb, ITEM.sitrus];
  } else if (o.purpose === 'sorpresa') {
    prefs = [rest, ITEM.lifeOrb, ITEM.sash, ITEM.sitrus, ITEM.scarf, ITEM.expert, ITEM.shellBell].sort(() => Math.random() - 0.5);
  } else {
    prefs = c.bulky ? [rest, ITEM.sitrus, ITEM.shellBell, ITEM.expert] : [ITEM.expert, ITEM.shellBell, ITEM.sitrus, rest];
    prefs = [...prefs.slice(slot % 2), ...prefs.slice(0, slot % 2)];
  }
  const item = prefs.find((x) => db.items[x] && !usedItems.has(x)) ?? prefs.find((x) => db.items[x]) ?? 0;
  if (item) usedItems.add(item);

  return { pid: c.pid, species: c.sid, types: c.types, origTypes: c.types, abil: c.abil || v.abil[0]?.[0] || 0, nature, item, moves: moves.slice(0, 4) };
}

/** avoid: Pokémon del intento anterior, para que "Otro" no repita el mismo equipo */
export async function generateTeam(db: Db, pool: Pool, vgDex: Record<string, number[]>, o: GenOptions, avoid: number[] = [], story: Story | null = null): Promise<Omit<Team, 'id'> | null> {
  // Primero se cargan los tipos de las formas (Alola, Galar, Rotom…) para filtrar bien
  await preloadFormTypes(db, [...(vgDex[o.vg] ?? []).filter((p) => db.forms[p] && pool[p]?.[2] && !pool[p]?.[4]), ...o.anchors]);
  const gen = vgGen(db, o.vg);
  const cands = candidatePool(db, pool, vgDex, o, story).map((pid) => makeCand(db, pool, pid, o, gen)).filter(Boolean) as Cand[];
  const fixed = [...new Set(o.anchors)].slice(0, 2);
  // El inicial que eligió entra al equipo ya evolucionado (si no lo puso ya en los fijos)
  if (o.purpose === 'historia' && o.starter && starterTrio(story, o.vg).includes(o.starter) && !fixed.some((p) => starterBase(sidOf(db, p)) === o.starter)) fixed.unshift(o.starter + 2);
  const anchors = fixed.map((pid) => makeCand(db, pool, pid, o, gen)).filter(Boolean) as Cand[];
  if (!cands.length && !anchors.length) return null;
  const six = pickSix(db, cands, anchors, o, new Set(avoid));
  remember(six.slice(anchors.length).map((c) => c.sid));
  const covered = new Set<number>();
  const usedItems = new Set<number>();
  const members: (TeamMember | null)[] = [];
  for (let i = 0; i < six.length; i++) members.push(await buildSet(db, six[i], o, covered, i, usedItems));
  while (members.length < 6) members.push(null);
  return { name: '', vg: o.vg, members };
}

/* ---------- Sugerir cambio ---------- */
export interface Suggestion { slot: number; fromPid: number; toPid: number; reasons: string[]; sig: string }
const baseOpts = (team: Team): GenOptions => ({ vg: team.vg, purpose: 'historia', monoType: 0, anchors: [], legends: false });

function candFromMember(db: Db, pool: Pool, m: TeamMember, o: GenOptions): Cand | null {
  const c = makeCand(db, pool, m.pid, o, 9);
  if (!c) return null;
  // Se respetan los tipos y la habilidad que la persona eligió
  const def = [1, ...TYPES.map((a) => {
    let x = m.types.reduce((f, d) => f * chartM(db, a, d), 1);
    const fx = ABIL_DEF[m.abil]?.[a];
    if (fx !== undefined) x *= fx;
    return x;
  })];
  return { ...c, types: m.types, abil: m.abil, def, quality: c.quality - (ABIL_SCORE[c.abil] ?? 0) * 0.35 + (ABIL_SCORE[m.abil] ?? 0) * 0.35 };
}

const netWeak = (team: Cand[], a: number) => {
  let w = 0, r = 0;
  for (const c of team) { const m = c.def[a]; if (m > 1) w++; else if (m < 1) r++; }
  return Math.max(0, w - r) + (w >= 3 ? 1 : 0);
};

function explain(db: Db, before: Cand[], after: Cand[], out: Cand, inn: Cand): string[] {
  const why: { s: number; t: string }[] = [];
  const tn = (t: number) => db.meta.types[t]?.[0] ?? '';
  let bestT = 0, bestGain = 0;
  for (const a of TYPES) { const g = netWeak(before, a) - netWeak(after, a); if (g > bestGain) { bestGain = g; bestT = a; } }
  if (bestT) why.push({ s: bestGain * 2, t: `Aguanta mejor los ataques tipo ${tn(bestT)}` });
  const fast = (t: Cand[]) => t.filter((c) => c.fast).length;
  if (fast(before) < 2 && fast(after) > fast(before)) why.push({ s: 2.5, t: 'Le suma velocidad al equipo' });
  const imb = (t: Cand[]) => Math.abs(t.filter((c) => c.role === 2).length * 2 - t.length);
  if (imb(after) < imb(before) && imb(before) >= 3) why.push({ s: 2, t: 'Balancea ataques físicos y especiales' });
  const se = (t: Cand[]) => { const st = new Set(t.flatMap((c) => c.types)); return TYPES.filter((d) => [...st].some((a) => chartM(db, a, d) >= 2)).length; };
  const g = se(after) - se(before);
  if (g >= 2) why.push({ s: g * 0.7, t: `Sus tipos le pegan súper eficaz a ${g} tipos más` });
  const dupe = out.types.find((t) => before.filter((c) => c !== out && c.types.includes(t)).length > 0);
  if (dupe && !inn.types.includes(dupe)) why.push({ s: 1.5, t: `Evita repetir el tipo ${tn(dupe)}` });
  if (inn.bst - out.bst >= 60) why.push({ s: 1.2, t: `Más fuerte en general (total ${inn.bst} contra ${out.bst})` });
  if (ABIL_DEF[inn.abil] && !ABIL_DEF[out.abil]) why.push({ s: 1, t: `Su habilidad ${db.abilities[inn.abil]?.[0] ?? ''} le da una inmunidad` });
  return why.sort((x, y) => y.s - x.s).slice(0, 2).map((x) => x.t);
}

/** Busca el único cambio que más mejora el equipo. protect: especies que no se tocan (favoritos) */
export async function suggestSwap(db: Db, pool: Pool, vgDex: Record<string, number[]>, team: Team, protect: Set<number>): Promise<Suggestion | null> {
  const slots = team.members.map((m, i) => [m, i] as const).filter(([m]) => m) as [TeamMember, number][];
  if (slots.length < 4 || team.randomizer) return null;
  const o = baseOpts(team);
  o.legends = slots.some(([m]) => (pool[m.pid]?.[3] ?? 0) > 0 || QUASI.has(sidOf(db, m.pid)));
  if (o.legends) o.purpose = 'combates';
  await preloadFormTypes(db, (vgDex[o.vg] ?? []).filter((p) => db.forms[p] && pool[p]?.[2] && !pool[p]?.[4]));
  const gen = vgGen(db, o.vg);
  const current = slots.map(([m]) => candFromMember(db, pool, m, o));
  if (current.some((c) => !c)) return null;
  const now = current as Cand[];
  const cands = candidatePool(db, pool, vgDex, { ...o, purpose: o.legends ? 'combates' : 'historia' }).map((pid) => makeCand(db, pool, pid, o, gen)).filter(Boolean) as Cand[];
  const base = teamScore(db, now, o);
  let best: { i: number; c: Cand; s: number } | null = null;
  now.forEach((out, i) => {
    if (!pool[out.pid]?.[2] || protect.has(out.sid)) return; // sin evolucionar o favorito: no se toca
    const rest = now.filter((_, k) => k !== i);
    for (const c of cands) {
      if (rest.some((x) => x.sid === c.sid) || c.sid === out.sid) continue;
      const s = teamScore(db, [...rest, c], o) - base;
      if (!best || s > best.s) best = { i, c, s };
    }
  });
  const b = best as { i: number; c: Cand; s: number } | null;
  if (!b || b.s < 3.5) return null; // solo si la mejora se nota de verdad
  const after = now.map((x, k) => (k === b.i ? b.c : x));
  const reasons = explain(db, now, after, now[b.i], b.c);
  if (!reasons.length) return null;
  return { slot: slots[b.i][1], fromPid: now[b.i].pid, toPid: b.c.pid, reasons, sig: slots.map(([m]) => m.pid).join('-') };
}

/** Arma el Pokémon sugerido con movimientos, naturaleza, habilidad y objeto */
export async function buildMember(db: Db, pool: Pool, team: Team, slot: number, pid: number): Promise<TeamMember | null> {
  const o = baseOpts(team);
  await preloadFormTypes(db, [pid]);
  const c = makeCand(db, pool, pid, o, vgGen(db, o.vg));
  if (!c) return null;
  const others = team.members.filter((m, i) => m && i !== slot) as TeamMember[];
  const covered = new Set<number>();
  for (const m of others) for (const mid of m.moves) { const mv = db.moves[mid]; if (mv && mv[2] !== 1) for (const d of TYPES) if (chartM(db, mv[1], d) >= 2) covered.add(d); }
  return buildSet(db, c, o, covered, slot, new Set(others.map((m) => m.item).filter(Boolean)));
}
