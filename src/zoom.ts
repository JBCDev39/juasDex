// En pantallas grandes la interfaz crece un poco con la ventana (hasta 1.25×), para no dejar tanto espacio vacío.
// Se usa la propiedad CSS "zoom" en los contenedores principales; --z guarda el factor actual.
export const zoomOK = typeof CSS !== 'undefined' && Boolean(CSS.supports?.('zoom', '2'));

export const uiZoom = () => (zoomOK ? Number(document.documentElement.style.getPropertyValue('--z')) || 1 : 1);

export function watchZoom() {
  const set = () => {
    // Crecimiento suave: solo un 30 % de lo que sobra de pantalla, con tope de 1.25
    const room = Math.min(window.innerWidth / 1100, window.innerHeight / 760);
    const z = zoomOK ? Math.min(1.25, Math.max(1, 1 + (room - 1) * 0.3)) : 1;
    document.documentElement.style.setProperty('--z', String(Math.round(z * 100) / 100));
  };
  set();
  window.addEventListener('resize', set);
}
