// Pixel-identical port of root-cause-analyzer's apps/frontend/.../blackbox/lidar-profile.tsx onto
// canvases resized to fill the panel rather than a fixed 420x420 box.
import { drawStar, makeProjector } from "@lichtblick/suite-base/panels/BlackboxShared/canvas";
import { heightColor } from "@lichtblick/suite-base/panels/BlackboxShared/colormap";
import type { LidarPoint, PathPoint, ZoneViolation } from "@lichtblick/suite-base/panels/BlackboxShared/decode";

export interface LidarProfileScan {
  tNs: number;
  points: LidarPoint[];
}

export interface LidarProfileInput {
  scan: LidarProfileScan | undefined;
  hazardPolygon: PathPoint[];
  violation: ZoneViolation | undefined;
}

function setupCanvas(
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
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, width, height);
  return ctx;
}

function emptyMessage(ctx: CanvasRenderingContext2D, message: string): void {
  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText(message, 16, 24);
}

export function drawTopDown(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  input: LidarProfileInput,
): void {
  const ctx = setupCanvas(canvas, width, height);
  if (!ctx) {
    return;
  }
  const points = input.scan?.points ?? [];
  if (points.length === 0) {
    emptyMessage(ctx, "No lidar scan near T0.");
    return;
  }

  const bounds = { minX: -2, maxX: 14, minY: -9, maxY: 9 };
  const { toPx } = makeProjector(bounds, width, height);

  for (const p of points) {
    if (p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY) {
      continue;
    }
    const [px, py] = toPx(p.x, p.y);
    ctx.fillStyle = heightColor(p.z);
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }

  if (input.hazardPolygon.length > 2) {
    ctx.beginPath();
    input.hazardPolygon.forEach((p, i) => {
      const [px, py] = toPx(p.x, p.y);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.closePath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (input.violation) {
    const [px, py] = toPx(input.violation.x, input.violation.y);
    drawStar(ctx, px, py, 10, "#facc15", "#000000");
  }
}

export function drawProfile(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  input: LidarProfileInput,
): void {
  const ctx = setupCanvas(canvas, width, height);
  if (!ctx) {
    return;
  }
  const points = input.scan?.points ?? [];
  const violation = input.violation;
  if (!violation || points.length === 0) {
    emptyMessage(ctx, "No hazard-zone violation to profile.");
    return;
  }

  const bearing = Math.atan2(violation.y, violation.x);
  const bounds = { minX: 0, maxX: 14, minY: -2, maxY: 2 };
  const { toPx } = makeProjector(bounds, width, height);

  const [, gy] = toPx(0, 0);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toPx(bounds.minX, 0)[0], gy);
  ctx.lineTo(toPx(bounds.maxX, 0)[0], gy);
  ctx.stroke();

  const violationRange = Math.hypot(violation.x, violation.y);
  const [vx, vy0] = toPx(violationRange, bounds.minY);
  const [, vy1] = toPx(violationRange, bounds.maxY);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(vx, vy0);
  ctx.lineTo(vx, vy1);
  ctx.stroke();

  for (const p of points) {
    const range = Math.hypot(p.x, p.y);
    if (range < 0.5 || range > bounds.maxX) {
      continue;
    }
    const azimuth = Math.atan2(p.y, p.x);
    if (Math.abs(azimuth - bearing) > 0.05) {
      continue;
    }
    const z = Math.max(bounds.minY, Math.min(bounds.maxY, p.z));
    const [px, py] = toPx(range, z);
    ctx.fillStyle = heightColor(p.z);
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
}
