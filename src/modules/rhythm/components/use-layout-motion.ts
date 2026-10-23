import { useEffect, useLayoutEffect, useRef } from 'react';

/** FLIP keeps keyed rows alive while their actual layout changes. */
export function useLayoutMotion(key: string, duration = 420, easing = 'cubic-bezier(.22,.7,.3,1)', recoveryPresence = false) {
  const ref = useRef<HTMLDivElement>(null);
  const ghosts = useRef(new Set<HTMLElement>());
  const snapshots = useRef(new Map<string,{node:HTMLElement;top:number;height:number;width:number}>());
  useEffect(() => () => { ghosts.current.forEach(node => node.remove()); }, []);
  const previous = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const nextSnapshots = new Map<string,{node:HTMLElement;top:number;height:number;width:number}>();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.querySelectorAll<HTMLElement>('[data-motion-id]').forEach(node => {
      const id = node.dataset.motionId!;
      const top = node.offsetTop;
      const old = previous.current.get(id);
      if (!node.dataset.motionDragging && !reduced && old !== undefined && old !== top) {
        node.getAnimations().forEach(animation => animation.cancel());
        node.animate([{ transform: `translateY(${old - top}px)` }, { transform: 'translateY(0)' }],
          { duration, easing });
      }
      if (recoveryPresence && node.classList.contains('is-recovery')) {
        if (!reduced && old === undefined) node.animate([{opacity:0,scale:'.98'},{opacity:1,scale:'1'}],{duration:220,easing:'ease-out'});
        nextSnapshots.set(id,{node:node.cloneNode(true) as HTMLElement,top,height:node.offsetHeight,width:node.offsetWidth});
      }
      next.set(id, top);
    });
    if (recoveryPresence && !reduced) snapshots.current.forEach((snapshot,id) => {
      if (next.has(id) || !ref.current) return;
      const ghost = snapshot.node;
      ghost.removeAttribute('data-motion-id');
      ghost.querySelectorAll('[data-motion-id]').forEach(child => child.removeAttribute('data-motion-id'));
      ghost.setAttribute('aria-hidden','true'); ghost.inert=true;
      Object.assign(ghost.style,{position:'absolute',top:`${snapshot.top}px`,left:'0',width:`${snapshot.width}px`,height:`${snapshot.height}px`,pointerEvents:'none',zIndex:'1'});
      ref.current.append(ghost); ghosts.current.add(ghost);
      const animation = ghost.animate([{opacity:1},{opacity:0}],{duration:160,easing:'ease-out',fill:'forwards'});
      void animation.finished.catch(() => {}).finally(() => {ghost.remove();ghosts.current.delete(ghost);});
    });
    snapshots.current = nextSnapshots;
    previous.current = next;
  }, [key, duration, easing, recoveryPresence]);
  return ref;
}
