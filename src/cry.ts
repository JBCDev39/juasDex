// Gritos de los Pokémon (repositorio de PokéAPI). Se descargan al tocar el botón;
// el service worker los guarda para que después funcionen sin conexión.
const BASE = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon';
const cache = new Map<number, string>();

const getUrl = async (pid: number) => {
  const hit = cache.get(pid);
  if (hit) return hit;
  for (const kind of ['latest', 'legacy']) {
    const res = await fetch(`${BASE}/${kind}/${pid}.ogg`);
    if (res.ok) {
      const url = URL.createObjectURL(await res.blob());
      cache.set(pid, url);
      return url;
    }
  }
  throw new Error('sin grito');
};

export async function playCry(pid: number): Promise<HTMLAudioElement> {
  const audio = new Audio(await getUrl(pid));
  audio.volume = 0.6;
  await audio.play();
  return audio;
}
