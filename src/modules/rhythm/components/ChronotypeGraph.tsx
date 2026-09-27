import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Chronotype } from '../types';

export function ChronotypeGraph({ type, showAnimal = false }: { type: Chronotype; showAnimal?: boolean }) {
  const id = useId();
const chronotypeCurveSvgs: Partial<Record<Chronotype, ReactNode>> = {
  Lion: (
    <svg
      className="curve-svg"
      viewBox="0 0 570 338"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Lion energy curve"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(20.5 96.9)">
        <path
          d="M173.5 0.102348C82.5 5.60235 0 203.602 0 203.602L502.5 212.602C502.5 212.602 264.5 -5.39765 173.5 0.102348Z"
          fill={`url(#${id}-lionCurveGradient)`}
        />
        <path
          d="M1 204.582C1 204.582 83.5 6.58184 174.5 1.08184C265.5 -4.41816 503.5 213.582 503.5 213.582"
          stroke="#000054"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
      </g>
      <defs>
        <linearGradient
          id={`${id}-lionCurveGradient`}
          x1="271.75"
          y1="96.9"
          x2="271.75"
          y2="309.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#000054" stopOpacity="0.58" />
          <stop offset="1" stopColor="#0000BA" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Bear: (
    <svg
      className="curve-svg"
      viewBox="0 0 570 338"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bear energy curve"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(20.5 96.5)">
        <path
          d="M360 112.001C322.537 81.5045 303 0.500114 245 0.5C187 0.499886 171.377 72.802 131 108.501C63.902 167.826 0.5 204 0.5 204L503 213C503 213 437.26 174.893 360 112.001Z"
          fill={`url(#${id}-bearCurveGradient)`}
        />
        <path
          d="M0.5 204C0.5 204 63.902 167.826 131 108.501C171.377 72.802 187 0.499886 245 0.5C303 0.500114 322.537 81.5045 360 112.001C437.26 174.893 503 213 503 213"
          stroke="#000054"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
      </g>
      <defs>
        <linearGradient
          id={`${id}-bearCurveGradient`}
          x1="272.25"
          y1="98.0956"
          x2="272.25"
          y2="309.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#000054" stopOpacity="0.58" />
          <stop offset="1" stopColor="#0000BA" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Wolf: (
    <svg
      className="curve-svg"
      viewBox="0 0 570 338"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Wolf energy curve"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(20.5 95.3)">
        <path
          d="M1 204.585C1 204.585 215.5 6.58477 306.5 1.08477C397.5 -4.41523 503.5 213.585 503.5 213.585"
          stroke="#000054"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
        <path
          d="M306.5 0.58524C215.5 6.08524 0 205.187 0 205.187L502.5 214.187C502.5 214.187 397.5 -4.91476 306.5 0.58524Z"
          fill={`url(#${id}-wolfCurveGradient)`}
        />
      </g>
      <defs>
        <linearGradient
          id={`${id}-wolfCurveGradient`}
          x1="271.75"
          y1="96.8852"
          x2="271.75"
          y2="310.488"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#000054" stopOpacity="0.58" />
          <stop offset="1" stopColor="#0000BA" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Dolphin: (
    <svg
      className="curve-svg"
      viewBox="0 0 570 338"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Dolphin energy curve"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(20.5 97)">
        <path
          d="M0.5 203.499C0.5 203.499 29.5 101 68 101C101.5 101 113 158.5 140.5 158.5C177 158.5 165.5 40.9988 204 40.9988C242.5 40.9988 247.5 158.5 279 158.5C315 158.5 296 0.5 350 0.5C374.977 0.5 412.948 123.5 425.5 143C446 174.847 503 212.499 503 212.499"
          stroke="#000054"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
        <path
          d="M204 40.9988C165.5 40.9988 177 158.5 140.5 158.5C113 158.5 101.5 101 68 101C29.5 101 0.5 203.499 0.5 203.499L503 212.499C503 212.499 446 174.847 425.5 143C412.948 123.5 374.977 0.5 350 0.5C296 0.5 315 158.5 279 158.5C247.5 158.5 242.5 40.9988 204 40.9988Z"
          fill={`url(#${id}-dolphinCurveGradient)`}
        />
      </g>
      <defs>
        <linearGradient
          id={`${id}-dolphinCurveGradient`}
          x1="272.25"
          y1="98.593"
          x2="272.25"
          y2="309.499"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#000054" stopOpacity="0.58" />
          <stop offset="1" stopColor="#0000BA" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  ),
};


  const customCurve = chronotypeCurveSvgs[type];

  if (!customCurve) {
    return (
      <div className="energy-graph">
        <p>Energy curve coming soon.</p>
      </div>
    );
  }

  return (
    <div className="energy-graph custom-graph" role="img" aria-label={`${type} energy pattern over the day`}>
      <div className="graph-stage">
        <div className="graph-axis-labels" aria-hidden="true"><span className="graph-energy-label">Energy level</span><span className="graph-hour-label">Hour</span><div className="graph-hour-ticks">{[3,6,9,12,15,18,21,24].map(hour => <span key={hour}>{hour}</span>)}</div></div>
        <div className="curve-layer">
          {Object.entries(chronotypeCurveSvgs).map(([key, curve]) => <div className={`curve-content${key === type ? ' visible' : ''}`} key={key} aria-hidden={key !== type} style={{ opacity: key === type ? 1 : 0, position: 'absolute', inset: 0, transition: 'opacity 320ms ease', animation: 'none', transform: 'none' }}>
            {curve}
            {showAnimal && <span className="tb-graph-animal tb-animal-icon" aria-hidden="true" style={{ maskImage: `url(/rhythm/flow/${key.toLowerCase()}.svg)` }} />}
          </div>)}
        </div>
      </div>
    </div>
  );
}
