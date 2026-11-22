// Junta los sprites en hojas (atlas) de 10x10 para que la app funcione sin conexión.
// Genera dos juegos con la misma distribución: normales (s*.webp) y variocolor (ss*.webp).
// Uso: node scripts/build-sprites.mjs <carpeta-png> <carpeta-salida> [carpeta-png-variocolor]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [, , SRC = 'raw/sprites', OUT = 'public/sprites', SHINY = 'raw/sprites-shiny'] = process.argv;
const CELL = 96, COLS = 10, PER = 100;
const ids = JSON.parse(fs.readFileSync('raw/sprite-ids.json', 'utf8'));
const have = ids.filter((id) => fs.existsSync(path.join(SRC, `${id}.png`)));
fs.mkdirSync(OUT, { recursive: true });

const tile = (file) => sharp(file)
  .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'nearest' })
  .png().toBuffer();

const map = {};
for (const [prefix, dir] of [['s', SRC], ['ss', SHINY]]) {
  for (let s = 0; s * PER < have.length; s++) {
    const batch = have.slice(s * PER, (s + 1) * PER);
    const tiles = await Promise.all(batch.map(async (id, i) => {
      const own = path.join(dir, `${id}.png`);
      const file = fs.existsSync(own) ? own : path.join(SRC, `${id}.png`); // sin variocolor → normal
      map[id] = [s, i];
      return { input: await tile(file), left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL };
    }));
    const rows = Math.ceil(batch.length / COLS);
    await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(tiles).webp({ lossless: true, effort: 6 }).toFile(path.join(OUT, `${prefix}${s}.webp`));
  }
}
fs.writeFileSync('public/data/sprite-map.json', JSON.stringify(map));
console.log(`Listo: ${have.length} sprites en ${Math.ceil(have.length / PER)} hojas (x2).`);
