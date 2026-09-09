import { useEffect, useRef, useState } from 'react';
import { timerBlockHeight, timerPosition, type LiveTimer as Timer } from '../live-timer';

export function TimerIcon({ name }: { name: string }) {
  return <img className="timer-icon" src={`/rhythm/timer/${name}.svg`} width={24} height={24} alt="" aria-hidden="true" />;
}

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}

function timeLabel(value: number | string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function durationLabel(ms: number) {
  const mins = Math.round(ms / 60000);
  return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins} mins`;
}

function TimerCard({ timer, now, onClose }: { timer: Timer; now: number; onClose?: () => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [listTop, setListTop] = useState(0);
  const [measurements, setMeasurements] = useState<{ top: number; height: number }[]>([]);
  useEffect(() => {
    const elements = Array.from(list.current?.querySelectorAll<HTMLElement>('.live-timer-block') ?? []);
    const measure = () => {
      setListTop(list.current?.offsetTop ?? 0);
      setMeasurements(elements.map(element => ({ top: element.offsetTop, height: element.offsetHeight })));
    };
    const observer = new ResizeObserver(measure);
    elements.forEach(element => observer.observe(element));
    if (list.current?.parentElement) observer.observe(list.current.parentElement);
    measure();
    return () => observer.disconnect();
  }, [timer.blocks]);
  const { activeIndex, nextIndex, phase, progress } = timerPosition(timer.blocks, now);
  const heights = timer.blocks.map((block, index) => measurements[index]?.height ?? timerBlockHeight(block));
  const offset = (index: number) => measurements[index]?.top ?? heights.slice(0, index).reduce((sum, height) => sum + height + 12, 0);
  let line = activeIndex >= 0 ? offset(activeIndex) + heights[activeIndex] * progress : 0;
  if (phase === 'gap') {
    const previousEnd = Date.parse(timer.blocks[nextIndex - 1].end);
    const gap = Date.parse(timer.blocks[nextIndex].start) - previousEnd;
    line = offset(nextIndex) - 12 + 12 * (now - previousEnd) / gap;
  }
  const date = new Intl.DateTimeFormat('en-US', { timeZone: timer.timezone, month: 'short', day: 'numeric' }).format(new Date(timer.blocks[0].start));
  const status = phase === 'complete' ? 'Timeblock complete' : phase === 'scheduled' ? `Starts ${timeLabel(timer.blocks[0].start, timer.timezone)}` : phase === 'gap' ? `Next: ${timer.blocks[nextIndex].taskName}` : `Now: ${timer.blocks[activeIndex].taskName}`;
  return <div className={`live-timer-card phase-${phase}`}>
    <header className="live-timer-header">
      <div><p className="live-timer-kicker">Timeblock</p><div className="live-timer-title"><h2>{timer.name}</h2><span>{date}</span></div></div>
      {onClose && <button type="button" className="live-timer-close" aria-label="Close live timer" onClick={onClose}><TimerIcon name="close" /></button>}
    </header>
    <p className={phase === 'running' ? 'sr-only' : 'live-timer-status'} role="status">{status}</p>
    <div className="live-timer-blocks" ref={list}>
      {timer.blocks.map((block, index) => {
        const state = now >= Date.parse(block.end) ? 'past' : index === activeIndex ? 'active' : 'upcoming';
        return <article key={block.id} className={`live-timer-block ${state}${block.isBreak ? ' is-break' : ''}`} style={{ minHeight: timerBlockHeight(block) }} aria-current={state === 'active' ? 'step' : undefined} aria-label={`${block.taskName}, ${state === 'past' ? 'elapsed' : state}, ${timeLabel(block.start, timer.timezone)}`}>
          <div className="live-timer-task-icon"><TimerIcon name={block.isBreak ? 'break' : 'task'} /></div>
          <div className="live-timer-copy"><time dateTime={block.start}>{timeLabel(block.start, timer.timezone)}</time><h3>{block.taskName}</h3></div>
          <div className="live-timer-badges"><span><TimerIcon name="clock" />{durationLabel(Date.parse(block.end) - Date.parse(block.start))}</span>{!block.isBreak && <span><TimerIcon name="energy" />{block.energyRequired}</span>}</div>
        </article>;
      })}
      {(phase === 'running' || phase === 'gap') && <div className="live-timer-now" style={{ top: line }} aria-hidden="true"><span>{timeLabel(now, timer.timezone)}</span></div>}
    </div>
    {(phase === 'running' || phase === 'gap') && <div className="live-timer-effects" aria-hidden="true"><div className="live-timer-now" style={{ top: listTop + line }}><div className="live-timer-glow-window"><img className="live-timer-glow" src="/rhythm/timer/glow.svg" alt="" /></div></div></div>}
  </div>;
}

export function LiveTimerPreview({ timer, onOpen }: { timer: Timer; onOpen: () => void }) {
  const now = useClock();
  return <section className="live-timer-section" aria-labelledby="live-timer-section-title">
    <h2 id="live-timer-section-title" className="section-kicker">Live Timer</h2>
    <button type="button" className="live-timer-preview" aria-label={`Open live timer: ${timer.name}`} onClick={onOpen}>
      <div className="live-timer-preview-content" aria-hidden="true"><TimerCard timer={timer} now={now} /></div>
      <span className="live-timer-open-hint"><TimerIcon name="timer" />Open fullscreen</span>
    </button>
  </section>;
}

export function LiveTimerModal({ timer, onClose }: { timer: Timer; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const now = useClock();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      const target = previous?.isConnected ? previous : document.querySelector<HTMLElement>('.live-timer-preview, #main');
      target?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="live-timer-modal" aria-label="Live timer" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="live-timer-stage"><TimerCard timer={timer} now={now} onClose={onClose} /></div>
  </dialog>;
}
