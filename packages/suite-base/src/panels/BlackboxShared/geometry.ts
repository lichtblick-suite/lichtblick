export interface Point2 {
  x: number;
  y: number;
}

export interface Pose2 {
  x: number;
  y: number;
  yaw: number;
}

export function secondsFromT0(tNs: number, t0Ns: number): number {
  return (tNs - t0Ns) / 1e9;
}

// Rigid 2D transform: rotate the vehicle-frame point by pose.yaw, then translate by pose.{x,y}.
export function projectToMap(vehicle: Point2, pose: Pose2): Point2 {
  const c = Math.cos(pose.yaw);
  const s = Math.sin(pose.yaw);
  return {
    x: pose.x + c * vehicle.x - s * vehicle.y,
    y: pose.y + s * vehicle.x + c * vehicle.y,
  };
}

// No interpolation -- snaps to whichever sample's tNs is closest to the query time.
//
// Callers pass samples in ascending-tNs order: TacticalMap explicitly re-sorts odom after every
// frame-cache update, and violation/other decoded lists come from `renderState.allFrames`, which
// Lichtblick's message pipeline already guarantees is receiveTime-ordered (filtering by topic
// preserves that order). Given sorted input, |sample.tNs - tNs| is unimodal across the array (it
// only decreases then increases), so the global minimum sits at the binary-search insertion point
// -- only the two neighboring samples there need checking. This runs inside TacticalMap's
// zone-violation draw loop (once per violation, every frame), so for a preloaded clip with a large
// odom history a linear scan there is O(violations * odom) per redraw; this is O(violations *
// log(odom)).
export function nearestByTime<T extends { tNs: number }>(
  samples: readonly T[],
  tNs: number,
): T | undefined {
  if (samples.length === 0) {
    return undefined;
  }

  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid]!.tNs < tNs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // `lo` is the first sample with tNs >= tNs (or the last index if every sample is earlier).
  const candidate = samples[lo]!;
  if (lo > 0) {
    const prev = samples[lo - 1]!;
    // `<=` (not `<`) so an exact tie keeps the earlier sample, matching the original linear
    // scan's first-minimum-wins behavior.
    if (Math.abs(prev.tNs - tNs) <= Math.abs(candidate.tNs - tNs)) {
      return prev;
    }
  }
  return candidate;
}

export function poseAt<T extends { tNs: number; x: number; y: number; yaw: number }>(
  odom: readonly T[],
  tNs: number,
): Pose2 | undefined {
  const sample = nearestByTime(odom, tNs);
  return sample ? { x: sample.x, y: sample.y, yaw: sample.yaw } : undefined;
}
