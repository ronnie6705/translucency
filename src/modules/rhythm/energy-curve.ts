import type { Chronotype } from './types';
import { getMinutesOfDayInTimeZone } from './utils/timezone';
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;
export interface EnergyBand { readonly startMinutes: number; readonly endMinutes: number; readonly level: EnergyLevel }
export interface EnergyCurve { readonly version: 1; readonly bands: readonly EnergyBand[] }
export class EnergyCurveValidationError extends Error { constructor(message: string) { super(`Invalid energy curve: ${message}`); this.name = 'EnergyCurveValidationError'; } }
const toMinutes = (hour: number, minute = 0) => hour * 60 + minute;

const LION_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(3), level: 1 }, // deep sleep
  { startMinutes: toMinutes(3), endMinutes: toMinutes(5), level: 1 }, // pre-dawn low
  { startMinutes: toMinutes(5), endMinutes: toMinutes(6, 30), level: 2 }, // wake-up ramp
  { startMinutes: toMinutes(6, 30), endMinutes: toMinutes(8), level: 3 }, // planning & routines
  { startMinutes: toMinutes(8), endMinutes: toMinutes(10, 30), level: 5 }, // peak focus / interviews
  { startMinutes: toMinutes(10, 30), endMinutes: toMinutes(12), level: 4 }, // problem-solving
  { startMinutes: toMinutes(12), endMinutes: toMinutes(14), level: 3 }, // late-morning taper
  { startMinutes: toMinutes(14), endMinutes: toMinutes(15), level: 2 }, // nap window
  { startMinutes: toMinutes(15), endMinutes: toMinutes(16, 30), level: 3 }, // strength work rebound
  { startMinutes: toMinutes(16, 30), endMinutes: toMinutes(18, 30), level: 2 }, // afternoon decline
  { startMinutes: toMinutes(18, 30), endMinutes: toMinutes(21), level: 2 }, // run / dinner glide
  { startMinutes: toMinutes(21), endMinutes: toMinutes(24), level: 1 }, // wind-down & sleep
];

const BEAR_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(5), level: 1 },
  { startMinutes: toMinutes(5), endMinutes: toMinutes(7), level: 2 },
  { startMinutes: toMinutes(7), endMinutes: toMinutes(9), level: 3 },
  { startMinutes: toMinutes(9), endMinutes: toMinutes(12), level: 5 },
  { startMinutes: toMinutes(12), endMinutes: toMinutes(13), level: 3 },
  { startMinutes: toMinutes(13), endMinutes: toMinutes(15), level: 2 },
  { startMinutes: toMinutes(15), endMinutes: toMinutes(18), level: 4 },
  { startMinutes: toMinutes(18), endMinutes: toMinutes(20), level: 3 },
  { startMinutes: toMinutes(20), endMinutes: toMinutes(22), level: 2 },
  { startMinutes: toMinutes(22), endMinutes: toMinutes(24), level: 1 },
];

const WOLF_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(3), level: 3 },
  { startMinutes: toMinutes(3), endMinutes: toMinutes(6), level: 2 },
  { startMinutes: toMinutes(6), endMinutes: toMinutes(10), level: 1 },
  { startMinutes: toMinutes(10), endMinutes: toMinutes(13), level: 2 },
  { startMinutes: toMinutes(13), endMinutes: toMinutes(16), level: 3 },
  { startMinutes: toMinutes(16), endMinutes: toMinutes(19), level: 5 },
  { startMinutes: toMinutes(19), endMinutes: toMinutes(21), level: 4 },
  { startMinutes: toMinutes(21), endMinutes: toMinutes(23), level: 3 },
  { startMinutes: toMinutes(23), endMinutes: toMinutes(24), level: 2 },
];

const DOLPHIN_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(6), level: 1 },
  { startMinutes: toMinutes(6), endMinutes: toMinutes(8), level: 2 },
  { startMinutes: toMinutes(8), endMinutes: toMinutes(10), level: 3 },
  { startMinutes: toMinutes(10), endMinutes: toMinutes(13), level: 5 },
  { startMinutes: toMinutes(13), endMinutes: toMinutes(15), level: 3 },
  { startMinutes: toMinutes(15), endMinutes: toMinutes(17), level: 2 },
  { startMinutes: toMinutes(17), endMinutes: toMinutes(19), level: 4 },
  { startMinutes: toMinutes(19), endMinutes: toMinutes(21), level: 3 },
  { startMinutes: toMinutes(21), endMinutes: toMinutes(24), level: 1 },
];

