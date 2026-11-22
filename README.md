# JuasDex

Pokédex en español que funciona sin conexión: tipos, debilidades, habilidades, estadísticas, movimientos por juego (nivel, MT/MO, huevo y tutor), cadenas evolutivas y ubicaciones.

Hecha con Vite + React + TypeScript + Tailwind, como PWA instalable. Todos los datos van incluidos en la app, así que no depende de ningún servidor.

## Cómo se generan los datos

Los datos salen de los CSV de [PokéAPI](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv) y se convierten en archivos JSON pequeños con los nombres oficiales en español de España.

```bash
npm install
# 1. Descargar los CSV de PokéAPI a raw/csv (ver scripts/build-data.mjs para ver qué tablas se usan)
npm run data      # genera public/data/*.json
# 2. Descargar los sprites a raw/sprites/<id>.png
npm run sprites   # junta los sprites en public/sprites/s*.webp
```

`raw/` no se sube a GitHub. Los archivos ya generados en `public/` sí se suben.

## Desarrollo

```bash
npm run dev       # servidor local
npm run build     # versión final en dist/
```

## Publicar en GitHub Pages

Como `base` es `./`, la carpeta `dist/` funciona tal cual en `https://<usuario>.github.io/juasdex/`.

## Limitaciones conocidas

- PokéAPI no tiene ubicaciones para Diamante Brillante/Perla Reluciente, Leyendas: Arceus, Escarlata/Púrpura ni Leyendas: Z-A.
- Muchos nombres de lugares solo existen en inglés en PokéAPI.
- Los Pokémon de la 9.ª generación todavía no tienen descripción ni categoría en español.

Pokémon y sus nombres son marcas de Nintendo, Game Freak y The Pokémon Company. Datos de PokéAPI.
