// Compartir equipos: enlace de JuasDex (con todo, incluso tipos de Randomizer)
// y texto en formato Pokémon Showdown (nombres en inglés).
import type { Db, Team, TeamMember } from './types';
import { loadSpecies } from './data';

type En = { pokemon: Record<string, string>; moves: Record<string, string>; abilities: Record<string, string>; items: Record<string, string>; natures: Record<string, string> };
let en: Promise<En> | null = null;
export const loadEn = () => (en ??= fetch('data/en.json').then((r) => { if (!r.ok) throw new Error('en'); return r.json() as Promise<En>; }).catch((e) => { en = null; throw e; }));

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/* ---------- Enlace ---------- */
type Packed = [number, string, number, number, (0 | [number, number, number, number, number, number, number, number, number[]?])[]];

export function encodeTeam(t: Team): string {
  const payload: Packed = [1, t.name, t.vg, t.randomizer ? 1 : 0, t.members.map((m) => {
    if (!m) return 0;
    const moves = [0, 1, 2, 3].map((i) => m.moves[i] || 0) as [number, number, number, number];
    const custom = t.randomizer && m.types.join() !== (m.origTypes ?? m.types).join();
    return custom ? [m.pid, m.abil, m.nature, m.item, ...moves, m.types] : [m.pid, m.abil, m.nature, m.item, ...moves];
  })];
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const teamLink = (t: Team) => `${location.origin}${location.pathname}#importar-${encodeTeam(t)}`;

/** Convierte un código o enlace en un equipo (sin id). Carga los datos de cada Pokémon para sus tipos. */
export async function decodeTeam(db: Db, codeOrLink: string): Promise<Omit<Team, 'id'> | null> {
  const m = codeOrLink.match(/importar-([A-Za-z0-9_-]+)/);
  const code = (m ? m[1] : codeOrLink).trim();
  let data: Packed;
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!Array.isArray(data) || data[0] !== 1) return null;
  } catch {
    return null;
  }
  const [, name, vg, rando, packed] = data;
  const members: (TeamMember | null)[] = await Promise.all(packed.slice(0, 6).map(async (p) => {
    if (!p) return null;
    const [pid, abil, nature, item, m1, m2, m3, m4, types] = p;
    const species = db.forms[pid]?.[0] ?? pid;
    if (!db.index[species - 1]) return null;
    const sp = await loadSpecies(species, db.meta.chunk);
    const v = sp.varieties.find((x) => x.pid === pid) ?? sp.varieties[0];
    return {
      pid: v.pid, species, origTypes: v.types, types: types?.length ? types : v.types,
      abil, nature, item: db.items[item] ? item : 0, moves: [m1, m2, m3, m4].map((x) => (db.moves[x] ? x : 0)),
    };
  }));
  while (members.length < 6) members.push(null);
  return { name: String(name || 'Equipo compartido').slice(0, 30), vg: db.meta.versionGroups.some((g) => g.id === vg) ? vg : 25, randomizer: Boolean(rando), members };
}

/* ---------- Showdown ---------- */
export function toShowdown(db: Db, e: En, t: Team): string {
  return t.members.filter(Boolean).map((m) => {
    const mm = m as TeamMember;
    const lines = [`${e.pokemon[mm.pid] ?? db.index[mm.species - 1]?.[1] ?? '???'}${mm.item && e.items[mm.item] ? ` @ ${e.items[mm.item]}` : ''}`];
    if (mm.abil && e.abilities[mm.abil]) lines.push(`Ability: ${e.abilities[mm.abil]}`);
    if (mm.nature && e.natures[mm.nature]) lines.push(`${e.natures[mm.nature]} Nature`);
    for (const mid of mm.moves) if (mid && e.moves[mid]) lines.push(`- ${e.moves[mid]}`);
    return lines.join('\n');
  }).join('\n\n');
}

/** Lee texto de Showdown (en inglés o con los nombres en español de JuasDex) */
export async function fromShowdown(db: Db, e: En, text: string): Promise<{ team: Omit<Team, 'id'>; missing: string[] } | null> {
  const lookup = (en: Record<string, string>, es: Record<string, string>) => {
    const m = new Map<string, number>();
    for (const [id, n] of Object.entries(es)) m.set(norm(n), +id);
    for (const [id, n] of Object.entries(en)) m.set(norm(n), +id);
    return (s: string) => m.get(norm(s));
  };
  const esNames = (rec: Record<string, unknown[]>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, String(v[0])]));
  const findMon = lookup(e.pokemon, Object.fromEntries(db.index.map(([id, n]) => [id, n])));
  const findMove = lookup(e.moves, esNames(db.moves));
  const findAbil = lookup(e.abilities, esNames(db.abilities));
  const findItem = lookup(e.items, esNames(db.items));
  const findNature = lookup(e.natures, esNames(db.natures));

  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    .filter((b) => !/^===/.test(b)).slice(0, 6);
  if (!blocks.length) return null;
  const missing: string[] = [];
  const members: (TeamMember | null)[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    let [head, itemName] = lines[0].split(/\s+@\s+/);
    head = head.replace(/\s*\((M|F)\)\s*$/i, '');
    const nick = head.match(/\(([^()]+)\)\s*$/);
    const speciesName = nick ? nick[1] : head;
    let pid = findMon(speciesName) ?? findMon(speciesName.split('-')[0]);
    if (!pid) { missing.push(speciesName); continue; }
    const species = db.forms[pid]?.[0] ?? pid;
    const sp = await loadSpecies(species, db.meta.chunk);
    const v = sp.varieties.find((x) => x.pid === pid) ?? sp.varieties[0];
    pid = v.pid;
    const m: TeamMember = { pid, species, types: v.types, origTypes: v.types, abil: v.abil[0]?.[0] ?? 0, nature: 0, item: 0, moves: [] };
    if (itemName) { const it = findItem(itemName); if (it) m.item = it; else missing.push(itemName); }
    for (const l of lines.slice(1)) {
      let mm: RegExpMatchArray | null;
      if ((mm = l.match(/^(?:Ability|Habilidad):\s*(.+)$/i))) { const a = findAbil(mm[1]); if (a) m.abil = a; else missing.push(mm[1]); }
      else if ((mm = l.match(/^(.+?)\s+Nature$/i)) || (mm = l.match(/^Naturaleza:\s*(.+)$/i))) { const n = findNature(mm[1]); if (n) m.nature = n; else missing.push(mm[1]); }
      else if ((mm = l.match(/^[-–]\s*(.+)$/))) {
        const name = mm[1].replace(/\s*\[.*\]\s*$/, '');
        const mv = findMove(name);
        if (mv && m.moves.length < 4) m.moves.push(mv); else if (!mv) missing.push(name);
      }
    }
    while (m.moves.length < 4) m.moves.push(0);
    members.push(m);
  }
  if (!members.length) return null;
  while (members.length < 6) members.push(null);
  return { team: { name: 'Equipo importado', vg: 25, members }, missing };
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* sigue con el plan B */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
