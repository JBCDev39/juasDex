// Junta los dibujos de objetos en una sola hoja para que funcionen sin conexión.
// Uso: node scripts/build-item-sprites.mjs <carpeta-png> <carpeta-salida>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [, , SRC = 'raw/items', OUT = 'public/sprites'] = process.argv;
const CELL = 60, COLS = 16;
const ids = JSON.parse(fs.readFileSync('raw/item-sprites.json', 'utf8')).filter((id) => fs.existsSync(path.join(SRC, `${id}.png`)));

const map = {};
const tiles = await Promise.all(ids.map(async (id, i) => {
  const file = path.join(SRC, `${id}.png`);
  const { width = CELL } = await sharp(file).metadata();
  // Los dibujos pequeños (pixel art) se agrandan sin suavizar; los grandes se reducen con suavizado
  const kernel = width <= 40 ? 'nearest' : 'lanczos3';
  const buf = await sharp(file).resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel }).png().toBuffer();
  map[id] = i;
  return { input: buf, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL };
}));
await sharp({ create: { width: COLS * CELL, height: Math.ceil(ids.length / COLS) * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles).webp({ lossless: true, effort: 6 }).toFile(path.join(OUT, 'items.webp'));
fs.writeFileSync('public/data/item-sprite-map.json', JSON.stringify(map));
console.log(`Listo: ${ids.length} objetos.`);
