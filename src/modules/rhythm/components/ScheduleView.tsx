// src/components/ScheduleView.tsx
import React from 'react';
import type { ScheduleBlock } from '../types';

interface Props {
  blocks: ScheduleBlock[];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ScheduleView: React.FC<Props> = ({ blocks }) => {
  if (!blocks.length) {
    return (
      <section className="card">
        <h2>Schedule</h2>
        <p>No schedule generated yet. Click “Generate Schedule”.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Schedule</h2>
      <ol className="schedule-list">
        {blocks.map(b => (
          <li key={b.id} className={b.isBreak ? 'schedule-break' : ''}>
            <div className="schedule-time">
              {formatTime(b.start)} – {formatTime(b.end)}
            </div>
            <div className="schedule-task">
              <strong>{b.taskName}</strong>
              {!b.isBreak && (
                <span> · Energy {b.energyRequired}/5</span>
              )}
              {b.isBreak && <span> · Break</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};