import { nearestByTime, poseAt, projectToMap, secondsFromT0 } from "./geometry";

interface Sample {
  tNs: number;
  label: string;
}

function sample(tNs: number, label: string): Sample {
  return { tNs, label };
}

// A brute-force linear scan mirroring the original implementation, used as an oracle to check the
// binary-search version against a range of randomized sorted inputs.
function linearNearestByTime<T extends { tNs: number }>(
  samples: readonly T[],
  tNs: number,
): T | undefined {
  if (samples.length === 0) {
    return undefined;
  }
  let best = samples[0]!;
  let bestDelta = Math.abs(best.tNs - tNs);
  for (const s of samples) {
    const delta = Math.abs(s.tNs - tNs);
    if (delta < bestDelta) {
      best = s;
      bestDelta = delta;
    }
  }
  return best;
}

describe("nearestByTime", () => {
  it("returns undefined for an empty array", () => {
    expect(nearestByTime([], 100)).toBeUndefined();
  });

  it("returns the only sample for a single-element array", () => {
    const samples = [sample(10, "a")];
    expect(nearestByTime(samples, 999)).toBe(samples[0]);
    expect(nearestByTime(samples, -999)).toBe(samples[0]);
  });

  it("returns the exact match when present", () => {
    const samples = [sample(0, "a"), sample(10, "b"), sample(20, "c")];
    expect(nearestByTime(samples, 10)).toBe(samples[1]);
  });

  it("clamps to the first sample when the query is before the range", () => {
    const samples = [sample(10, "a"), sample(20, "b"), sample(30, "c")];
    expect(nearestByTime(samples, -100)).toBe(samples[0]);
  });

  it("clamps to the last sample when the query is after the range", () => {
    const samples = [sample(10, "a"), sample(20, "b"), sample(30, "c")];
    expect(nearestByTime(samples, 1000)).toBe(samples[2]);
  });

  it("picks the nearer neighbor between two samples", () => {
    const samples = [sample(0, "a"), sample(100, "b")];
    expect(nearestByTime(samples, 30)).toBe(samples[0]);
    expect(nearestByTime(samples, 70)).toBe(samples[1]);
  });

  it("breaks exact ties in favor of the earlier sample", () => {
    const samples = [sample(0, "a"), sample(100, "b")];
    expect(nearestByTime(samples, 50)).toBe(samples[0]);
  });

  it("matches a brute-force linear scan across many random sorted inputs", () => {
    for (let trial = 0; trial < 200; trial++) {
      const length = 1 + Math.floor(Math.random() * 50);
      const tNsValues: number[] = [];
      let t = Math.floor(Math.random() * 1000);
      for (let i = 0; i < length; i++) {
        tNsValues.push(t);
        t += Math.floor(Math.random() * 20); // strictly non-decreasing, ties allowed
      }
      const samples = tNsValues.map((tns, i) => sample(tns, `s${i}`));
      const query = Math.floor(Math.random() * (t + 100)) - 50;

      const expected = linearNearestByTime(samples, query);
      const actual = nearestByTime(samples, query);
      expect(actual?.tNs).toBe(expected?.tNs);
    }
  });
});

describe("poseAt", () => {
  it("returns undefined for an empty odom list", () => {
    expect(poseAt([], 100)).toBeUndefined();
  });

  it("returns the pose of the nearest odom sample", () => {
    const odom = [
      { tNs: 0, x: 1, y: 2, yaw: 0.1 },
      { tNs: 10, x: 3, y: 4, yaw: 0.2 },
    ];
    expect(poseAt(odom, 9)).toEqual({ x: 3, y: 4, yaw: 0.2 });
  });
});

describe("projectToMap", () => {
  it("applies rotation then translation", () => {
    const result = projectToMap({ x: 1, y: 0 }, { x: 10, y: 20, yaw: Math.PI / 2 });
    expect(result.x).toBeCloseTo(10, 5);
    expect(result.y).toBeCloseTo(21, 5);
  });
});

describe("secondsFromT0", () => {
  it("converts a nanosecond delta to seconds", () => {
    expect(secondsFromT0(5_000_000_000, 2_000_000_000)).toBeCloseTo(3, 9);
  });
});
