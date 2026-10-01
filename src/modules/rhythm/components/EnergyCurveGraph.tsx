import { useId } from 'react';
import { validateEnergyCurve, type EnergyCurve } from '../energy-curve';

/** Exact step plot: each horizontal interval is the scheduler's capacity band. */
export function EnergyCurveGraph({ curve, label = 'Energy capacity over the day', animal }: { curve: EnergyCurve; label?: string; animal?: string }) {
  const id = useId();
  const bands = validateEnergyCurve(curve).bands;
  const x = (minute: number) => 20 + minute / 1440 * 524;
  const y = (level: number) => 306 - (level - 1) * 52;
  const path = bands.map((band,index) => `${index ? 'L' : 'M'}${x(band.startMinutes)},${y(band.level)} H${x(band.endMinutes)}`).join(' ');
  return <div className="energy-graph custom-graph" role="img" aria-label={label}>
    <div className="graph-stage">
      <div className="graph-axis-labels" aria-hidden="true"><span className="graph-energy-label">Energy level</span><span className="graph-hour-label">Hour</span><div className="graph-hour-ticks">{[0,3,6,9,12,15,18,21,24].map(hour => <span key={hour}>{hour}</span>)}</div></div>
      <div className="curve-layer"><div className="curve-content visible" style={{position:'absolute',inset:0,opacity:1,transform:'none'}}>
        <svg className="curve-svg" viewBox="0 0 570 338" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d={`${path} L544,310 L20,310 Z`} fill={`url(#${id})`} />
          <path d={path} stroke="#9a9eff" strokeWidth="2" strokeDasharray="4 4" />
          <defs><linearGradient id={id} x1="0" y1="90" x2="0" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#827fff" stopOpacity=".58"/><stop offset="1" stopColor="#827fff" stopOpacity="0"/></linearGradient></defs>
        </svg>
        {animal && <span className="tb-graph-animal tb-animal-icon" aria-hidden="true" style={{maskImage:`url(/rhythm/flow/${animal.toLowerCase()}.svg)`}}/>}
      </div></div>
    </div>
  </div>;
}
