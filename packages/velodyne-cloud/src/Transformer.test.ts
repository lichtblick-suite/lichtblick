// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { benchmark } from "kelonio";

import { Calibration } from "./Calibration";
import { PointCloud } from "./PointCloud";
import { RawPacket } from "./RawPacket";
import { Transformer } from "./Transformer";
import { Model } from "./VelodyneTypes";
import { HDL32E_PACKET1 } from "./fixtures/packets";

function norm(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

describe("Transformer", () => {
  it("can transform a packet from an HDL-32E", () => {
    const calibration = new Calibration(Model.HDL32E);
    const transform = new Transformer(calibration);

    expect(transform.calibration).toStrictEqual(calibration);
    expect(transform.minRange).toEqual(0.4);
    expect(transform.maxRange).toEqual(100);

    const raw = new RawPacket(HDL32E_PACKET1);
    const cloud = new PointCloud({ stamp: 42, maxPoints: RawPacket.MAX_POINTS_PER_PACKET });
    transform.unpack(raw, 42, 42.1, cloud);
    cloud.trim();

    expect(cloud.height).toEqual(1);
    expect(cloud.width).toEqual(382);
    expect(cloud.data.byteLength).toEqual(382 * PointCloud.POINT_STEP);

    const view = new DataView(cloud.data.buffer, cloud.data.byteOffset, cloud.data.byteLength);
    expect(view.getFloat32(0, true)).toEqual(-1.5504857301712036); // x
    expect(view.getFloat32(4, true)).toEqual(1.4397920370101929); // y
    expect(view.getFloat32(8, true)).toEqual(-1.254827857017517); // z
    expect(view.getFloat32(12, true)).toEqual(2.4600000381469727); // distance
    expect(view.getFloat32(16, true)).toEqual(9); // intensity
    expect(view.getUint16(20, true)).toEqual(0); // ring
    expect(view.getUint16(22, true)).toEqual(22288); // azimuth
    expect(view.getUint32(24, true)).toEqual(1e8); // deltaNs

    for (let i = 0; i < cloud.width; i++) {
      const p = cloud.point(i);
      expect(norm(p.x, p.y, p.z)).toBeCloseTo(p.distance);
      expect(p.azimuth).toBeGreaterThanOrEqual(transform.minAngle);
      expect(p.azimuth).toBeLessThanOrEqual(transform.maxAngle);
      expect(p.distance).toBeGreaterThanOrEqual(transform.minRange);
      expect(p.distance).toBeLessThanOrEqual(transform.maxRange);
      expect(p.intensity).toBeGreaterThanOrEqual(0);
      expect(p.intensity).toBeLessThanOrEqual(255);
      expect(p.ring).toBeGreaterThanOrEqual(0);
      expect(p.ring).toBeLessThanOrEqual(31);
      expect(p.deltaNs).toBeGreaterThanOrEqual(0);
      expect(p.deltaNs).toBeLessThanOrEqual(2e8);
    }
  });

  // CI performance is non-deterministic, a better approach will be to have dedicated machines
  // and log performance over time to correlate regressions rather than gate
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("has expected performance", async () => {
    const calibration = new Calibration(Model.HDL32E);
    const transform = new Transformer(calibration);
    const maxPoints = RawPacket.MAX_POINTS_PER_PACKET * 100;

    await benchmark.record(
      ["Transformer", "HDL-32E"],
      () => {
        const raw = new RawPacket(HDL32E_PACKET1);
        const cloud = new PointCloud({ stamp: 0, maxPoints });
        for (let i = 0; i < 100; i++) {
          transform.unpack(raw, 0, 0, cloud);
        }
        cloud.trim();
      },
      { iterations: 10, meanUnder: 15 },
    );

    // eslint-disable-next-line no-restricted-syntax
    console.log(benchmark.report());
  }, 10_000);
});
