import { useLayoutEffect, useRef, type PointerEvent, type CSSProperties } from 'react';
import { radialInfluence, snapClockAngle, type ClockTime, type ClockSelectionMode, type FiveMinute } from '../clock-time';

export interface ClockRangeVisual {
  startAngle: number;
  sweepAngle: number;
  durationLabel: string;
  startLabel: string;
  endLabel: string;
}
interface ClockPickerProps {
  value: ClockTime;
  mode: ClockSelectionMode;
  complete: boolean;
  interactionId: string;
  range?: ClockRangeVisual;
  onAdvance(): void;
  onHourSelect(hour: number): void;
  onMinuteSelect(minute: FiveMinute): void;
}
const position = (angle: number, radius: number) => ({
  left: `${50 + Math.sin(angle * Math.PI / 180) * radius}%`,
  top: `${50 - Math.cos(angle * Math.PI / 180) * radius}%`,
});
interface Preview { angle: number; index: number }

export function ClockPicker({ value, mode, complete, interactionId, range, onHourSelect, onMinuteSelect, onAdvance }: ClockPickerProps) {
  const face = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const bounds = useRef<DOMRect | null>(null);
  const preview = useRef<Preview | null>(null);
  const frame = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const angles = useRef({ hour: value.hour * 30, minute: value.minute * 6 });
  const nodes = useRef<{ hand: HTMLElement; ticks: HTMLElement[]; labels: HTMLButtonElement[]; output: HTMLOutputElement } | null>(null);
  const advance = useRef(onAdvance);
  useLayoutEffect(() => { advance.current = onAdvance; });
  const selectedIndex = mode === 'hour' ? value.hour % 12 : value.minute / 5;

  function paint(next: Preview | null, animate = false) {
    const elements = nodes.current;
    if (!elements) return;
    const angle = next?.angle ?? selectedIndex * 30;
    const previous = angles.current[mode];
    const degrees = previous + ((angle - ((previous % 360 + 360) % 360) + 540) % 360 - 180);
    angles.current[mode] = degrees;
    elements.hand.style.transition = animate ? 'transform 140ms ease-out' : 'none';
    elements.hand.style.transform = `rotate(${degrees}deg)`;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const element of [...elements.ticks, ...elements.labels]) {
      const influence = radialInfluence(Number(element.dataset.angle), angle);
      element.style.setProperty('--lift', String(reducedMotion ? 0 : influence));
      element.style.setProperty('--emphasis', String(influence));
      element.style.transitionDuration = animate ? '140ms' : '0ms';
    }
    elements.output.hidden = !next;
    elements.output.value = next ? String(mode === 'hour' ? next.index || 12 : next.index * 5).padStart(mode === 'hour' ? 1 : 2, '0') : '';
  }
  function cancel() {
    pointer.current = null;
    preview.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    paint(null, true);
  }
  function schedule(next: Preview | null) {
    preview.current = next;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; paint(preview.current); });
  }

  useLayoutEffect(() => {
    const root = face.current!;
    const layer = root.querySelector<HTMLElement>(`[data-ring="${mode}"]`)!;
    nodes.current = {
      hand: layer.querySelector<HTMLElement>('.radial-hand')!,
      ticks: Array.from(layer.querySelectorAll<HTMLElement>('.radial-tick')),
      labels: Array.from(layer.querySelectorAll<HTMLButtonElement>('button')),
      output: root.querySelector<HTMLOutputElement>('output')!,
    };
    pointer.current = null;
    preview.current = null;
    // Clear the outgoing mode's lift before its layer dissolves.
    root.querySelectorAll<HTMLElement>(`.radial-layer:not([data-ring="${mode}"]) [data-angle]`).forEach(node => {
      node.style.setProperty('--lift', '0'); node.style.setProperty('--emphasis', '0');
    });
    paint(null, true);
    const measure = () => { bounds.current = root.getBoundingClientRect(); };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    if (!complete && root.contains(document.activeElement)) {
      layer.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    }
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (settle.current !== null) clearTimeout(settle.current);
      frame.current = null; settle.current = null;
    };
  }, [mode, complete, interactionId]);

  useLayoutEffect(() => {
    if (settle.current === null) paint(null, true);
  }, [value.hour, value.minute, value.period]);

  function readPointer(event: PointerEvent<HTMLDivElement>): Preview | null {
    const rect = bounds.current;
    if (!rect) return null;
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    if (x === 0 && y === 0) return null;
    return { angle: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360, index: snapClockAngle(x, y, 12) };
  }
  function commit(index: number) {
    if (settle.current !== null || complete) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    preview.current = null;
    paint({ angle: index * 30, index }, true);
    // Commit immediately so an AM/PM click cannot discard a pending selection.
    if (mode === 'hour') onHourSelect(index || 12);
    else onMinuteSelect((index * 5) as FiveMinute);
    // Let the hand and lift settle before the next layer cross-fades in.
    settle.current = setTimeout(() => {
      settle.current = null;
      advance.current();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140);
  }

  return <div ref={face} className={`rhythm-clock radial-clock${complete ? ' complete' : ''}`} role="group" tabIndex={-1}
    aria-label={complete ? 'Available scheduling window' : `${mode === 'hour' ? 'Hour' : 'Minute'} selection clock`}
    data-mode={mode} data-complete={complete}
    onPointerEnter={event => { bounds.current = event.currentTarget.getBoundingClientRect(); }}
    onPointerDown={event => {
      if (complete || settle.current !== null || event.button !== 0 || pointer.current !== null) return;
      event.preventDefault();
      bounds.current = event.currentTarget.getBoundingClientRect();
      pointer.current = event.pointerId;
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      schedule(readPointer(event));
    }}
    onPointerMove={event => {
      if (!complete && settle.current === null && (pointer.current === event.pointerId || (pointer.current === null && event.pointerType === 'mouse'))) schedule(readPointer(event));
    }}
    onPointerUp={event => {
      if (pointer.current !== event.pointerId) return;
      const next = readPointer(event) ?? preview.current;
      pointer.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (next) commit(next.index);
    }}
    onPointerLeave={() => { if (pointer.current === null && settle.current === null) cancel(); }}
    onPointerCancel={cancel}
    onLostPointerCapture={() => { if (pointer.current !== null) cancel(); }}
    onKeyDown={event => { if (event.key === 'Escape' && preview.current) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
    <img className="clock-glow" src="/rhythm/planner/CenterPinGlow.svg" alt="" />
    <img className="radial-outer-ring" src="/rhythm/planner/RadialOuterRing.svg" alt="" />
    <img className="radial-minute-ring" src="/rhythm/planner/RadialMinuteRing.svg" alt="" />
    {(['hour', 'minute'] as const).map(ring => {
      const active = mode === ring && !complete;
      const ringIndex = ring === 'hour' ? value.hour % 12 : value.minute / 5;
      return <div key={ring} data-ring={ring} className={`radial-layer ${ring}${active ? ' active' : ''}`} aria-hidden={!active} inert={!active}>
        {Array.from({ length: ring === 'hour' ? 12 : 24 }, (_, i) => {
          const angle = i * (ring === 'hour' ? 30 : 15);
          return <span aria-hidden="true" key={i} data-angle={angle} className={`radial-tick${ring === 'minute' && i % 2 ? ' minor' : ''}`} style={{ ...position(angle, ring === 'hour' ? 40.4 : 30.5), '--spoke-angle': `${angle}deg` } as CSSProperties} />;
        })}
        <div aria-hidden="true" className="radial-hand"><span /></div>
        {Array.from({ length: 12 }, (_, index) => <button type="button" key={index} data-angle={index * 30}
          className={`radial-label${ringIndex === index ? ' active' : ''}`}
          style={{ ...position(index * 30, ring === 'hour' ? 36.4 : 25.5), '--lift-x': `${Math.sin(index * Math.PI / 6) * 5}px`, '--lift-y': `${-Math.cos(index * Math.PI / 6) * 5}px` } as CSSProperties}
          aria-label={ring === 'hour' ? `Select hour ${index || 12}` : `Select minutes ${String(index * 5).padStart(2, '0')}`}
          aria-pressed={ringIndex === index}
          onClick={event => { if (event.detail === 0 && active) commit(index); }}>
          {ring === 'hour' ? index || 12 : String(index * 5).padStart(2, '0')}
        </button>)}
      </div>;
    })}
    <img className="clock-pivot" src="/rhythm/planner/CenterPinCore.svg" alt="" />
    <output hidden className="radial-preview" aria-label="Selection preview" />
    <div className={`radial-range${complete && range ? ' visible' : ''}`} aria-hidden={!complete}>
      {range && <>
        <div className="range-arc" style={{ '--range-start': `${range.startAngle}deg`, '--range-sweep': `${range.sweepAngle}deg` } as CSSProperties} />
        {[range.startAngle, range.startAngle + range.sweepAngle].map((angle, index) => <div key={index} className={`range-boundary ${index ? 'end' : 'start'}`} style={{ transform: `rotate(${angle}deg)` }}><span /></div>)}
        {[0, 6, 12, 18].map(hour => <span key={hour} className="range-hour" style={position(hour * 15, 46)}>{String(hour).padStart(2, '0')}</span>)}
        <div className="range-center"><strong>{range.durationLabel}</strong><span>AVAILABLE</span><p>{range.startLabel}<br />— {range.endLabel}</p><small>24-hour day</small></div>
      </>}
    </div>
  </div>;
}
