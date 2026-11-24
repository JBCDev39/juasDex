// Genera los datos de JuasDex (en español) a partir de los CSV de PokéAPI.
// Uso: node scripts/build-data.mjs <carpeta-csv> <carpeta-salida>
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

const [, , SRC = 'raw/csv', OUT = 'public/data'] = process.argv;
const ES = 7, EN = 9;
const CHUNK = 25; // especies por archivo

const read = (name) => parse(fs.readFileSync(path.join(SRC, `${name}.csv`)), {
  columns: true, skip_empty_lines: true, relax_column_count: true, trim: true,
});
const num = (v) => (v === '' || v == null ? null : Number(v));
const clean = (s) => s.replace(/[\f\n\r­]+/g, ' ').replace(/\s+/g, ' ').trim();
const pretty = (id) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
};
// Nombre en español con respaldo en inglés
const namesOf = (rows, idKey, nameKey = 'name', langKey = 'local_language_id') => {
  const es = new Map(), en = new Map();
  for (const r of rows) {
    if (+r[langKey] === ES) es.set(r[idKey], r[nameKey]);
    else if (+r[langKey] === EN) en.set(r[idKey], r[nameKey]);
  }
  return (id) => es.get(String(id)) || en.get(String(id)) || null;
};

// ---------- Tablas base ----------
const typeName = namesOf(read('type_names'), 'type_id');
const types = read('types').filter((t) => +t.id <= 18);
const typeIdent = Object.fromEntries(types.map((t) => [t.id, t.identifier]));
const chart = {}; // chart[atacante][defensor] = factor
for (const r of read('type_efficacy')) {
  if (+r.damage_type_id > 18 || +r.target_type_id > 18) continue;
  (chart[r.damage_type_id] ||= {})[r.target_type_id] = +r.damage_factor / 100;
}

const itemsRows = read('items');
const itemIdent = Object.fromEntries(itemsRows.map((i) => [i.id, i.identifier]));
const itemName = namesOf(read('item_names'), 'item_id');
const moveName = namesOf(read('move_names'), 'move_id');
const abilityName = namesOf(read('ability_names'), 'ability_id');
const speciesNameRows = read('pokemon_species_names');
const speciesName = namesOf(speciesNameRows, 'pokemon_species_id');
const genusEs = new Map(speciesNameRows.filter((r) => +r.local_language_id === ES && r.genus).map((r) => [r.pokemon_species_id, r.genus]));
const genus = (id) => genusEs.get(String(id)) || '';
const locNameEs = namesOf(read('location_names'), 'location_id');
const eggName = namesOf(read('egg_group_prose'), 'egg_group_id');
const versionName = namesOf(read('version_names'), 'version_id');

const versions = read('versions');
const vgVersions = groupBy(versions, 'version_group_id');
const versionGroups = read('version_groups')
  .filter((g) => ![21, 22, 26, 27, 28, 29].includes(+g.id))
  .sort((a, b) => +a.order - +b.order)
  .map((g) => ({
    id: +g.id,
    gen: +g.generation_id,
    name: (vgVersions.get(g.id) || []).map((v) => versionName(v.id) || pretty(v.identifier)).join(' / ') || pretty(g.identifier),
  }));
const vgName = Object.fromEntries(versionGroups.map((g) => [g.id, g.name]));

// Movimientos
const moves = {};
for (const m of read('moves')) {
  if (+m.id > 10000) continue;
  moves[m.id] = [moveName(m.id) || pretty(m.identifier), +m.type_id, +m.damage_class_id, num(m.power), num(m.accuracy), num(m.pp), +m.generation_id];
}

// Descripción, generación y prioridad de cada movimiento
const moveText = {};
for (const r of read('move_flavor_text')) {
  if (+r.language_id !== ES) continue;
  const prev = moveText[r.move_id];
  if (!prev || +r.version_group_id > prev.vg) moveText[r.move_id] = { vg: +r.version_group_id, t: clean(r.flavor_text) };
}
const moveInfo = {};
for (const m of read('moves')) {
  if (+m.id > 10000) continue;
  moveInfo[m.id] = [moveText[m.id]?.t || '', +m.generation_id, +m.priority || 0];
}

