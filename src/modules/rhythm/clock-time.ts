export type FiveMinute = 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55;
export type ClockTime = { hour: number; minute: FiveMinute; period: 'AM' | 'PM' };
export type ClockSelectionMode = 'hour' | 'minute';
export type ActiveTimeField = 'start' | 'end';

export function clockTimeToMinutes(time: ClockTime): number {
  return (time.hour % 12 + (time.period === 'PM' ? 12 : 0)) * 60 + time.minute;
}

export function clockTimeToString(time: ClockTime): string {
  const minutes = clockTimeToMinutes(time);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function parseClockTime(value: string): ClockTime | undefined {
  if (!/^([01]\d|2[0-3]):([0-5][05])$/.test(value)) return undefined;
  const [hour, minute] = value.split(':').map(Number);
  return { hour: hour % 12 || 12, minute: minute as FiveMinute, period: hour < 12 ? 'AM' : 'PM' };
}

// No previous planner presets existed; these are the ranges specified by Figma.
export const TIME_RANGE_PRESETS = [
  { name: 'Morning', start: '06:00', end: '12:00', icon: 'Sun' },
  { name: 'Workday', start: '09:00', end: '17:00', icon: 'Laptop' },
  { name: 'Afternoon', start: '12:00', end: '18:00', icon: 'Sun' },
] as const;

export function snapClockAngle(x: number, y: number, divisions: number): number {
  const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(angle / (Math.PI * 2) * divisions) % divisions;
}

/** Circular distance keeps proximity continuous across the top of the dial. */
export function radialInfluence(spokeAngle: number, pointerAngle: number): number {
  const distance = Math.abs(((spokeAngle - pointerAngle + 540) % 360) - 180);
  // A Gaussian gives adjacent 30-degree labels ~64% and the next ones ~17%.
  return Math.exp(-Math.pow(distance / 45, 2));
}

export function rangeArc(start: ClockTime, end: ClockTime) {
  const startMinutes = clockTimeToMinutes(start);
  const duration = clockTimeToMinutes(end) - startMinutes;
  if (duration <= 0) return undefined;
  return { startAngle: startMinutes / 4, sweepAngle: duration / 4, duration };
}
