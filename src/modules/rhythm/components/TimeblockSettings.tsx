import React, { useEffect, useId, useRef, useState } from 'react';
import {
  SettingsCogIcon,
  RenameListIcon,
  EditListIcon,
  TrashIcon,
} from '../assets/timeblock-icons';

export interface TimeblockSettingsProps {
  timeblockName: string;
  onRename: () => void;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

export function TimeblockSettings({
  timeblockName,
  onRename,
  onEdit,
  onDelete,
  className = '',
}: TimeblockSettingsProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const actionsId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
    trigger.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const buttons = Array.from(
        root.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []
      );
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (currentIndex !== -1) {
        event.preventDefault();
        const nextIndex =
          event.key === 'ArrowRight'
            ? (currentIndex + 1) % buttons.length
            : (currentIndex - 1 + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
      }
    }
  };

  return (
    <div
      ref={root}
      className={`timeblock-settings ${open ? 'open' : ''} ${className}`}
      onPointerEnter={event => {
        clearTimeout(closeTimer.current);
        if (event.pointerType === 'mouse') setOpen(true);
      }}
      onPointerMove={event => {
        if (event.pointerType === 'mouse' && !open) setOpen(true);
      }}
      onPointerLeave={() => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => {
          if (!root.current?.matches(':hover') && !root.current?.contains(document.activeElement)) {
            setOpen(false);
          }
        }, 220);
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={handleKeyDown}
    >
      {!open && (
        <button
          ref={trigger}
          type="button"
          className="timeblock-settings-trigger"
          aria-label={`Settings for ${timeblockName}`}
          aria-expanded={open}
          aria-controls={actionsId}
          onClick={() => setOpen(value => !value)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
              event.preventDefault();
              setOpen(true);
              requestAnimationFrame(() =>
                root.current?.querySelector<HTMLButtonElement>('.timeblock-settings-actions button')?.focus()
              );
            }
          }}
        >
          <SettingsCogIcon />
        </button>
      )}

      {open && (
        <div id={actionsId} className="timeblock-settings-actions">
          <button
            type="button"
            className="timeblock-settings-btn rename-btn"
            title="Rename Timeblock"
            aria-label={`Rename ${timeblockName}`}
            onClick={() => handleAction(onRename)}
          >
            <RenameListIcon />
          </button>
          <button
            type="button"
            className="timeblock-settings-btn edit-btn"
            title="Edit Timeblock"
            aria-label={`Edit ${timeblockName}`}
            onClick={() => handleAction(onEdit)}
          >
            <EditListIcon />
          </button>
          <button
            type="button"
            className="timeblock-settings-btn delete-btn"
            title="Delete Timeblock"
            aria-label={`Delete ${timeblockName}`}
            onClick={() => handleAction(onDelete)}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}
