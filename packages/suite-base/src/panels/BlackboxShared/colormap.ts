type RGB = [number, number, number];
type Stop = [number, RGB];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ramp(stops: Stop[], value: number): string {
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i - 1]!;
    const [p2, c2] = stops[i]!;
    if (value <= p2) {
      const span = p2 - p1;
      const t = (value - p1) / (span === 0 ? 1 : span);
      const r = Math.round(lerp(c1[0], c2[0], t));
      const g = Math.round(lerp(c1[1], c2[1], t));
      const b = Math.round(lerp(c1[2], c2[2], t));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const [, lastColor] = stops[stops.length - 1]!;
  return `rgb(${lastColor[0]}, ${lastColor[1]}, ${lastColor[2]})`;
}

const TERRAIN: Stop[] = [
  [0, [44, 60, 140]],
  [0.4, [60, 150, 120]],
  [0.6, [120, 170, 90]],
  [0.75, [160, 130, 70]],
  [0.9, [200, 180, 150]],
  [1, [245, 245, 245]],
];

const SPEED: Stop[] = [
  [0, [13, 8, 135]],
  [0.5, [156, 23, 158]],
  [0.75, [237, 121, 83]],
  [1, [240, 249, 33]],
];

export function heightColor(z: number, vmin = -1.2, vmax = 1.2): string {
  return ramp(TERRAIN, clamp01((z - vmin) / (vmax - vmin)));
}

export function speedColor(speed: number, vmax = 1.8): string {
  return ramp(SPEED, clamp01(Math.abs(speed) / vmax));
}
