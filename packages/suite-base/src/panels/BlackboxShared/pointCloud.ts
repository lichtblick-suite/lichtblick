// Reuses Lichtblick's own sensor_msgs/PointCloud2 field reader (the same one ThreeDeeRender's
// point-cloud renderer and the UserScript "pointClouds" helpers use) instead of writing a second
// binary parser -- the fork already has to solve this exact problem.
import {
  readPoints,
  type sensor_msgs__PointCloud2,
} from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/userUtils/pointClouds";

import type { LidarPoint } from "./decode";

interface MaybePointCloud2 {
  fields?: unknown;
  data?: unknown;
}

// Mirrors RcaPointCloudReader.Read's MaxLidarPointsPerScan cap (RootCause.Infrastructure/Services/
// BlackBoxIngestion/Rca/RcaEvidenceExtractor.cs) -- these panels re-draw every point in the scan on
// every onRender call (not just when the scan changes), so an uncapped cloud makes TacticalMap and
// LidarProfile the heaviest panels in the layout on any scan with tens of thousands of points.
const DEFAULT_MAX_POINTS = 8_000;

/** sensor_msgs/msg/PointCloud2 -> {x,y,z}[], looking up field indices by name (not fixed offsets). */
export function decodePointCloud(message: unknown, maxPoints = DEFAULT_MAX_POINTS): LidarPoint[] {
  const maybeCloud = message as MaybePointCloud2;
  if (!Array.isArray(maybeCloud.fields) || !(maybeCloud.data instanceof Uint8Array)) {
    return [];
  }
  const cloud = message as sensor_msgs__PointCloud2;
  const xIndex = cloud.fields.findIndex((field) => field.name === "x");
  const yIndex = cloud.fields.findIndex((field) => field.name === "y");
  const zIndex = cloud.fields.findIndex((field) => field.name === "z");
  if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
    return [];
  }

  const rows = readPoints(cloud);
  const stride = maxPoints > 0 ? Math.max(1, Math.floor(rows.length / maxPoints)) : 1;
  const points: LidarPoint[] = [];
  for (let i = 0; i < rows.length; i += stride) {
    const row = rows[i]!;
    const x = row[xIndex];
    const y = row[yIndex];
    const z = row[zIndex];
    if (typeof x === "number" && typeof y === "number" && typeof z === "number") {
      points.push({ x, y, z });
    }
  }
  return points;
}
