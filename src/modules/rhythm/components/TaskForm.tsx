// src/components/TaskForm.tsx
import React, { useState } from 'react';
import type { Task } from '../types';

interface Props {
  onAdd: (task: Task) => void;
}

export const TaskForm: React.FC<Props> = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [durationInput, setDurationInput] = useState('60');
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>(
    'minutes'
  );
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [isBreak, setIsBreak] = useState(false);
  const [fixedStart, setFixedStart] = useState('');

  const parseDurationMinutes = () => {
    const value = Number(durationInput);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    const minutes = durationUnit === 'hours' ? value * 60 : value;
    return Math.max(1, Math.round(minutes));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsedDuration = parseDurationMinutes();
    if (!parsedDuration) return;

    const task: Task = {
      id: crypto.randomUUID(),
      name: name.trim(),
      durationMinutes: parsedDuration,
      energyRequired: energy,
      priority: 2,
      isBreak,
      fixedStart: fixedStart || undefined,
    };

    onAdd(task);
    setName('');
    setDurationInput('60');
    setDurationUnit('minutes');
    setEnergy(3);
    setIsBreak(false);
    setFixedStart('');
  };

  return (
    <section className="card">
      <h2>Add Task</h2>
      <form onSubmit={handleSubmit} className="task-form">
        <label>
          Task name
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Apply to jobs"
            required
          />
        </label>

        <div className="form-row">
          <label>
            Duration
            <div className="duration-input">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.25"
                value={durationInput}
                onChange={e => setDurationInput(e.target.value)}
                placeholder="e.g. 1"
              />
              <select
                value={durationUnit}
                onChange={e =>
                  setDurationUnit(e.target.value as 'minutes' | 'hours')
                }
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </select>
            </div>
          </label>

          <label>
            Energy required
            <select
              value={energy}
              onChange={e =>
                setEnergy(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
              }
            >
              {[1, 2, 3, 4, 5].map(level => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

        </div>

        <div className="form-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isBreak}
              onChange={e => setIsBreak(e.target.checked)}
            />
            This is a break
          </label>

          <label>
            Fixed start (optional)
            <input
              type="time"
              value={fixedStart}
              onChange={e => setFixedStart(e.target.value)}
            />
          </label>
        </div>

        <button type="submit">Add task</button>
      </form>
    </section>
  );
};
