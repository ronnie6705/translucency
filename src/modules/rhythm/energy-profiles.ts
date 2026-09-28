import type { Chronotype, Task } from './types';
import { getMinutesOfDayInTimeZone } from './utils/timezone';

export type EnergyLevel = Task['energyRequired'];
export type EnergyBand = { startMinutes: number; endMinutes: number; level: EnergyLevel };

// Numerical profiles shared by scheduling and placement explanations.
// ChronotypeGraph intentionally retains the existing illustrative SVG artwork.
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

export function getEnergyProfile(chronotype: Chronotype): readonly EnergyBand[] {
  return ENERGY_CURVES[chronotype] ?? DEFAULT_CURVE;
}

export function energyAtMinute(chronotype: Chronotype, minute: number): EnergyLevel {
  const local = ((minute % 1440) + 1440) % 1440;
  return getEnergyProfile(chronotype).find(b => local >= b.startMinutes && local < b.endMinutes)?.level ?? 3;
}

export function getEnergyLevelAt(chronotype: Chronotype, date: Date, timezone: string): EnergyLevel {
  return energyAtMinute(chronotype, getMinutesOfDayInTimeZone(date, timezone));
}