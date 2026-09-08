// src/components/DaySettingsForm.tsx
import React from 'react';
import type { Chronotype, DayConfig } from '../types';

interface Props {
  value: DayConfig;
  onChange: (value: DayConfig) => void;
}

const chronotypes: Chronotype[] = ['Lion', 'Bear', 'Wolf', 'Dolphin'];

export const DaySettingsForm: React.FC<Props> = ({ value, onChange }) => {
  const handleChange = (field: keyof DayConfig, newVal: string) => {
    onChange({ ...value, [field]: newVal });
  };

  return (
    <section className="card">
      <h2>Day Settings</h2>
      <div className="form-row">
        <label>
          Date
          <input
            type="date"
            value={value.date}
            onChange={e => handleChange('date', e.target.value)}
          />
        </label>
        <label>
          Start time
          <input
            type="time"
            value={value.startTime}
            onChange={e => handleChange('startTime', e.target.value)}
          />
        </label>
        <label>
          End time
          <input
            type="time"
            value={value.endTime}
            onChange={e => handleChange('endTime', e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Chronotype
          <select
            value={value.chronotype}
            onChange={e =>
              handleChange('chronotype', e.target.value as Chronotype)
            }
          >
            {chronotypes.map(ct => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
};