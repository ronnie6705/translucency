// src/ics.ts
import type { ScheduleBlock } from './types';
const utc = (date: string) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

export function serializeICS(blocks: ScheduleBlock[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rhythm//TimeBlocking//EN', 'CALSCALE:GREGORIAN'];
  for (const block of blocks) {
    lines.push('BEGIN:VEVENT', `UID:${escapeText(block.id)}@rhythm`, `DTSTAMP:${utc(now.toISOString())}`,
      `DTSTART:${utc(block.start)}`, `DTEND:${utc(block.end)}`, `SUMMARY:${escapeText(block.taskName)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 line folding is measured in UTF-8 octets, not JS characters.
  return lines.map(line => {
    let folded = '', width = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (width + bytes > 75) { folded += '\r\n '; width = 1; }
      folded += char; width += bytes;
    }
    return folded;
  }).join('\r\n') + '\r\n';
}

export function generateICS(
  blocks: ScheduleBlock[],
  fileName: string = 'Rhythm.ics',
  _timeZone: string = 'UTC'
) {
  if (!blocks.length) return;

  const blob = new Blob([serializeICS(blocks)], {
    type: 'text/calendar;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
