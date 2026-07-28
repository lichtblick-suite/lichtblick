// Pixel-identical port of root-cause-analyzer's apps/frontend/.../blackbox/tactical-map.tsx onto a
// canvas that's resized to fill the panel rather than a fixed 760x560 box.
import {
  atLeastExtent,
  Bounds,
  boundsOf,
  drawArrow,
  drawStar,
  makeProjector,
  padBounds,
} from "@lichtblick/suite-base/panels/BlackboxShared/canvas";
import { heightColor, speedColor } from "@lichtblick/suite-base/panels/BlackboxShared/colormap";
import type {
  OdomSample,
  PathPoint,
  ZoneViolation,
} from "@lichtblick/suite-base/panels/BlackboxShared/decode";
import { nearestByTime, poseAt, projectToMap } from "@lichtblick/suite-base/panels/BlackboxShared/geometry";

export interface TacticalMapScan {
  tNs: number;
  points: { x: number; y: number; z: number }[];
}

// The trajectory line itself is one moveTo/lineTo path regardless of point count -- cheap even at
// full resolution. The per-sample speed-colored marker below is 3 canvas calls (beginPath/arc/fill)
// plus a fillStyle change *per point*, redrawn on every onRender (not just when odom changes), so
// an uncapped `/odom` history (easily thousands of samples over a preload:true window) makes this
// panel the single heaviest one in the layout. Cap the markers the same way point clouds are capped
// (RcaPointCloudReader.MaxLidarPointsPerScan / BlackboxShared/pointCloud.ts's DEFAULT_MAX_POINTS).
const MAX_TRAJECTORY_MARKERS = 2_000;

// `boundsOf(odom)` is an O(n) scan over the same odom history described above, but unlike the
// trajectory it wasn't capped -- it was recomputed from scratch on every onRender call even
// though `odom` (the array reference from TacticalMap.tsx's frame cache) only actually changes
// when a new preloaded block arrives. Cache it by array identity so a redraw triggered by e.g. the
// playhead advancing (odom unchanged) reuses the previous bounds instead of re-scanning the whole
// history. WeakMap avoids retaining old odom arrays once the frame cache replaces them.
const odomBoundsCache = new WeakMap<readonly OdomSample[], Bounds | undefined>();

function cachedBoundsOf(odom: readonly OdomSample[]): Bounds | undefined {
  if (odomBoundsCache.has(odom)) {
    return odomBoundsCache.get(odom);
  }
  const bounds = boundsOf(odom);
  odomBoundsCache.set(odom, bounds);
  return bounds;
}

export interface TacticalMapInput {
  odom: OdomSample[];
  plannedPath: PathPoint[];
  hazardPolygon: PathPoint[];
  zoneViolations: ZoneViolation[];
  scan: TacticalMapScan | undefined;
  t0Ns: number | undefined;
}

export const TACTICAL_MAP_LEGEND: { color: string; label: string; border?: boolean }[] = [
  { color: "#3c966f", label: "Lidar terrain (height)" },
  { color: "#9c179e", label: "Trajectory (speed)" },
  { color: "#ffffff", label: "Planned path", border: true },
  { color: "#f59e0b", label: "Hazard zone @ T0" },
  { color: "#ef4444", label: "Path-collision obstacle" },
  { color: "#facc15", label: "Hazard violation (T0)" },
];

export function drawTacticalMap(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  input: TacticalMapInput,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#eef2f5";
  ctx.fillRect(0, 0, width, height);

  const { odom, plannedPath, hazardPolygon, zoneViolations, scan, t0Ns } = input;
  const odomBounds = cachedBoundsOf(odom);
  if (!odomBounds || t0Ns == undefined) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText("No odometry available for the tactical map.", 24, 32);
    return;
  }
  const pose0 = poseAt(odom, t0Ns);
  if (!pose0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText("No odometry available for the tactical map.", 24, 32);
    return;
  }

  const bounds = atLeastExtent(padBounds(odomBounds, 6), 16);
  const { toPx } = makeProjector(bounds, width, height);
  const inBounds = (x: number, y: number): boolean =>
    x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;

  if (scan) {
    const scanPose = poseAt(odom, scan.tNs);
    if (scanPose) {
      ctx.globalAlpha = 0.8;
      for (const point of scan.points) {
        const m = projectToMap(point, scanPose);
        if (!inBounds(m.x, m.y)) {
          continue;
        }
        const [px, py] = toPx(m.x, m.y);
        ctx.fillStyle = heightColor(point.z);
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  if (plannedPath.length > 1) {
    ctx.beginPath();
    plannedPath.forEach((p, i) => {
      const [px, py] = toPx(p.x, p.y);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  odom.forEach((s, i) => {
    const [px, py] = toPx(s.x, s.y);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.stroke();
  const markerStride =
    odom.length > 0 ? Math.max(1, Math.floor(odom.length / MAX_TRAJECTORY_MARKERS)) : 1;
  for (let i = 0; i < odom.length; i += markerStride) {
    const s = odom[i]!;
    const [px, py] = toPx(s.x, s.y);
    ctx.fillStyle = speedColor(s.speed);
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hazardPolygon.length > 2) {
    ctx.beginPath();
    hazardPolygon.forEach((p, i) => {
      const m = projectToMap(p, pose0);
      const [px, py] = toPx(m.x, m.y);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.closePath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  for (const z of zoneViolations) {
    if (z.type !== 0 || !z.violated) {
      continue;
    }
    const pose = poseAt(odom, z.tNs);
    if (!pose) {
      continue;
    }
    const m = projectToMap({ x: z.x, y: z.y }, pose);
    if (!inBounds(m.x, m.y)) {
      continue;
    }
    const [px, py] = toPx(m.x, m.y);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const tagViolation = nearestByTime(
    zoneViolations.filter((z) => z.type === 1 && z.violated),
    t0Ns,
  );
  if (tagViolation) {
    const pose = poseAt(odom, tagViolation.tNs) ?? pose0;
    const m = projectToMap({ x: tagViolation.x, y: tagViolation.y }, pose);
    const [px, py] = toPx(m.x, m.y);
    drawStar(ctx, px, py, 10, "#facc15", "#000000");
  }

  const [hx, hy] = toPx(pose0.x, pose0.y);
  const [hx2, hy2] = toPx(pose0.x + 2.4 * Math.cos(pose0.yaw), pose0.y + 2.4 * Math.sin(pose0.yaw));
  drawArrow(ctx, hx, hy, hx2, hy2, "#111111");
}
