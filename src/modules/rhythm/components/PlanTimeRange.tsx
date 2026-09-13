import { useRef, useState } from 'react';
import { ClockPicker } from './ClockPicker';
import { clockTimeToString, clockTimeToMinutes, rangeArc, parseClockTime, TIME_RANGE_PRESETS, type ClockTime, type ActiveTimeField, type ClockSelectionMode } from '../clock-time';
import { TIME_ZONE_OPTIONS } from '../utils/timezone';

interface Props {
  startTime: string;
  endTime: string;
  timeZone: string;
  validRange: boolean;
  onRangeChange(start: string, end: string): void;
  onTimeZoneChange(zone: string): void;
}
export function PlanTimeRange({ startTime, endTime, timeZone, validRange, onRangeChange, onTimeZoneChange }: Props) {
  const [activeField, setActiveField] = useState<ActiveTimeField>('start');
  const [mode, setMode] = useState<ClockSelectionMode>('hour');
  const [complete, setComplete] = useState(validRange);
  const [rangeEstablished, setRangeEstablished] = useState(validRange);
  const [interaction, setInteraction] = useState(0);
  const fields = useRef<Partial<Record<ActiveTimeField, HTMLButtonElement | null>>>({});
  const [customSelected, setCustomSelected] = useState(false);
  const start = parseClockTime(startTime), end = parseClockTime(endTime);
  const active = (activeField === 'start' ? start : end) ?? parseClockTime(activeField === 'start' ? '09:00' : '17:00')!;
  const showingRange = complete && validRange;
  const arc = start && end ? rangeArc(start, end) : undefined;
  const rangeVisual = arc ? {
    ...arc,
    durationLabel: `${Math.floor(arc.duration / 60)}H${arc.duration % 60 ? ` ${arc.duration % 60}M` : ''}`,
    startLabel: formatTime(startTime), endLabel: formatTime(endTime),
  } : undefined;
  const preset = customSelected ? 'Custom' : TIME_RANGE_PRESETS.find(p => p.start === startTime && p.end === endTime)?.name ?? 'Custom';
  function edit(field: ActiveTimeField) {
    setInteraction(value => value + 1);
    setActiveField(field);
    setMode('hour');
    setComplete(false);
  }
  function change(patch: Partial<ClockTime>) {
    const value = clockTimeToString({ ...active, ...patch });
    setCustomSelected(false);
    onRangeChange(activeField === 'start' ? value : startTime, activeField === 'end' ? value : endTime);
  }
  return <section className="plan-time-section" aria-labelledby="plan-time-title">
    <h4 id="plan-time-title">Time Range</h4>
    <div className="plan-presets" role="group" aria-label="Time range presets">
      {TIME_RANGE_PRESETS.map(p => <button type="button" key={p.name} aria-pressed={preset === p.name} onClick={() => { setCustomSelected(false); setComplete(true); setRangeEstablished(true); setInteraction(value => value + 1); onRangeChange(p.start, p.end); }}>
        <span className="preset-icon"><img src={`/rhythm/planner/${p.icon}.svg`} alt="" /></span><span><strong>{p.name}</strong><small>{formatTime(p.start)} – {formatTime(p.end)}</small></span>
      </button>)}
      <button type="button" aria-pressed={preset === 'Custom'} onClick={() => { setCustomSelected(true); edit('start'); }}><span className="preset-icon"><img src="/rhythm/planner/Moon.svg" alt="" /></span><span><strong>Custom</strong><small>Set your own hours</small></span></button>
    </div>
    <div className="plan-clock-editor">
      <div className="radial-instructions" aria-live="polite" aria-atomic="true">
        {(['start', 'end'] as const).flatMap(field => (['hour', 'minute', 'complete'] as const).map(stage => {
          const visible = activeField === field && (showingRange ? stage === 'complete' : stage === mode);
          const name = field === 'start' ? 'Start' : 'End';
          return <p key={`${field}-${stage}`} className={visible ? 'visible' : ''} aria-hidden={!visible}>
            {stage === 'complete' ? 'Your available window is ready. Select Start or End to edit.' : `Please select the ${stage === 'hour' ? 'hour' : 'minutes'} for your ${name} Time`}
          </p>;
        }))}
      </div>
      <ClockPicker value={active} mode={mode} complete={showingRange} range={rangeVisual} interactionId={`${activeField}-${interaction}`}
        onHourSelect={hour => change({ hour })}
        onMinuteSelect={minute => change({ minute })}
        onAdvance={() => {
          if (mode === 'hour') {
            setMode('minute');
          } else if (activeField === 'start' && !rangeEstablished) {
            setActiveField('end'); setMode('hour'); setComplete(false);
          } else {
            const valid = start && end && clockTimeToMinutes(end) > clockTimeToMinutes(start);
            setComplete(true);
            setRangeEstablished(Boolean(start && end));
            if (valid) fields.current[activeField]?.focus({ preventScroll: true });
          }
        }} />
      <div className="plan-time-controls">
      <div className="plan-digital-range" role="group" aria-label="Selected time range">
        {(['start', 'end'] as const).map((field, i) => <div className="plan-digital-pair" key={field}>
          {i === 1 && <img className="range-connector" src="/rhythm/planner/Frame278.svg" alt="" />}
          <div className={`plan-digital-field${activeField === field && !showingRange ? ' active' : ''}`}><span>{field}</span>
            <button ref={element => { fields.current[field] = element; }} type="button" aria-label={`Edit ${field === 'start' ? 'Start' : 'End'} time`} aria-pressed={activeField === field && !showingRange} aria-describedby={!validRange ? 'plan-range-error' : undefined} data-time={field === 'start' ? startTime : endTime} onClick={() => edit(field)}>
              {(field === 'start' ? start : end) ? <>{(field === 'start' ? start : end)!.hour}:{String((field === 'start' ? start : end)!.minute).padStart(2, '0')} <small>{(field === 'start' ? start : end)!.period}</small></> : <span className="plan-time-placeholder">Select time</span>}
            </button>
          </div>
        </div>)}
      </div>
      <span className="plan-time-divider" aria-hidden="true" />
      <div className="plan-period" role="group" aria-label={`Period for ${activeField} time`}>{(['AM', 'PM'] as const).map(period => <button type="button" key={period} aria-pressed={active.period === period} onClick={() => change({ period })}>{period}</button>)}</div>
      </div>
      {!validRange && <p className="plan-error" id="plan-range-error" role="status">{start && end ? 'End must be later than Start on the same day.' : 'Choose a Start and End time to continue.'}</p>}
    </div>
    <div className="time-zone-selector full"><label><span>Time Zone</span><select aria-label="Time Zone" value={timeZone} onChange={event => onTimeZoneChange(event.target.value)}>{TIME_ZONE_OPTIONS.map(zone => <option key={zone.label} value={zone.value}>{zone.label}</option>)}</select></label></div>
  </section>;
}
function formatTime(value: string) {
  const time = parseClockTime(value)!;
  return `${time.hour}:${String(time.minute).padStart(2, '0')} ${time.period}`;
}
