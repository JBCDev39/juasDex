// Símbolos de tipo dibujados para JuasDex (originales, sencillos, en una caja de 24×24 centrada en 12,12).
// Se dibujan en "currentColor" para poder pintarlos de cualquier color.
import type { ReactNode } from 'react';

const G: Record<string, ReactNode> = {
  normal: <><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.6" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /></>,
  fighting: <><rect x="5" y="8" width="14" height="10" rx="3.5" fill="currentColor" /><path d="M9 8V6.5M12 8V6M15 8V6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /><path d="M5.5 13h6" stroke="var(--glyph-cut, #fff)" strokeWidth="1.6" strokeLinecap="round" /></>,
  flying: <path d="M3 15c3-7 9-10 18-10-2 3-4 5-7 6 2 0 3 0 5-1-2 4-6 7-12 7-1.5 0-3-.7-4-2Z" fill="currentColor" />,
  poison: <><circle cx="10" cy="14" r="5" fill="currentColor" /><circle cx="16.5" cy="8.5" r="3" fill="currentColor" /><circle cx="17.5" cy="15.5" r="1.8" fill="currentColor" /></>,
  ground: <><path d="M2.5 18.5 9 8l3.5 5.5L15 10l6.5 8.5Z" fill="currentColor" /><path d="M4 21h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>,
  rock: <path d="M7 5h8l5 6-3 8H7l-3-7Z" fill="currentColor" />,
  bug: <><ellipse cx="12" cy="13.5" rx="6" ry="7" fill="currentColor" /><path d="M12 7v13" stroke="var(--glyph-cut, #fff)" strokeWidth="1.6" /><path d="M9 4.5l1.8 2.5M15 4.5 13.2 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  ghost: <><path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-2-2-2 2-2-2-2 2-2-2Z" fill="currentColor" /><circle cx="10" cy="11" r="1.5" fill="var(--glyph-cut, #fff)" /><circle cx="14" cy="11" r="1.5" fill="var(--glyph-cut, #fff)" /></>,
  steel: <><path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5Z" fill="currentColor" /><circle cx="12" cy="12" r="3.2" fill="var(--glyph-cut, #fff)" /></>,
  fire: <path d="M12.5 2c.6 3.2 2.6 4.6 4.1 6.6 1.3 1.7 2.1 3.4 2.1 5.3a6.7 6.7 0 0 1-13.4 0c0-2.5 1.1-4.4 2.9-5.9-.1 2 .6 3.3 1.9 3.9-.4-3.6.6-6.7 2.4-9.9Zm-.6 12.2c-1.5 1.1-2.2 2.2-2.2 3.4a2.3 2.3 0 0 0 4.6 0c0-1.2-.8-2.3-2.4-3.4Z" fill="currentColor" fillRule="evenodd" />,
  water: <path d="M12 3c3.5 4.2 6 7.5 6 10.5A6 6 0 0 1 6 13.5C6 10.5 8.5 7.2 12 3Z" fill="currentColor" />,
  grass: <><path d="M5 19C5 10 11 5 19 5c0 8-5 14-14 14Z" fill="currentColor" /><path d="M6.5 17.5l7-7" stroke="var(--glyph-cut, #fff)" strokeWidth="1.6" strokeLinecap="round" /></>,
  electric: <path d="M13 2 5 13h6l-1 9 8-11h-6Z" fill="currentColor" />,
  psychic: <><circle cx="12" cy="12" r="3" fill="currentColor" /><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.4" /></>,
  ice: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
  dragon: <path d="M5 20c0-8 4-14 13-16-3 3-4 5-4 8 1.5-1 3-1.5 5-1.5-3 2-4.5 5-5 9.5Z" fill="currentColor" />,
  dark: <path d="M15.5 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 15.5 3.5Z" fill="currentColor" />,
  fairy: <path d="M12 3l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L12 15.8 6.9 18.9l1.4-5.9L3.7 9.1l6-.5Z" fill="currentColor" />,
};

/** Solo los trazos (para meterlos dentro de otro SVG) */
export const glyphPaths = (ident: string) => G[ident] ?? G.normal;

export function TypeGlyph({ ident, size = 24, className }: { ident: string; size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      {G[ident] ?? G.normal}
    </svg>
  );
}

/** Símbolo de la categoría del movimiento: físico (impacto), especial (ondas), estado (mitad) */
export function ClassGlyph({ c, size = 14 }: { c: number; size?: number }) {
  if (c === 2) return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden><path d="M12 1.5l2.4 5.6L20.4 4l-3.1 5.4 5.2 2.6-5.2 2.6 3.1 5.4-6-3.1L12 22.5l-2.4-5.6L3.6 20l3.1-5.4L1.5 12l5.2-2.6L3.6 4l6 3.1Z" fill="currentColor" /></svg>;
  if (c === 3) return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden><circle cx="12" cy="12" r="3.2" fill="currentColor" /><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" /><circle cx="12" cy="12" r="10.6" fill="none" stroke="currentColor" strokeWidth="1.8" opacity=".55" /></svg>;
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="2.6" /><path d="M12 3.4a8.6 8.6 0 0 1 0 17.2Z" fill="currentColor" /></svg>;
}
