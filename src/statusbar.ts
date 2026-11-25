// Color de la barra del teléfono (hora, batería): toma el color de lo que esté arriba de la pantalla.
// Así combina con el rojo del inicio, la barra de pestañas, el mini encabezado de la ficha, etc.
const meta = () => document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 1;
const ctx = canvas.getContext('2d', { willReadFrequently: true });

/** Convierte cualquier color CSS (incluido color-mix) a [r, g, b, alfa] */
function rgba(css: string): [number, number, number, number] | null {
  if (!ctx || !css || css === 'transparent') return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}
const firstColor = (img: string) => img.match(/(?:rgba?|color|oklab|oklch|hsla?)\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-f]{3,8}/i)?.[0] ?? '';

function sample(): string | null {
  let el = document.elementFromPoint(window.innerWidth / 2, 2) as HTMLElement | null;
  while (el) {
    const cs = getComputedStyle(el);
    const bg = rgba(cs.backgroundColor);
    if (bg && bg[3] > 0.5) return `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
    if (cs.backgroundImage.includes('gradient')) {
      const c = rgba(firstColor(cs.backgroundImage));
      if (c && c[3] > 0.5) return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
    el = el.parentElement;
  }
  const b = rgba(getComputedStyle(document.body).backgroundColor);
  return b ? `rgb(${b[0]}, ${b[1]}, ${b[2]})` : null;
}

let raf = 0;
let last = '';
const update = () => {
  raf = 0;
  const c = sample();
  if (c && c !== last) { last = c; meta()?.setAttribute('content', c); }
};
const soon = () => { if (!raf) raf = requestAnimationFrame(update); };

export function watchStatusBar() {
  window.addEventListener('scroll', soon, { capture: true, passive: true });
  window.addEventListener('resize', soon);
  // Al cambiar de pantalla, esperar a que termine la animación de entrada/salida
  window.addEventListener('hashchange', () => { soon(); window.setTimeout(soon, 120); window.setTimeout(soon, 480); });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', soon);
  window.setTimeout(soon, 300);
  // El mini encabezado aparece con una transición: revisar al terminar
  document.addEventListener('transitionend', soon, { passive: true });
}
