// "Atrás" de Android (gesto o botón) para menús y paneles temporales.
// Cada panel abierto agrega una entrada al historial con la misma dirección.
// Si la persona va atrás, se cierra el panel de arriba en vez de salir de la pantalla.
// Si el panel se cierra de otra forma (tocando afuera, eligiendo algo), se quita esa entrada.
import { useEffect, useRef } from 'react';

type Entry = { id: number; close: () => void; hash: string; d: number };
const stack: Entry[] = [];
let seq = 0;
let pending = 0; // retrocesos hechos por la app que todavía no terminan
let queue: (() => void)[] = [];

const state = () => (history.state ?? {}) as { d?: number; popup?: number };

window.addEventListener('popstate', () => {
  if (pending > 0) pending--;
  const here = state().popup ?? 0;
  // Cerrar todo panel abierto que quedó "adelante" en el historial
  while (stack.length && stack[stack.length - 1].id > here) stack.pop()!.close();
  if (pending === 0 && queue.length) { const q = queue; queue = []; q.forEach((f) => f()); }
});

/** Ejecuta algo cuando terminen los retrocesos pendientes (para no pisar el historial) */
export const afterBack = (fn: () => void) => { if (pending > 0) queue.push(fn); else fn(); };

/** Retrocede n entradas avisando que es la app (no la persona) */
export const goBack = (n: number) => { if (n <= 0) return; pending++; history.go(-n); };

/** Cuántos paneles abiertos tiene la pantalla actual */
export const popupsHere = () => stack.filter((e) => e.hash === location.hash && e.d === (state().d ?? 0)).length;
export const popupsOpen = () => stack.length;

function open(close: () => void) {
  const id = ++seq;
  const s = state();
  history.pushState({ ...s, popup: id }, '', location.href);
  stack.push({ id, close, hash: location.hash, d: s.d ?? 0 });
  return id;
}

function shut(id: number) {
  const i = stack.findIndex((e) => e.id === id);
  if (i < 0) return; // ya se cerró con "atrás"
  stack.splice(i, 1);
  if (state().popup === id) goBack(1);
}

/** Mientras `isOpen` sea verdadero, "atrás" llama a `close` */
export function useBackClose(isOpen: boolean, close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!isOpen) return undefined;
    const id = open(() => ref.current());
    return () => shut(id);
  }, [isOpen]);
}
