export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type Project = (x: number, y: number) => [number, number];

export function boundsOf(points: readonly { x: number; y: number }[]): Bounds | undefined {
  if (points.length === 0) {
    return undefined;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) {
      minX = p.x;
    }
    if (p.x > maxX) {
      maxX = p.x;
    }
    if (p.y < minY) {
      minY = p.y;
    }
    if (p.y > maxY) {
      maxY = p.y;
    }
  }
  return { minX, maxX, minY, maxY };
}

export function padBounds(b: Bounds, pad: number): Bounds {
  return { minX: b.minX - pad, maxX: b.maxX + pad, minY: b.minY - pad, maxY: b.maxY + pad };
}

export function atLeastExtent(b: Bounds, extent: number): Bounds {
  const result = { ...b };
  if (result.maxX - result.minX < extent) {
    const cx = (result.minX + result.maxX) / 2;
    result.minX = cx - extent / 2;
    result.maxX = cx + extent / 2;
  }
  if (result.maxY - result.minY < extent) {
    const cy = (result.minY + result.maxY) / 2;
    result.minY = cy - extent / 2;
    result.maxY = cy + extent / 2;
  }
  return result;
}

// Fit-to-box uniform scale (preserves aspect ratio) with a flipped Y axis (world +Y is up,
// canvas +Y is down) so drawing code can work in plain world coordinates.
export function makeProjector(
  bounds: Bounds,
  width: number,
  height: number,
  pad = 28,
): { toPx: Project; scale: number } {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offsetX = pad + (width - 2 * pad - spanX * scale) / 2;
  const offsetY = pad + (height - 2 * pad - spanY * scale) / 2;
  const toPx: Project = (x, y) => [
    offsetX + (x - bounds.minX) * scale,
    height - (offsetY + (y - bounds.minY) * scale),
  ];
  return { toPx, scale };
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return undefined;
  }
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

// 10-point (5-pointed) star, alternating outer `radius` / inner `radius / 2.3`, first point
// straight up.
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fill: string,
  stroke: string,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? radius : radius / 2.3;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Shaft + a triangular head formed by rotating back along the shaft direction by +/-30 degrees.
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 8;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(angle - Math.PI / 6),
    y2 - head * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - head * Math.cos(angle + Math.PI / 6),
    y2 - head * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}
