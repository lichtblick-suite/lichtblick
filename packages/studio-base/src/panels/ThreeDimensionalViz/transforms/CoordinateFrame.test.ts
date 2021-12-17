// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec, Time } from "@foxglove/rostime";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

import { CoordinateFrame } from "./CoordinateFrame";
import { Transform } from "./Transform";
import { mat4Identity } from "./geometry";

type TimeAndTransform = [time: Time, transform: Transform];

describe("CoordinateFrame", () => {
  it("construction and traversal", () => {
    const odom = new CoordinateFrame("odom", undefined, undefined);
    expect(odom.id).toBe("odom");
    expect(odom.maxStorageTime).toEqual({ sec: 10, nsec: 0 });
    expect(odom.parent()).toBeUndefined();
    expect(odom.root()).toBe(odom);
    expect(odom.findAncestor("base_link")).toBeUndefined();

    const baseLink = new CoordinateFrame("base_link", odom, { sec: 1, nsec: 2 });
    expect(baseLink.id).toBe("base_link");
    expect(baseLink.maxStorageTime).toEqual({ sec: 1, nsec: 2 });
    expect(baseLink.parent()).toBe(odom);
    expect(baseLink.findAncestor("odom")).toBe(odom);
    expect(baseLink.root()).toBe(odom);

    expect(odom.parent()).toBeUndefined();
    expect(odom.root()).toBe(odom);
    expect(odom.findAncestor("base_link")).toBeUndefined();

    const map = new CoordinateFrame("map", undefined, undefined);
    odom.setParent(map);

    expect(odom.parent()).toBe(map);
    expect(odom.root()).toBe(map);
    expect(odom.findAncestor("base_link")).toBeUndefined();
    expect(odom.findAncestor("map")).toBe(map);

    expect(baseLink.root()).toBe(map);
  });

  it("Interpolate", () => {
    const lower: TimeAndTransform = [{ sec: 0, nsec: 0 }, new Transform([0, 0, 0], [0, 0, 0, 1])];
    const upper: TimeAndTransform = [{ sec: 1, nsec: 0 }, new Transform([1, 1, 1], [0, 0, 1, 0])];

    const outTime = { sec: 0, nsec: 0 };
    const outTf = Transform.Identity();
    CoordinateFrame.Interpolate(outTime, outTf, lower, upper, { sec: 0, nsec: 0 });
    expect(outTime).toEqual({ sec: 0, nsec: 0 });
    expect(outTf.position()).toEqual([0, 0, 0]);
    expect(outTf.rotation()).toEqual([0, 0, 0, 1]);

    CoordinateFrame.Interpolate(outTime, outTf, lower, upper, { sec: 1, nsec: 0 });
    expect(outTime).toEqual({ sec: 1, nsec: 0 });
    expect(outTf.position()).toEqual([1, 1, 1]);
    expect(outTf.rotation()).toEqual([0, 0, 1, 0]); // 180 degrees around z

    CoordinateFrame.Interpolate(outTime, outTf, lower, upper, fromSec(0.5));
    expect(outTime).toEqual({ sec: 0, nsec: 5e8 });
    expect(outTf.position()).toEqual([0.5, 0.5, 0.5]);
    expect(outTf.rotation()).toEqual([0, 0, 0.7071067811865476, 0.7071067811865476]); // 90 degrees around z
  });

  it("GetTransformMatrix", () => {
    const T0 = { sec: 0, nsec: 0 };
    const T1 = { sec: 0, nsec: 10 };
    const T2 = { sec: 0, nsec: 20 };

    const parent = new CoordinateFrame("parent", undefined);
    const child = new CoordinateFrame("child", parent);

    const out = mat4Identity();
    expect(CoordinateFrame.GetTransformMatrix(out, parent, child, T0, T0)).toBe(false);

    child.addTransform(T0, new Transform([1, 2, 3], [0, 0, 1, 0]));
    expect(CoordinateFrame.GetTransformMatrix(out, parent, child, T0, T0)).toBe(true);
    expect(out).toEqual([-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);

    child.addTransform(T1, new Transform([10, 20, 30], [0, 1, 0, 0]));
    expect(CoordinateFrame.GetTransformMatrix(out, parent, child, T1, T0)).toBe(true);
    expect(out).toEqual([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 10, 20, 30, 1]);

    child.addTransform(T2, new Transform([100, 200, 300], [1, 0, 0, 0]));
    expect(CoordinateFrame.GetTransformMatrix(out, parent, child, T2, T0)).toBe(true);
    expect(out).toEqual([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 100, 200, 300, 1]);

    expect(CoordinateFrame.GetTransformMatrix(out, parent, child, { sec: 0, nsec: 15 }, T0)).toBe(
      true,
    );
    // prettier-ignore
    expect(out).toEqual([
     -2.220446049250313e-16, 1.0000000000000002,    0,                   0,
      1.0000000000000002,   -2.220446049250313e-16, 0,                   0,
      0,                     0,                     -1.0000000000000004, 0,
      55,                    110,                   165,                 1,
    ]);

    expect(CoordinateFrame.GetTransformMatrix(out, parent, child, { sec: 0, nsec: 21 }, T0)).toBe(
      false,
    );
    expect(
      CoordinateFrame.GetTransformMatrix(
        out,
        parent,
        child,
        { sec: 0, nsec: 25 },
        { sec: 0, nsec: 4 },
      ),
    ).toBe(false);
    expect(
      CoordinateFrame.GetTransformMatrix(
        out,
        parent,
        child,
        { sec: 0, nsec: 25 },
        { sec: 0, nsec: 5 },
      ),
    ).toBe(true);
    expect(out).toEqual([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 100, 200, 300, 1]);
  });

  it("findClosestTransforms", () => {
    const TF1 = new Transform([1, 2, 3], [0, 0, 1, 0]);
    const TF2 = new Transform([10, 20, 30], [0, 1, 0, 0]);
    const TF3 = new Transform([100, 200, 300], [1, 0, 0, 0]);
    const TF4 = new Transform([1000, 2000, 3000], [0.5, 0.5, 0.5, 0.5]);

    const frame = new CoordinateFrame("frame", undefined);

    const lower: TimeAndTransform = [{ sec: 0, nsec: 0 }, Transform.Identity()];
    const upper: TimeAndTransform = [{ sec: 0, nsec: 0 }, Transform.Identity()];
    expect(
      frame.findClosestTransforms(lower, upper, { sec: 0, nsec: 0 }, { sec: 0, nsec: 0 }),
    ).toBe(false);

    frame.addTransform({ sec: 0, nsec: 0 }, TF1);
    expect(
      frame.findClosestTransforms(lower, upper, { sec: 0, nsec: 0 }, { sec: 0, nsec: 0 }),
    ).toBe(true);
    expect(lower).toEqual([{ sec: 0, nsec: 0 }, TF1]);
    expect(upper).toEqual([{ sec: 0, nsec: 0 }, TF1]);

    expect(
      frame.findClosestTransforms(lower, upper, { sec: 0, nsec: 1 }, { sec: 0, nsec: 0 }),
    ).toBe(false);
    expect(
      frame.findClosestTransforms(lower, upper, { sec: 0, nsec: 1 }, { sec: 0, nsec: 1 }),
    ).toBe(true);
    expect(lower).toEqual([{ sec: 0, nsec: 0 }, TF1]);
    expect(upper).toEqual([{ sec: 0, nsec: 0 }, TF1]);

    frame.addTransform({ sec: 0, nsec: 9 }, TF2);
    frame.addTransform({ sec: 0, nsec: 10 }, TF3);
    frame.addTransform({ sec: 0, nsec: 12 }, TF4);

    expect(
      frame.findClosestTransforms(lower, upper, { sec: 0, nsec: 1 }, { sec: 0, nsec: 0 }),
    ).toBe(true);
    expect(lower).toEqual([{ sec: 0, nsec: 0 }, TF1]);
    expect(upper).toEqual([{ sec: 0, nsec: 9 }, TF2]);

    expect(
      frame.findClosestTransforms(lower, upper, { sec: 0, nsec: 9 }, { sec: 0, nsec: 0 }),
    ).toBe(true);
    expect(lower).toEqual([{ sec: 0, nsec: 9 }, TF2]);
    expect(upper).toEqual([{ sec: 0, nsec: 9 }, TF2]);

    expect(
      frame.findClosestTransforms(lower, upper, { sec: 0, nsec: 11 }, { sec: 0, nsec: 0 }),
    ).toBe(true);
    expect(lower).toEqual([{ sec: 0, nsec: 10 }, TF3]);
    expect(upper).toEqual([{ sec: 0, nsec: 12 }, TF4]);
  });

  it("apply", () => {
    const parent = new CoordinateFrame("parent", undefined);
    parent.addTransform({ sec: 0, nsec: 0 }, new Transform([0, 1, 0], [0, 0, 0, 1]));
    const child = new CoordinateFrame("child", parent);
    child.addTransform({ sec: 0, nsec: 0 }, new Transform([1, 0, 0], [0, 0, 0, 1]));

    const out = emptyPose();
    expect(parent.apply(out, emptyPose(), child, { sec: 0, nsec: 0 })).toBeDefined();
    expect(out.position).toEqual({ x: 1, y: 0, z: 0 });
    expect(out.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });
});
