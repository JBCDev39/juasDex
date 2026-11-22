// "Vuelo" del sprite entre la lista y la ficha.
// Se copia el sprite, se pone encima de todo y se mueve solo con transform (lo más fluido posible).

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** El sprite tocado en la lista, para que la ficha sepa desde dónde despegar */
export const flight: { id: number; el: HTMLElement | null; fromList: boolean } = { id: 0, el: null, fromList: false };

const inView = (r: DOMRect) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;

export function fly(from: HTMLElement, to: HTMLElement, ms = 420): Promise<void> {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (reduced() || !inView(a) || !inView(b)) return Promise.resolve();

  const ghost = from.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
    margin: '0', zIndex: '70', pointerEvents: 'none', transformOrigin: '0 0', willChange: 'transform', viewTransitionName: 'none',
  });
  document.body.appendChild(ghost);
  from.style.visibility = 'hidden';
  to.style.visibility = 'hidden';

  const s = b.width / a.width;
  const dx = b.left - a.left, dy = b.top - a.top;
  const anim = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 18}px) scale(${1 + (s - 1) * 0.6})`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
    ],
    { duration: ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
  return anim.finished.catch(() => undefined).then(() => {
    ghost.remove();
    from.style.visibility = '';
    to.style.visibility = '';
  });
}

export function animateSheet(el: HTMLElement, dir: 'in' | 'out'): Promise<void> {
  if (reduced()) return Promise.resolve();
  const frames = [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }];
  const anim = el.animate(dir === 'in' ? frames : frames.reverse(), {
    duration: dir === 'in' ? 320 : 260,
    easing: dir === 'in' ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
    fill: dir === 'out' ? 'forwards' : 'none',
  });
  return anim.finished.then(() => undefined, () => undefined);
}