// Habilidades (nombre + descripción más reciente en español)
const abilityText = {};
for (const r of read('ability_flavor_text')) {
  if (+r.language_id !== ES) continue;
  const prev = abilityText[r.ability_id];
  if (!prev || +r.version_group_id > prev.vg) abilityText[r.ability_id] = { vg: +r.version_group_id, t: clean(r.flavor_text) };
}
const abilityGen = Object.fromEntries(read('abilities').map((a) => [a.id, +a.generation_id]));
const abilities = {};
for (const r of read('pokemon_abilities')) {
  if (abilities[r.ability_id]) continue;
  abilities[r.ability_id] = [abilityName(r.ability_id) || `Habilidad ${r.ability_id}`, abilityText[r.ability_id]?.t || '', abilityGen[r.ability_id] || 0];
}

// MT / MO / DT por generación de juego
const machineLabel = {}; // `${vg}:${move}` -> "MT24"
for (const r of read('machines')) {
  const ident = itemIdent[r.item_id] || '';
  const m = ident.match(/^(tm|hm|tr)(\d+)$/);
  if (!m) continue;
  const label = { tm: 'MT', hm: 'MO', tr: 'DT' }[m[1]] + m[2];
  machineLabel[`${r.version_group_id}:${r.move_id}`] = label;
}

// ---------- Ubicaciones ----------
const locIdent = Object.fromEntries(read('locations').map((l) => [l.id, l.identifier]));
const areas = Object.fromEntries(read('location_areas').map((a) => [a.id, a]));
const routeEs = (s) => s.replace(/^Route (\d+)/, 'Ruta $1').replace(/ Route (\d+)/, ' Ruta $1');
const areaLabel = (areaId) => {
  const a = areas[areaId];
  if (!a) return '¿?';
  const base = routeEs(locNameEs(a.location_id) || pretty(locIdent[a.location_id] || 'desconocido'));
  return a.identifier ? `${base} (${pretty(a.identifier)})` : base;
};
const slots = Object.fromEntries(read('encounter_slots').map((s) => [s.id, s]));
const METHOD_ES = {
  1: 'Hierba / cueva', 2: 'Caña Vieja', 3: 'Caña Buena', 4: 'Supercaña', 5: 'Surf', 6: 'Golpe Roca',
  7: 'Golpe Cabeza', 8: 'Hierba oscura', 9: 'Hierba que se mueve', 10: 'Polvo en cueva', 11: 'Sombra en puente',
  12: 'Supercaña (burbujas)', 13: 'Surf (burbujas)', 14: 'Flores amarillas', 15: 'Flores moradas', 16: 'Flores rojas',
  17: 'Terreno abrupto', 18: 'Regalo', 19: 'Huevo de regalo', 20: 'Encuentro fijo', 21: 'Poké Flauta',
  22: 'Golpe Cabeza', 23: 'Golpe Cabeza', 24: 'Golpe Cabeza', 25: 'Regadera', 26: 'Regadera Wailmer',
  27: 'Algas', 28: 'Errante (hierba)', 29: 'Errante (agua)', 30: 'Detector Devon', 31: 'Pesca (Feebas)',
  32: 'Escaneo Isla', 33: 'Llamada SOS', 34: 'Agua burbujeante', 35: 'Árbol de bayas', 36: 'Intercambio NPC',
  37: 'SOS (agua burbujeante)', 38: 'Visible en el mapa', 39: 'Visible en el agua', 40: 'Visible volando',
  41: 'Visible (especial)', 42: 'Visible volando (especial)', 43: 'Visible en el agua (especial)', 44: 'Horda',
  54: 'Claro oculto', 55: 'Árbol de miel', 56: 'Visible en la tierra', 57: 'Pokémon errante', 58: 'Errante (agua)',
  59: 'Persecución (agua)', 60: 'Aventura Dinamax', 61: 'Incursión Dinamax', 62: 'Emboscada (cubo de basura)',
  63: 'Emboscada (arbusto)', 64: 'Emboscada (techo)', 65: 'Emboscada (suelo)', 66: 'Emboscada (cielo)',
};
const encByPokemon = new Map(); // pid -> { versionId: Map(key -> row) }
for (const e of read('encounters')) {
  const slot = slots[e.encounter_slot_id];
  const method = slot ? +slot.encounter_method_id : 0;
  const rarity = slot ? num(slot.rarity) || 0 : 0;
  let byV = encByPokemon.get(e.pokemon_id);
  if (!byV) encByPokemon.set(e.pokemon_id, (byV = {}));
  const m = (byV[e.version_id] ||= new Map());
  const key = `${e.location_area_id}|${method}`;
  const cur = m.get(key);
  if (!cur) m.set(key, [areaLabel(e.location_area_id), METHOD_ES[method] || 'Otro', +e.min_level, +e.max_level, rarity]);
  else { cur[2] = Math.min(cur[2], +e.min_level); cur[3] = Math.max(cur[3], +e.max_level); cur[4] += rarity; }
}
const encVersions = new Set();
for (const byV of encByPokemon.values()) for (const v of Object.keys(byV)) encVersions.add(+v);

