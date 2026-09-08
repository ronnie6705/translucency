export const DEVICE_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const DEFAULT_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

export const TIME_ZONE_OPTIONS = [
  { value: DEVICE_TIME_ZONE, label: `Device Default (${DEVICE_TIME_ZONE})` },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Australia (AEST)' },
];

function getParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...DEFAULT_FORMAT_OPTIONS,
    timeZone,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return map;
}

export function getTimeZoneOffsetMinutes(
  timeZone: string,
  reference: Date
): number {
  const parts = getParts(reference, timeZone);
  const zonedUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (zonedUTC - reference.getTime()) / 60000;
}

export function createDateInTimeZone(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const reference = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMinutes(timeZone, reference);
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const offsetHours = String(Math.floor(abs / 60)).padStart(2, '0');
  const offsetMinutes = String(abs % 60).padStart(2, '0');
  const offsetSuffix = `${sign}${offsetHours}:${offsetMinutes}`;
  return new Date(`${dateStr}T${timeStr}:00${offsetSuffix}`);
}

export function formatISOToTimeZone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const parts = getParts(date, timeZone);
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

export function getHourInTimeZone(date: Date, timeZone: string): number {
  const parts = getParts(date, timeZone);
  return Number(parts.hour || '0');
}

export function getMinutesOfDayInTimeZone(
  date: Date,
  timeZone: string
): number {
  const parts = getParts(date, timeZone);
  const hours = Number(parts.hour || '0');
  const minutes = Number(parts.minute || '0');
  return hours * 60 + minutes;
}
