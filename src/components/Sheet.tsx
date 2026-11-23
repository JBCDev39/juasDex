import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Db } from '../types';
import type { Route } from '../nav';
import { animateSheet, flight, fly } from '../flight';
import Detail from './Detail';
import MovePage from './MovePage';
import AbilityPage from './AbilityPage';

/** Capa que se abre encima de la lista. Adentro cambia de pantalla (Pokémon, movimiento, habilidad). */
export default function Sheet({ db, route, closing, onClosed }: { db: Db; route: NonNullable<Route>; closing: boolean; onClosed: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const key = `${route.kind}-${route.id}`;
  const lastKey = useRef(key);
  const dir = entered.current ? document.documentElement.dataset.nav || 'none' : 'start';

  // Mientras está abierta, la página de atrás no se mueve
  useEffect(() => {
    document.documentElement.classList.add('locked');
    return () => document.documentElement.classList.remove('locked');
  }, []);

  // Entrada: la capa sube y, si venimos de una tarjeta, el sprite vuela hasta la pantalla
  useLayoutEffect(() => {
    if (entered.current || !ref.current) return;
    entered.current = true;
    const hero = ref.current.querySelector<HTMLElement>('.hero__sprite .sprite');
    if (route.kind === 'pokemon' && flight.id === route.id && flight.el && hero) void fly(flight.el, hero, 440);
    flight.el = null;
    void animateSheet(ref.current, 'in');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de pantalla adentro, empezar arriba
  useLayoutEffect(() => {
    if (lastKey.current !== key && ref.current) ref.current.scrollTop = 0;
    lastKey.current = key;
  }, [key]);

  // Salida: la capa baja y el sprite vuelve a su tarjeta (si está a la vista)
  useLayoutEffect(() => {
    if (!closing || !ref.current) return;
    document.documentElement.classList.remove('locked');
    const jobs: Promise<void>[] = [animateSheet(ref.current, 'out')];
    if (route.kind === 'pokemon') {
      const hero = ref.current.querySelector<HTMLElement>('.hero__sprite .sprite');
      const card = document.querySelector<HTMLElement>(`[data-card="${route.id}"] .sprite`);
      if (hero && card) jobs.push(fly(hero, card, 400));
    }
    void Promise.all(jobs).then(onClosed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  return (
    <div ref={ref} className="sheet" role="dialog" aria-modal="true">
      <div key={key} className={`sheet__page from-${dir}`}>
        {route.kind === 'pokemon' && <Detail db={db} id={route.id} />}
        {route.kind === 'mov' && <MovePage db={db} id={route.id} />}
        {route.kind === 'hab' && <AbilityPage db={db} id={route.id} />}
      </div>
    </div>
  );
}