// ---------- Especies y Pokémon ----------
const speciesRows = read('pokemon_species');
const speciesById = Object.fromEntries(speciesRows.map((s) => [s.id, s]));
const flavor = {};
for (const r of read('pokemon_species_flavor_text')) {
  if (+r.language_id !== ES) continue;
  const prev = flavor[r.species_id];
  if (!prev || +r.version_id > prev.v) flavor[r.species_id] = { v: +r.version_id, t: clean(r.flavor_text) };
}
const eggGroups = groupBy(read('pokemon_egg_groups'), 'species_id');
const pTypes = groupBy(read('pokemon_types'), 'pokemon_id');
const pStats = groupBy(read('pokemon_stats'), 'pokemon_id');
const pAbil = groupBy(read('pokemon_abilities'), 'pokemon_id');
const forms = read('pokemon_forms');
const formNameRows = read('pokemon_form_names');
const formEs = {}, formEn = {};
for (const r of formNameRows) {
  const v = r.pokemon_name || r.form_name;
  if (+r.local_language_id === ES) formEs[r.pokemon_form_id] = r.form_name || r.pokemon_name;
  if (+r.local_language_id === EN) formEn[r.pokemon_form_id] = v;
}
const defaultFormOf = {};
for (const f of forms) if (f.is_default === '1') defaultFormOf[f.pokemon_id] = f;

