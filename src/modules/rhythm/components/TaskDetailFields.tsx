import { useEffect, useRef, useState } from "react";
import { TaskAsset } from "./space-icons";
interface Props {
  open: boolean;
  hasName: boolean;
  energy: number;
  hours: number;
  minutes: number;
  isBreak: boolean;
  fixedStart: string;
  fixedEnd: string;
  fixedTimeError: string;
  setEnergy(value: number): void;
  setHours(value: number): void;
  setMinutes(value: number): void;
  setIsBreak(value: boolean): void;
  handleFixedTimeChange(field: "start" | "end", value: string): void;
}
const EnergyIcon = ({ active }: { active?: boolean }) => (
  <TaskAsset name="row-imgLightning" />
);
const TimeIcon = ({ active }: { active?: boolean }) => (
  <TaskAsset name="row-imgStopwatch" />
);
// Shared by the existing task builder and the task settings modal.
export function TaskDetailFields({
  open,
  hasName,
  energy,
  hours,
  minutes,
  isBreak,
  fixedStart,
  fixedEnd,
  fixedTimeError,
  setEnergy,
  setHours,
  setMinutes,
  setIsBreak,
  handleFixedTimeChange,
}: Props) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const [sliderWidth, setSliderWidth] = useState(0);
  useEffect(() => {
    const element = sliderRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setSliderWidth(element.clientWidth),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const sliderLeft = ((energy - 1) / 4) * Math.max(sliderWidth - 32, 0) + 16;
  return (
    <>
      <div
        className={
          "task-step-details" + (open && hasName ? " open" : " collapsed")
        }
      >
        <p className="eyebrow">Task Elements</p>
        <div className="detail-columns">
          <div className="detail-col energy-field">
            <label>
              <div className="detail-heading">
                <span>Estimated Energy</span>
                <EnergyIcon active={hasName} />
              </div>
              <div className="energy-slider">
                <input
                  ref={sliderRef}
                  type="range"
                  aria-label="Estimated Energy"
                  min="1"
                  max="5"
                  step="1"
                  value={energy}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                  disabled={!hasName}
                />
                <span
                  key={energy}
                  className="slider-value"
                  style={{ left: `${sliderLeft}px` }}
                >
                  {energy}
                </span>
              </div>
            </label>
          </div>
          <div className="detail-col time-field">
            <label>
              <div className="detail-heading">
                <span>Estimated Time</span>
                <TimeIcon active={hasName} />
              </div>
              <div className="time-inputs">
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={hours}
                  onChange={(e) =>
                    setHours(Math.max(0, Number(e.target.value)))
                  }
                  aria-label="Hours"
                  disabled={!hasName}
                />
                <span>:</span>
                <input
                  type="number"
                  min="0"
                  max="55"
                  step="5"
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(
                      Math.min(55, Math.max(0, Number(e.target.value))),
                    )
                  }
                  aria-label="Minutes"
                  disabled={!hasName}
                />
              </div>
              <small>hh:mm</small>
            </label>
          </div>
        </div>
      </div>
      <div className="timing-block">
        <div
          className={`fixed-time-section${isBreak ? " break-selected" : ""}`}
        >
          <div className="fixed-time-header">
            <div>
              <p className="eyebrow">Fixed Time Slot</p>
              <small>Lock this task to a specific window</small>
            </div>
          </div>
          <div className="fixed-time-fields">
            <label>
              Start
              <input
                type="time"
                value={fixedStart}
                onChange={(e) => handleFixedTimeChange("start", e.target.value)}
                disabled={!hasName}
              />
            </label>
            <label>
              End
              <input
                type="time"
                value={fixedEnd}
                onChange={(e) => handleFixedTimeChange("end", e.target.value)}
                disabled={!hasName}
              />
            </label>
          </div>
          {fixedTimeError && (
            <p className="fixed-time-error">{fixedTimeError}</p>
          )}
        </div>
        <label
          className={
            `break-checkbox` +
            (isBreak ? " checked" : "") +
            (!hasName ? " disabled" : "")
          }
        >
          <input
            type="checkbox"
            checked={isBreak}
            onChange={(e) => setIsBreak(e.target.checked)}
            disabled={!hasName}
          />
          <span>Is this a break?</span>
        </label>
      </div>
    </>
  );
}
