"""Lugares para DBPR, Leyendas Arceus, Escarlata/Púrpura y Z-A (no están en PokéAPI).
Fuente: datos de encuentros y nombres de lugares en español del proyecto PKHeX (github.com/kwsch/PKHeX).
Uso: python3 scripts/build-pkhex-enc.py <carpeta PKHeX> raw/pkhex-enc.json
Salida: [[versión, especie, forma, lugar, método, nivel mín, nivel máx], ...]"""
import json, os, re, struct, sys
ROOT = sys.argv[1]; OUT = sys.argv[2]
CORE = os.path.join(ROOT, 'PKHeX.Core')
W = os.path.join(CORE, 'Resources/legality/wild/')
T = os.path.join(CORE, 'Resources/text/locations/')
DATA = os.path.join(CORE, 'Legality/Encounters/Data/')

def links(path, b16=False):
    d = open(path, 'rb').read(); n = struct.unpack_from('<H', d, 2)[0]; out = []
    for i in range(n):
        s, e = struct.unpack_from('<HH' if b16 else '<ii', d, 4 + i * (2 if b16 else 4)); out.append(d[s:e])
    return out

def texts(folder, game):
    names = {}
    for base in (0, 30000, 40000, 60000):
        p = f'{T}{folder}/text_{game}_{base:05d}_es.txt'
        if os.path.exists(p):
            for i, line in enumerate(open(p, encoding='utf-8').read().split('\n')):
                if line.strip(): names[base + i] = line.strip()
    return names

rows = []
def add(v, sp, form, place, method, lo, hi):
    if sp and place: rows.append([v, sp, form, place, method, lo, hi])

# ---------- Diamante Brillante (37) / Perla Reluciente (38) ----------
BD = texts('gen8b', 'bdsp')
M8B = {1: 'Hierba / cueva', 2: 'Surf', 3: 'Caña Vieja', 4: 'Caña Buena', 5: 'Supercaña', 6: 'Golpe Roca', 7: 'Golpe Cabeza', 8: 'Árbol de miel'}
for v, files in ((37, ['bd', 'bd_underground']), (38, ['sp', 'sp_underground'])):
    for f in files:
        for a in links(f'{W}Gen8/encounter_{f}.pkl'):
            loc = struct.unpack_from('<H', a, 0)[0]; typ = a[2]
            method = 'Gran Subsuelo' if 'underground' in f else M8B.get(typ, 'Salvaje')
            for o in range(4, len(a), 4):
                s = struct.unpack_from('<H', a, o)[0]
                add(v, s & 0x3FF, s >> 11, BD.get(loc), method, a[o + 2], a[o + 3])

# ---------- Leyendas Arceus (39) ----------
LA = texts('gen8a', 'la')
M8A = {0: 'Salvaje', 1: 'Distorsión espaciotemporal', 2: 'Árboles, rocas o nieve', 3: 'Aparición masiva', 4: 'Aparición masiva enorme'}
for a in links(f'{W}Gen8/encounter_la.pkl'):
    lc = a[0]; locs = list(a[1:1 + lc]); al = lc + 1; al += al & 1; b = a[al:]; typ = b[0]; cnt = b[1]
    field = LA.get(locs[0], '')
    subs = [LA.get(x) for x in locs[1:] if LA.get(x)]
    places = [field] if not subs or len(subs) > 8 else [f'{field} · {s}' for s in subs]
    for i in range(cnt):
        e = b[2 + i * 8:10 + i * 8]; sp = struct.unpack_from('<H', e, 0)[0]
        m = M8A.get(typ, 'Salvaje') + (' · Alfa' if e[3] else '')
        for p in places: add(39, sp, e[2], p, m, e[4], e[5])

# ---------- Escarlata (40) / Púrpura (41) ----------
SV = texts('gen9', 'sv')
SCARLET = {37, 38, 207, 246, 247, 248, 408, 409, 425, 426, 434, 435, 472, 633, 634, 635, 690, 691, 765, 845, 874, 936, 984, 985, 986, 987, 988, 989, 1005, 1007, 1009, 1020, 1021}
VIOLET = {27, 28, 190, 200, 316, 317, 371, 372, 373, 410, 411, 424, 429, 692, 693, 766, 875, 877, 885, 886, 887, 937, 990, 991, 992, 993, 994, 995, 1006, 1008, 1010, 1022, 1023}
def sv_versions(sp, form):
    if sp == 128 and form == 2: return [40]
    if sp == 128 and form == 3: return [41]
    if sp in SCARLET: return [40]
    if sp in VIOLET: return [41]
    return [40, 41]
