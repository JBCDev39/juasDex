// En pantallas grandes la interfaz crece con la ventana (hasta 1.8×), para no dejar tanto espacio vacío.
// Se usa la propiedad CSS "zoom" en los contenedores principales; --z guarda el factor actual.
export const zoomOK = typeof CSS !== 'undefined' && Boolean(CSS.supports?.('zoom', '2'));

export const uiZoom = () => (zoomOK ? Number(document.documentElement.style.getPropertyValue('--z')) || 1 : 1);

export function watchZoom() {
  const set = () => {
    const z = zoomOK ? Math.min(1.8, Math.max(1, Math.min(window.innerWidth / 1100, window.innerHeight / 760))) : 1;
    document.documentElement.style.setProperty('--z', String(Math.round(z * 100) / 100));
  };
  set();
  window.addEventListener('resize', set);
}