const DEFAULT_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(6), level: 1 },
  { startMinutes: toMinutes(6), endMinutes: toMinutes(9), level: 3 },
  { startMinutes: toMinutes(9), endMinutes: toMinutes(12), level: 4 },
  { startMinutes: toMinutes(12), endMinutes: toMinutes(15), level: 3 },
  { startMinutes: toMinutes(15), endMinutes: toMinutes(18), level: 2 },
  { startMinutes: toMinutes(18), endMinutes: toMinutes(21), level: 2 },
  { startMinutes: toMinutes(21), endMinutes: toMinutes(24), level: 1 },
];

const ENERGY_CURVES: Record<Chronotype, EnergyBand[]> = {
  Lion: LION_CURVE,
  Bear: BEAR_CURVE,
  Wolf: WOLF_CURVE,
  Dolphin: DOLPHIN_CURVE,
};


export function validateEnergyCurve(value: unknown): EnergyCurve {
  const fail = (message: string): never => { throw new EnergyCurveValidationError(message); };
  if (!value || typeof value !== 'object') return fail('expected an object.');
  const curve = value as EnergyCurve;
  if (curve.version !== 1 || !Array.isArray(curve.bands) || !curve.bands.length) return fail('expected version 1 and nonempty bands.');
  const bands: EnergyBand[] = [];
  for (const band of curve.bands) {
    if (!band || !Number.isInteger(band.startMinutes) || !Number.isInteger(band.endMinutes) || band.startMinutes < 0 || band.startMinutes >= 1440 || band.endMinutes < 0 || band.endMinutes > 1440 || band.startMinutes === band.endMinutes || ![1,2,3,4,5].includes(band.level)) return fail('invalid minutes or level.');
    if (band.startMinutes > band.endMinutes) {
      bands.push({ ...band, endMinutes: 1440 });
      if (band.endMinutes > 0) bands.push({ ...band, startMinutes: 0 });
    } else bands.push({ ...band });
  }
  if (!curve.bands.some(b=>b.startMinutes > b.endMinutes) && curve.bands.some((b,index)=>index > 0 && b.startMinutes < curve.bands[index-1].startMinutes)) return fail('bands must be sorted.');
  // Normalize ordering of split midnight-spanning intervals.
  bands.sort((a,b) => a.startMinutes - b.startMinutes);
  let cursor = 0;
  for (const band of bands) {
    if (band.startMinutes !== cursor) return fail('bands must cover the full day without gaps or overlaps.');
    cursor = band.endMinutes;
  }
  if (cursor !== 1440) return fail('bands must cover [0, 1440).');
  return Object.freeze({ version: 1, bands: Object.freeze(bands.map(band => Object.freeze(band))) });
}
const presets = Object.fromEntries(Object.entries(ENERGY_CURVES).map(([key,bands]) => [key,validateEnergyCurve({version:1,bands})])) as Record<Chronotype,EnergyCurve>;
const fallback = validateEnergyCurve({version:1,bands:DEFAULT_CURVE});
export function getChronotypeCurve(chronotype: Chronotype): EnergyCurve { return presets[chronotype] ?? fallback; }
export function energyAtMinute(curve: EnergyCurve, minute: number): EnergyLevel {
  if (!Number.isFinite(minute) || minute < 0 || minute >= 1440) throw new EnergyCurveValidationError('minute must be in [0, 1440).');
  const band = curve.bands.find(b => minute >= b.startMinutes && minute < b.endMinutes);
  if (!band) throw new EnergyCurveValidationError('no band covers this minute.');
  return band.level;
}
export function energyAtDate(curve: EnergyCurve, date: Date, timezone: string): EnergyLevel {
  return energyAtMinute(curve, getMinutesOfDayInTimeZone(date, timezone) % 1440);
}
