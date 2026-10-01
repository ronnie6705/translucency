import type { CSSProperties } from 'react';
export const TASK_ENERGY_COLORS = {
  1: { solid: '#827FFF', tint: '#827FFF4D' },
  2: { solid: '#4D9FFF', tint: '#4D9FFF4D' },
  3: { solid: '#37CDB4', tint: '#37CDB44D' },
  4: { solid: '#FF8536', tint: '#FF85364D' },
  5: { solid: '#FF5C68', tint: '#FF5C684D' },
} as const;
export function taskEnergyColors(energy: number | undefined, isBreak = false) {
  return !isBreak && energy !== undefined && Object.hasOwn(TASK_ENERGY_COLORS, energy)
    ? TASK_ENERGY_COLORS[energy as keyof typeof TASK_ENERGY_COLORS]
    : { solid: '#FFFFFF40', tint: '#FFFFFF0D' };
}
export function taskEnergyStyle(energy: number | undefined, isBreak = false): CSSProperties {
  const colors = taskEnergyColors(energy, isBreak);
  return { '--task-energy-solid': colors.solid, '--task-energy-tint': colors.tint } as CSSProperties;
}
