'use client';

import type { Chronotype } from '../types';
import { chronotypeOptions } from './chronotype-options';
import { ChronotypeGraph } from './ChronotypeGraph';

export interface ChronotypeSelectorProps {
  value: Chronotype;
  onChange(value: Chronotype): void;
  showGraph?: boolean;
  variant?: 'default' | 'schedule';
  disabled?: boolean;
  'aria-label'?: string;
}

/** Controlled picker; the caller owns selection and any flow navigation. */
export function ChronotypeSelector({
  value, onChange, showGraph = true, disabled = false, variant = 'default',
  'aria-label': label = 'Chronotype',
}: ChronotypeSelectorProps) {
  return <>
    <div className="chronotype-options" role="group" aria-label={label}>
      {chronotypeOptions.map(option => <button
        type="button" key={option.id}
        className={`chronotype-card${value === option.id ? ' selected' : ''}`}
        onClick={() => onChange(option.id)} aria-pressed={value === option.id}
        disabled={disabled}
      >
        <span className="icon" aria-hidden="true">{variant === 'schedule' ? <span className="tb-animal-icon" style={{ maskImage: `url(/rhythm/flow/${option.id.toLowerCase()}.svg)` }} /> : option.icon}</span>
        <span>{option.label}</span>
      </button>)}
    </div>
    {showGraph && <ChronotypeGraph type={value} showAnimal={variant === 'schedule'} />}
  </>;
}
