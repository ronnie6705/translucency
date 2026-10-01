// Figma 2025:10004: Smart Animate / Gentle, 1.0220937728881836 seconds.
// Gentle is the physical spring m=1, k=100, c=15, initial velocity=0.
// Sample the spring itself for CSS/WAAPI; a cubic Bezier cannot express it.
export const SCHEDULE_MOTION_MS = 1022.0937728881836;
const omega = Math.sqrt(100 - 7.5 ** 2);
export const SCHEDULE_SPRING = `linear(${Array.from({ length: 121 }, (_, i) => {
  const t = i / 120 * SCHEDULE_MOTION_MS / 1000;
  return i === 120 ? '1' : (1 - Math.exp(-7.5 * t) * (Math.cos(omega * t) + 7.5 / omega * Math.sin(omega * t))).toFixed(7);
}).join(',')})`;
