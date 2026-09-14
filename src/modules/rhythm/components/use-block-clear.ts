import { useEffect, useRef, useState, type RefObject } from "react";

export type CompletionAnimationState = "idle" | "pressed" | "confirmed" | "clearing" | "popping";

// A sampled damped spring (k=500, damping=32, mass=.9), calculated once,
// not on each frame. Only the disappearing slot changes layout.
const spring = Array.from({ length: 25 }, (_, i) => {
  const t = i / 24 * .28;
  return i === 24 ? 0 : Math.exp(-17.78 * t) * (Math.cos(15.48 * t) + 17.78 / 15.48 * Math.sin(15.48 * t));
});

interface BlockClearOptions {
  impact?: string;
  content?: string;
  panel?: string;
  item?: string;
  control?: string;
  onReflow?: () => void;
  quiet?: () => boolean;
}

export function useBlockClear(card: RefObject<HTMLElement | null>, retain: (value: boolean) => void, options: BlockClearOptions = {}) {
  const impactSelector = options.impact ?? ".task-completion > span";
  const slot = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const animations = useRef<Animation[]>([]);
  const decorations = useRef<HTMLElement[]>([]);
  const pressAnimations = useRef<Animation[]>([]);
  const [phase, setPhase] = useState<CompletionAnimationState>("idle");
  const active = phase === "confirmed" || phase === "clearing" || phase === "popping";
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = (node: Element, frames: Keyframe[], duration: number, delay = 0) => {
    const animation = node.animate(frames, { duration, delay, fill: "forwards", easing: "linear" });
    animations.current.push(animation);
    // Cancellation is expected on rollback or navigation.
    void animation.finished.catch(() => {});
    return animation;
  };
  const clean = () => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    decorations.current.forEach((node) => node.remove());
    decorations.current = [];
    if (card.current) { card.current.inert = false; delete card.current.dataset.clearPhase; }
  };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clean(); };
    // The refs belong to this mounted card, independent of parent rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const transition = (value: CompletionAnimationState) => {
    if (!mounted.current) return;
    setPhase(value);
    if (card.current) card.current.dataset.clearPhase = value;
  };
  const release = () => {
    if (locked.current) return;
    pressAnimations.current.forEach((animation) => animation.cancel());
    animations.current = animations.current.filter((animation) => !pressAnimations.current.includes(animation));
    pressAnimations.current = [];
    transition("idle");
  };
  const press = () => {
    if (locked.current || !card.current || phase === "pressed") return;
    transition("pressed");
    if (reduced()) return;
    pressAnimations.current = [
      animate(card.current, [{ transform: "scale(1)" }, { transform: "scale(.99, .96)" }], 80),
      animate(card.current.querySelector(impactSelector)!, [{ transform: "scale(1)" }, { transform: "scale(.86)" }], 80),
    ];
  };
  const decoration = (parent: HTMLElement, className: string) => {
    const node = document.createElement("i");
    node.className = className;
    node.setAttribute("aria-hidden", "true");
    parent.append(node);
    decorations.current.push(node);
    return node;
  };
  const handoffFocus = (row: HTMLElement) => {
    if (!row.contains(document.activeElement)) return;
    const panel = row.closest<HTMLElement>(options.panel ?? ".tasks-panel");
    const rows = Array.from(panel?.querySelectorAll<HTMLElement>(options.item ?? ".tasks-row") ?? []);
    const index = rows.indexOf(row);
    const adjacent = [...rows.slice(index + 1), ...rows.slice(0, index).reverse()]
      .find((item) => !item.inert && !["confirmed", "clearing", "popping"].includes(item.dataset.clearPhase ?? ""));
    const control = options.control ?? 'input[type="checkbox"]';
    (adjacent?.matches(control) ? adjacent : adjacent?.querySelector<HTMLElement>(control) ?? panel)?.focus({ preventScroll: true });
  };
  const sequence = async () => {
    const row = card.current!, shell = slot.current!;
    const height = shell.getBoundingClientRect().height;
    const gap = shell.parentElement!.querySelectorAll(":scope > .task-clear-slot").length > 1 ? 12 : 0;
    const checkbox = row.querySelector<HTMLElement>(impactSelector)!;
    transition("confirmed"); // Future sound/haptic integration has one impact event here.
    if (reduced() || options.quiet?.()) {
      await animate(row, [{ opacity: 1, backgroundColor: options.quiet?.() ? "var(--glass)" : "var(--accent)" }, { opacity: 0 }], 150).finished;
      handoffFocus(row);
      row.inert = true;
      options.onReflow?.();
      await animate(shell, [{ height: `${height}px`, marginBottom: "0px" }, { height: "0px", marginBottom: `${-gap}px` }], 100).finished;
      return;
    }
    animate(checkbox, [{ transform: "scale(.86)" }, { transform: "scale(1.12)", offset: .6 }, { transform: "scale(1)" }], 120);
    animate(row, [{ transform: "scale(.99,.96)" }, { transform: "scale(1.012,.99)", borderColor: "var(--accent)", offset: .6 }, { transform: "scale(1)", borderColor: "#ffffff80" }], 120);
    const ring = decoration(checkbox, "block-impact-ring");
    await animate(ring, [{ transform: "scale(.8)", opacity: .7 }, { transform: "scale(1.7)", opacity: 0 }], 100).finished;
    transition("clearing");
    const wave = decoration(row, "block-clear-wave");
    const bounds = row.getBoundingClientRect();
    for (const content of row.querySelectorAll<HTMLElement>(options.content ?? ".tasks-row-name, .tasks-row-controls, .task-completion")) {
      const box = content.getBoundingClientRect();
      animate(content, [{ clipPath: "inset(0 0 0 0)", filter: "brightness(1.3)" }, { clipPath: "inset(0 0 0 100%)", filter: "brightness(1)" }], 220 * box.width / bounds.width, 220 * (box.left - bounds.left) / bounds.width);
    }
    await animate(wave, [{ transform: "translateX(-100%)" }, { transform: "translateX(600%)" }], 220).finished;
    transition("popping");
    const effects = decoration(shell, "block-pop-effects");
    effects.style.height = `${height}px`;
    const shockwave = decoration(effects, "block-shockwave");
    animate(shockwave, [{ transform: "scale(.94,.7)", opacity: .7 }, { transform: "scale(1,.98)", opacity: 0 }], 240);
    // Precomputed distributions: rerenders never change particle paths. All paths
    // remain clipped to the original tile, clear of neighbouring cards.
    for (let i = 0; i < 10; i++) {
      const particle = decoration(effects, `block-fragment block-fragment-${i % 3}`);
      particle.style.left = `${12 + i * 8.2}%`;
      particle.style.top = `${30 + (i % 3) * 20}%`;
      const dx = (i % 2 ? 1 : -1) * (20 + (i * 7) % 35);
      const dy = (i % 3 - 1) * 12;
      const turn = (i % 2 ? 1 : -1) * (12 + i * 2);
      animate(particle, [
        { transform: "translate(0,0) scale(.5)", opacity: 0 },
        { transform: `translate(${dx * .3}px,${dy * .3}px) rotate(${turn / 2}deg) scale(1.4,.85)`, opacity: .9, offset: .25 },
        { transform: `translate(${dx}px,${dy}px) rotate(${turn}deg) scale(.1)`, opacity: 0 },
      ], 240);
    }
    const pop = animate(row, [
      { transform: "scale(1)", opacity: 1, borderRadius: "20px", filter: "blur(0px)" },
      { transform: "scale(1.02)", opacity: 1, borderRadius: "24px", offset: .14 },
      { transform: "scale(.86,.22)", opacity: .25, filter: "blur(2px)", offset: .48 },
      { transform: "scale(.82,.12)", opacity: 0, filter: "blur(4px)" },
    ], 220);
    handoffFocus(row);
    row.inert = true;
    options.onReflow?.();
    const reflow = animate(shell, spring.map((value) => ({ height: `${Math.max(0, height * value)}px`, marginBottom: `${-gap * (1 - value) + Math.min(0, height * value)}px` })), 240, 60);
    await Promise.all([pop.finished, reflow.finished]);
    decorations.current.forEach((node) => node.remove());
    decorations.current = [];
  };
  const complete = async (save: () => Promise<boolean>) => {
    if (locked.current || !card.current || !slot.current) return;
    locked.current = true;
    retain(true);
    const visual = sequence();
    void visual.catch(() => {});
    let saved = false;
    try { saved = await save(); } catch { /* library.save normally reports failures itself */ }
    if (!mounted.current) { retain(false); return; }
    if (saved) {
      try { await visual; } catch { /* Navigation may cancel the visual sequence. */ }
    }
    if (mounted.current) {
      clean();
      locked.current = false;
      transition("idle");
    }
    retain(false);
  };
  return { slot, phase, active, locked, press, release, complete };
}
