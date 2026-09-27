import { useLayoutEffect, useRef } from 'react';

/** FLIP keeps keyed rows alive while their actual layout changes. */
export function useLayoutMotion(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.querySelectorAll<HTMLElement>('[data-motion-id]').forEach(node => {
      const id = node.dataset.motionId!;
      const top = node.offsetTop;
      const old = previous.current.get(id);
      if (!reduced && old !== undefined && old !== top) {
        node.getAnimations().forEach(animation => animation.cancel());
        node.animate([{ transform: `translateY(${old - top}px)` }, { transform: 'translateY(0)' }],
          { duration: 420, easing: 'cubic-bezier(.22,.7,.3,1)' });
      }
      next.set(id, top);
    });
    previous.current = next;
  }, [key]);
  return ref;
}