for a in links(f'{W}Gen9/encounter_wild_paldea.pkl'):
    loc = a[2] or a[0]
    for o in range(4, len(a), 8):
        sp = struct.unpack_from('<H', a, o)[0]; form = a[o + 2]
        for v in sv_versions(sp, form): add(v, sp, form, SV.get(loc), 'Salvaje', a[o + 4], a[o + 5])
fx = open(f'{W}Gen9/encounter_fixed_paldea.pkl', 'rb').read()
for i in range(0, len(fx) - 0x13, 0x14):
    sp = struct.unpack_from('<H', fx, i)[0]; form = fx[i + 2]; lvl = fx[i + 3]
    for loc in {fx[i + 0x10], fx[i + 0x11], fx[i + 0x12], fx[i + 0x13]} - {0}:
        for v in sv_versions(sp, form): add(v, sp, form, SV.get(loc), 'Encuentro fijo', lvl, lvl)

# ---------- Leyendas Z-A (47) y Megadimensión (48) ----------
ZA = texts('gen9a', 'za')
for f, v in (('za', 47), ('hyperspace_za', 48)):
    for a in links(f'{W}Gen9/encounter_{f}.pkl', b16=True):
        loc = struct.unpack_from('<H', a, 0)[0]
        for o in range(4, len(a), 8):
            sp = struct.unpack_from('<H', a, o)[0]
            add(v, sp, a[o + 2], ZA.get(loc), 'Salvaje · Alfa' if a[o + 6] == 1 else 'Salvaje', a[o + 4], a[o + 5])

# ---------- Encuentros fijos y regalos (escritos en el código de PKHeX) ----------
def statics(path, names, versions_of, positional=False):
    section = ''; array = ''
    for line in open(path, encoding='utf-8'):
        m = re.search(r'static readonly (\w+)\[\] (\w+)', line)
        if m: array = m.group(2); section = ''; continue
        c = re.match(r'\s*//\s*(.+)', line)
        if c: section = c.group(1); continue
        if 'new(' not in line or 'Location' not in line or 'Trade' in array: continue
        loc = re.search(r'Location\s*=\s*(\d+)', line)
        if not loc: continue
        if positional:
            p = re.search(r'new\((\d+),\s*(\d+),\s*(\d+)', line)
            if not p: continue
            sp, form, lvl = int(p.group(1)), int(p.group(2)), int(p.group(3))
        else:
            s = re.search(r'Species\s*=\s*(\d+)', line); l = re.search(r'Level\s*=\s*(\d+)', line); f = re.search(r'Form\s*=\s*(\d+)', line)
            if not s: continue
            sp, lvl, form = int(s.group(1)), int(l.group(1)) if l else 0, int(f.group(1)) if f else 0
        vtag = re.search(r'new\(\s*(\w+)\s*\)', line)
        gift = re.search(r'gift|starter|fossil|regalo', section + ' ' + array, re.I)
        method = 'Fósil' if re.search(r'fossil', section, re.I) else 'Regalo' if gift else 'Encuentro fijo'
        for v in versions_of(vtag.group(1) if vtag else ''):
            add(v, sp, form, names.get(int(loc.group(1))), method, lvl, lvl)

statics(f'{DATA}Gen8/Encounters8b.cs', BD, lambda t: {'BD': [37], 'SP': [38]}.get(t, [37, 38]))
statics(f'{DATA}Gen8/Encounters8a.cs', LA, lambda t: [39], positional=True)
statics(f'{DATA}Gen9/Encounters9.cs', SV, lambda t: {'SL': [40], 'VL': [41]}.get(t, [40, 41]))
statics(f'{DATA}Gen9/Encounters9a.cs', ZA, lambda t: [47], positional=True)

json.dump(rows, open(OUT, 'w'), ensure_ascii=False)
from collections import Counter
print(len(rows), Counter(r[0] for r in rows), Counter(r[4] for r in rows).most_common(12))

# ---------- Nombres de lugares en español para los juegos viejos (inglés -> español) ----------
import glob
en2es = {}
for es in sorted(glob.glob(T + '*/*_es.txt')):
    en = es.replace('_es.txt', '_en.txt')
    if not os.path.exists(en): continue
    for a, b in zip(open(en, encoding='utf-8').read().split('\n'), open(es, encoding='utf-8').read().split('\n')):
        a, b = a.strip(), b.strip()
        if a and b and a.lower() not in en2es: en2es[a.lower()] = b
json.dump(en2es, open(os.path.join(os.path.dirname(OUT), 'place-names-es.json'), 'w'), ensure_ascii=False)
print('nombres de lugares', len(en2es))