console.log('Leyendo movimientos aprendibles…');
const learn = new Map(); // pid -> { vg: [[move, method, levelOrLabel]] }
for (const r of read('pokemon_moves')) {
  const method = +r.pokemon_move_method_id;
  if (method > 4) continue;
  const vg = +r.version_group_id;
  if (!vgName[vg]) continue;
  let byVg = learn.get(r.pokemon_id);
  if (!byVg) learn.set(r.pokemon_id, (byVg = {}));
  const list = (byVg[vg] ||= []);
  let extra = 0;
  if (method === 1) extra = +r.level || 0;
  if (method === 4) extra = machineLabel[`${vg}:${r.move_id}`] || 'MT';
  list.push([+r.move_id, method, extra]);
}
// Ordenar y quitar duplicados
for (const byVg of learn.values()) {
  for (const vg of Object.keys(byVg)) {
    const seen = new Set();
    byVg[vg] = byVg[vg].filter((x) => { const k = x.join('|'); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a[1] - b[1] || (a[1] === 1 ? a[2] - b[2] : String(a[2]).localeCompare(String(b[2]), 'es', { numeric: true })));
  }
}

const EXCLUDE = /-(totem|gmax|cap|cosplay|rock-star|belle|pop-star|phd|libre|starter|world-cap|own-tempo)/;
const pokemonRows = read('pokemon');
const bySpecies = groupBy(pokemonRows, 'species_id');

const varietyName = (p, sName) => {
  if (p.is_default === '1') return sName;
  const f = defaultFormOf[p.id];
  const es = f && formEs[f.id];
  if (es) return es;
  const en = f && formEn[f.id];
  return en || pretty(p.identifier.replace(speciesById[p.species_id].identifier + '-', ''));
};

// ---------- Evoluciones ----------
const evoRows = groupBy(read('pokemon_evolution'), 'evolved_species_id');
const genderEs = { 1: 'hembra', 2: 'macho' };
const timeEs = { day: 'de día', night: 'de noche', dusk: 'al atardecer', 'full-moon': 'con luna llena' };
const sn = (id) => speciesName(id) || `#${id}`;
const iname = (id) => itemName(id) || pretty(itemIdent[id] || 'objeto');
const mname = (id) => moves[id]?.[0] || moveName(id) || 'un movimiento';
const evoText = (r) => {
  const t = +r.evolution_trigger_id;
  const parts = [];
  switch (t) {
    case 1: parts.push(r.minimum_level ? `Nivel ${r.minimum_level}` : 'Subir de nivel'); break;
    case 2: parts.push('Intercambio'); break;
    case 3: parts.push(`Usar ${iname(r.trigger_item_id)}`); break;
    case 4: parts.push('Nivel 20 con hueco libre en el equipo y una Poké Ball'); break;
    case 5: parts.push('Girar con un Confite equipado'); break;
    case 6: parts.push('Superar la Torre de la Oscuridad'); break;
    case 7: parts.push('Superar la Torre del Agua'); break;
    case 8: parts.push('Asestar 3 golpes críticos en un combate'); break;
    case 9: parts.push('Perder 49 PS o más y pasar bajo el Arco de Piedra'); break;
    case 10: parts.push('Subir de nivel en combate'); break;
    case 11: parts.push(`Usar ${mname(r.used_move_id)} ${r.minimum_move_count || 20} veces en estilo rápido`); break;
    case 12: parts.push(`Usar ${mname(r.used_move_id)} ${r.minimum_move_count || 20} veces en estilo fuerte`); break;
    case 13: parts.push(`Perder ${r.minimum_damage_taken || 294} PS por retroceso sin debilitarse`); break;
    case 14: parts.push(`Usar ${mname(r.used_move_id)}${r.minimum_move_count ? ` ${r.minimum_move_count} veces` : ''}`); break;
    case 15: parts.push('Derrotar 3 Bisharp que lideren grupos'); break;
    case 16: parts.push('Reunir 999 monedas de Gimmighoul'); break;
    case 17: parts.push('400 caramelos de Meltan (Pokémon GO)'); break;
    default: parts.push('Condición especial');
  }
  if (r.minimum_happiness) parts.push('con amistad alta');
  if (r.minimum_affection) parts.push('con afecto alto');
  if (r.minimum_beauty) parts.push('con belleza alta');
  if (r.held_item_id) parts.push(`equipado con ${iname(r.held_item_id)}`);
  if (r.known_move_id && t !== 14) parts.push(`conociendo ${mname(r.known_move_id)}`);
  if (r.known_move_type_id) parts.push(`conociendo un movimiento tipo ${typeName(r.known_move_type_id)}`);
  if (r.time_of_day && timeEs[r.time_of_day]) parts.push(timeEs[r.time_of_day]);
  if (r.location_id) parts.push(`en ${routeEs(locNameEs(r.location_id) || pretty(locIdent[r.location_id] || ''))}`);
  if (r.gender_id) parts.push(`(${genderEs[r.gender_id]})`);
  if (r.relative_physical_stats !== '') parts.push({ 1: 'con Ataque > Defensa', '-1': 'con Ataque < Defensa', 0: 'con Ataque = Defensa' }[r.relative_physical_stats]);
  if (r.party_species_id) parts.push(`con ${sn(r.party_species_id)} en el equipo`);
  if (r.party_type_id) parts.push(`con un Pokémon tipo ${typeName(r.party_type_id)} en el equipo`);
  if (r.trade_species_id) parts.push(`por ${sn(r.trade_species_id)}`);
  if (r.needs_overworld_rain === '1') parts.push('mientras llueve');
  if (r.turn_upside_down === '1') parts.push('con la consola boca abajo');
  if (r.needs_multiplayer === '1') parts.push('en modo multijugador');
  if (r.minimum_steps) parts.push(`tras caminar ${r.minimum_steps} pasos`);
  return parts.filter(Boolean).join(' ');
};
const children = groupBy(speciesRows.filter((s) => s.evolves_from_species_id), 'evolves_from_species_id');
const chainRoot = {};
for (const s of speciesRows) if (!s.evolves_from_species_id) chainRoot[s.evolution_chain_id] = +s.id;
const buildTree = (sid) => {
  let conds = [...new Set((evoRows.get(String(sid)) || []).map(evoText))];
  // Junta "Subir de nivel en X", "Subir de nivel en Y"… en una sola línea
  const near = conds.filter((c) => c.startsWith('Subir de nivel en ')).map((c) => c.slice(18));
  const SPECIAL_PLACE = { 470: 'cerca de una Roca Musgo', 471: 'cerca de una Roca Hielo', 462: 'en una zona con campo magnético', 476: 'en una zona con campo magnético', 738: 'en una zona con campo magnético' };
  if (near.length && SPECIAL_PLACE[sid]) conds = [...conds.filter((c) => !c.startsWith('Subir de nivel en ')), `Subir de nivel ${SPECIAL_PLACE[sid]}`];
  else if (near.length > 1) conds = [...conds.filter((c) => !c.startsWith('Subir de nivel en ')), `Subir de nivel en: ${near.join(', ')}`];
  // "con afecto alto" y "con amistad alta" para lo mismo → una sola línea
  const aff = conds.filter((c) => c.includes('con afecto alto'));
  for (const a of aff) {
    const twin = a.replace('con afecto alto', 'con amistad alta');
    if (conds.includes(twin)) conds = conds.filter((c) => c !== a).map((c) => (c === twin ? a.replace('con afecto alto', 'con amistad o afecto alto') : c));
  }
  return { id: sid, c: conds, n: (children.get(String(sid)) || []).sort((a, b) => +a.id - +b.id).map((k) => buildTree(+k.id)) };
};

// ---------- Salida ----------
fs.mkdirSync(path.join(OUT, 'p'), { recursive: true });
const index = [];
const chunks = {};
const spriteIds = [];
const speciesSorted = speciesRows.map((s) => +s.id).sort((a, b) => a - b);

for (const sid of speciesSorted) {
  const s = speciesById[sid];
  const name = speciesName(sid) || pretty(s.identifier);
  const vars = (bySpecies.get(String(sid)) || [])
    .filter((p) => p.is_default === '1' || !EXCLUDE.test(p.identifier))
    .sort((a, b) => +b.is_default - +a.is_default || +a.id - +b.id);
  const varieties = vars.map((p) => {
    spriteIds.push(+p.id);
    const stats = (pStats.get(p.id) || []).sort((a, b) => +a.stat_id - +b.stat_id).map((x) => +x.base_stat);
    const enc = {};
    const byV = encByPokemon.get(p.id) || {};
    for (const [v, m] of Object.entries(byV)) enc[v] = [...m.values()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
    return {
      pid: +p.id,
      name: varietyName(p, name),
      types: (pTypes.get(p.id) || []).sort((a, b) => +a.slot - +b.slot).map((x) => +x.type_id),
      abil: (pAbil.get(p.id) || []).sort((a, b) => +a.slot - +b.slot).map((x) => [+x.ability_id, +x.is_hidden]),
      stats,
      h: +p.height, w: +p.weight,
      moves: learn.get(p.id) || {},
      enc,
    };
  });
  const def = varieties[0];
  index.push([sid, name, def ? def.types : [], +s.generation_id]);
  const chunkId = Math.floor((sid - 1) / CHUNK);
  (chunks[chunkId] ||= {})[sid] = {
    id: sid,
    name,
    genus: genus(sid) || '',
    flavor: flavor[sid]?.t || '',
    gen: +s.generation_id,
    gender: +s.gender_rate, // -1 sin género, 0-8 octavos hembra
    capture: +s.capture_rate,
    happy: num(s.base_happiness),
    hatch: num(s.hatch_counter),
    egg: (eggGroups.get(String(sid)) || []).map((e) => eggName(e.egg_group_id)),
    legendary: s.is_legendary === '1', mythical: s.is_mythical === '1', baby: s.is_baby === '1',
    chain: buildTree(chainRoot[s.evolution_chain_id] ?? sid),
    varieties,
  };
}

// Quién aprende cada movimiento (cualquier juego) y quién tiene cada habilidad.
// máscara: 1 nivel, 2 huevo, 4 tutor, 8 MT
const keepPid = new Set(spriteIds.map(String));
const learners = {};
for (const [pid, byVg] of learn) {
  if (!keepPid.has(pid)) continue;
  const mask = {};
  for (const list of Object.values(byVg)) for (const [mid, method] of list) mask[mid] = (mask[mid] || 0) | [0, 1, 2, 4, 8][method];
  for (const [mid, m] of Object.entries(mask)) (learners[mid] ||= []).push([+pid, m]);
}
for (const l of Object.values(learners)) l.sort((a, b) => a[0] - b[0]);
const holders = {};
for (const r of read('pokemon_abilities')) {
  if (!keepPid.has(r.pokemon_id)) continue;
  (holders[r.ability_id] ||= []).push([+r.pokemon_id, +r.is_hidden]);
}
for (const l of Object.values(holders)) l.sort((a, b) => a[0] - b[0]);
// Formas alternativas: pid -> [especie, nombre de la forma]
const formsOut = {};
for (const sid of speciesSorted) {
  const s = speciesById[sid];
  for (const p of bySpecies.get(String(sid)) || []) {
    if (p.is_default === '1' || EXCLUDE.test(p.identifier)) continue;
    formsOut[p.id] = [sid, varietyName(p, speciesName(sid) || pretty(s.identifier))];
  }
}
fs.writeFileSync(path.join(OUT, 'move-info.json'), JSON.stringify(moveInfo));
fs.writeFileSync(path.join(OUT, 'move-learners.json'), JSON.stringify(learners));
fs.writeFileSync(path.join(OUT, 'ability-holders.json'), JSON.stringify(holders));
fs.writeFileSync(path.join(OUT, 'forms.json'), JSON.stringify(formsOut));

// ---------- Objetos útiles ----------
const ITEM_CAT = {
  10: 'Evolución', 12: 'Equipable', 13: 'Elección', 14: 'Esfuerzo', 15: 'Equipable perjudicial', 16: 'Entrenamiento',
  17: 'Tabla', 18: 'Exclusivo', 19: 'Potenciador de tipo', 42: 'Gema', 44: 'Megapiedra', 45: 'Disco',
  2: 'Baya de esfuerzo', 3: 'Baya curativa', 4: 'Baya', 5: 'Baya de apuro', 6: 'Baya curativa', 7: 'Baya protectora',
  33: 'Poké Ball especial', 34: 'Poké Ball', 39: 'Bonguri Ball',
  26: 'Vitamina', 27: 'Curación', 28: 'Recupera PP', 29: 'Revivir', 30: 'Cura estados', 50: 'Menta',
};
const ITEM_GROUP = (c) => ([10].includes(c) ? 'evo' : [2, 3, 4, 5, 6, 7].includes(c) ? 'baya' : [33, 34, 39].includes(c) ? 'ball' : [26, 27, 28, 29, 30, 50].includes(c) ? 'med' : 'equip');
const itemText = {};
for (const r of read('item_flavor_text')) {
  if (+r.language_id !== ES) continue;
  const prev = itemText[r.item_id];
  if (!prev || +r.version_group_id > prev.vg) itemText[r.item_id] = { vg: +r.version_group_id, t: clean(r.flavor_text) };
}
const evoByItem = {};
for (const [sid, rows] of evoRows) {
  for (const r of rows) {
    if (r.trigger_item_id) (evoByItem[r.trigger_item_id] ||= new Map()).set(+sid, 'usar');
    if (r.held_item_id) (evoByItem[r.held_item_id] ||= new Map()).set(+sid, +r.evolution_trigger_id === 2 ? 'intercambio' : 'equipado');
  }
}
const wildByItem = {};
for (const r of read('pokemon_items')) {
  if (!keepPid.has(r.pokemon_id)) continue;
  (wildByItem[r.item_id] ||= new Set()).add(+r.pokemon_id);
}
const itemsOut = {};
const itemSprites = [];
for (const it of itemsRows) {
  const c = +it.category_id;
  if (!ITEM_CAT[c]) continue;
  const name = itemName(it.id);
  if (!name) continue;
  itemSprites.push(it.identifier);
  itemsOut[it.id] = [
    name, ITEM_CAT[c], ITEM_GROUP(c), itemText[it.id]?.t || '', it.identifier,
    [...(evoByItem[it.id] || new Map())].sort((a, b) => a[0] - b[0]),
    [...(wildByItem[it.id] || [])].sort((a, b) => a - b),
  ];
}
fs.writeFileSync(path.join(OUT, 'items.json'), JSON.stringify(itemsOut));
fs.writeFileSync('raw/item-sprites.json', JSON.stringify(itemSprites));

// ---------- Naturalezas ----------
const natureName = namesOf(read('nature_names'), 'nature_id');
const naturesOut = {};
for (const n of read('natures')) naturesOut[n.id] = [natureName(n.id) || pretty(n.identifier), +n.increased_stat_id, +n.decreased_stat_id, +n.likes_flavor_id, +n.hates_flavor_id];
fs.writeFileSync(path.join(OUT, 'natures.json'), JSON.stringify(naturesOut));

// ---------- Qué Pokémon (y formas) tienen movimientos en cada juego ----------
const vgDex = {};
for (const [pid, byVg] of learn) {
  if (!keepPid.has(pid)) continue;
  for (const vg of Object.keys(byVg)) (vgDex[vg] ||= []).push(+pid);
}
for (const l of Object.values(vgDex)) l.sort((a, b) => a - b);
fs.writeFileSync(path.join(OUT, 'vg-dex.json'), JSON.stringify(vgDex));

// ---------- Datos para el generador de equipos ----------
// pid -> [total, [ps, atq, def, atesp, defesp, vel], evolución final (1/0), 0 normal | 1 legendario | 2 singular, especial (mega/primigenio/etc.) (1/0), habilidades [[id, oculta]]]
{
  const pool = {};
  const SPECIAL = /-(mega|primal|ash|hero|battle-bond|totem|starter|cap|cosplay|rock-star|belle|pop-star|phd|libre|gmax|eternal|own-tempo|eternamax|ultra|crowned|origin|sunshine|busted|hangry|zen|school|blade|pirouette|noice|complete|10|50|power-construct|dada|gulping|gorging|stellar|terastal|white-striped)/;
  for (const pid of keepPid) {
    const p = pokemonRows.find((x) => x.id === pid);
    if (!p) continue;
    const s = speciesById[p.species_id];
    const stats = (pStats.get(pid) || []).sort((a, b) => +a.stat_id - +b.stat_id).map((x) => +x.base_stat);
    if (stats.length !== 6) continue;
    const final = children.get(String(p.species_id)) ? 0 : 1;
    const legend = s.is_mythical === '1' ? 2 : s.is_legendary === '1' ? 1 : 0;
    const abil = (pAbil.get(p.id) || []).sort((a, b) => +a.slot - +b.slot).map((x) => [+x.ability_id, +x.is_hidden]);
    pool[pid] = [stats.reduce((a, b) => a + b, 0), stats, final, legend, p.is_default !== '1' && SPECIAL.test(p.identifier) ? 1 : 0, abil];
  }
  fs.writeFileSync(path.join(OUT, 'pool.json'), JSON.stringify(pool));
}

// ---------- Nombres en inglés (para compartir en formato Showdown) ----------
{
  const enOnly = (rows, idKey, nameKey = 'name') => {
    const m = {};
    for (const r of rows) if (+r.local_language_id === EN) m[r[idKey]] = r[nameKey];
    return m;
  };
  const enSpecies = enOnly(speciesNameRows, 'pokemon_species_id');
  const enMoves = enOnly(read('move_names'), 'move_id');
  const enAbil = enOnly(read('ability_names'), 'ability_id');
  const enItems = enOnly(read('item_names'), 'item_id');
  const enNat = enOnly(read('nature_names'), 'nature_id');
  const titled = (id) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
  const pokemonEn = {};
  for (const pid of keepPid) {
    const p = pokemonRows.find((x) => x.id === pid);
    if (!p) continue;
    const base = enSpecies[p.species_id] || pretty(speciesById[p.species_id].identifier);
    if (p.is_default === '1') { pokemonEn[pid] = base; continue; }
    const suffix = p.identifier.startsWith(speciesById[p.species_id].identifier + '-') ? p.identifier.slice(speciesById[p.species_id].identifier.length + 1) : p.identifier;
    pokemonEn[pid] = `${base}-${titled(suffix)}`;
  }
  const pick = (m, keep) => Object.fromEntries(Object.entries(m).filter(([k]) => keep[k]));
  fs.writeFileSync(path.join(OUT, 'en.json'), JSON.stringify({
    pokemon: pokemonEn,
    moves: pick(enMoves, learners),
    abilities: pick(enAbil, abilities),
    items: pick(enItems, itemsOut),
    natures: enNat,
  }));
}

for (const [cid, data] of Object.entries(chunks)) {
  fs.writeFileSync(path.join(OUT, 'p', `${cid}.json`), JSON.stringify(data));
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
// Solo los movimientos que algún Pokémon aprende (fuera movimientos Z y Dinamax)
fs.writeFileSync(path.join(OUT, 'moves.json'), JSON.stringify(Object.fromEntries(Object.entries(moves).filter(([mid]) => learners[mid]))));
fs.writeFileSync(path.join(OUT, 'abilities.json'), JSON.stringify(abilities));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
  chunk: CHUNK,
  types: Object.fromEntries(types.map((t) => [t.id, [typeName(t.id), typeIdent[t.id]]])),
  chart,
  versionGroups,
  versions: Object.fromEntries(versions.map((v) => [v.id, [versionName(v.id) || pretty(v.identifier), +v.version_group_id]])),
  encVersions: [...encVersions].sort((a, b) => a - b),
}));
fs.mkdirSync('raw', { recursive: true });
fs.writeFileSync('raw/sprite-ids.json', JSON.stringify([...new Set(spriteIds)].sort((a, b) => a - b)));
console.log(`Listo: ${index.length} especies, ${spriteIds.length} variedades, ${Object.keys(chunks).length} archivos.`);
