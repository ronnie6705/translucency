import type { BreakPreset } from './recovery-types';
export interface BreakPresetConfig {
  targetWorkMinutes: number; maxContinuousWorkMinutes: number; recoveryThreshold: number;
  shortBreakMinutes: number; longBreakMinutes: number; longBreakThreshold: number;
  energySensitivity: number; splittingPreference: 'allow' | 'avoid';
}
export const BREAK_PRESETS: Record<Exclude<BreakPreset,'none'>, BreakPresetConfig> = {
  balanced: {targetWorkMinutes:65,maxContinuousWorkMinutes:90,recoveryThreshold:70,shortBreakMinutes:5,longBreakMinutes:10,longBreakThreshold:110,energySensitivity:1,splittingPreference:'allow'},
  'deep-focus': {targetWorkMinutes:100,maxContinuousWorkMinutes:120,recoveryThreshold:110,shortBreakMinutes:10,longBreakMinutes:15,longBreakThreshold:155,energySensitivity:0.8,splittingPreference:'avoid'},
  frequent: {targetWorkMinutes:40,maxContinuousWorkMinutes:60,recoveryThreshold:45,shortBreakMinutes:5,longBreakMinutes:5,longBreakThreshold:90,energySensitivity:1.2,splittingPreference:'allow'},
};
export const RECOVERY_ENERGY_WEIGHTS = {1:0.6,2:0.8,3:1,4:1.2,5:1.4} as const;
export const MIN_MEANINGFUL_BREAK_MINUTES = 5;
export const PLANNED_BREAK_DEFERRAL_MINUTES = 15;
export const NATURAL_BOUNDARY_GRACE_MINUTES = 15;
export const recoveryLoad = (minutes: number, energy: number | undefined, sensitivity: number) => minutes * (RECOVERY_ENERGY_WEIGHTS[energy as keyof typeof RECOVERY_ENERGY_WEIGHTS] ?? 1) * sensitivity;
