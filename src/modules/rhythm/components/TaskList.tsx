// src/components/TaskList.tsx
import React from 'react';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  onRemove: (id: string) => void;
}

export const TaskList: React.FC<Props> = ({ tasks, onRemove }) => {
  if (!tasks.length) {
    return (
      <section className="card">
        <h2>Tasks</h2>
        <p>No tasks yet. Add some above.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Tasks</h2>
      <ul className="task-list">
        {tasks.map(t => (
          <li key={t.id} className="task-list-item">
            <div>
              <strong>{t.name}</strong> · {t.durationMinutes} mins · Energy{' '}
              {t.energyRequired}/5
              {t.isBreak && <span> · Break</span>}
              {t.fixedStart && <span> · Fixed at {t.fixedStart}</span>}
            </div>
            <button onClick={() => onRemove(t.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
};
