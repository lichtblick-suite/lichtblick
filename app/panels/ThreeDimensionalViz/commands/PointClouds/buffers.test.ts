// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { FLOAT_SIZE, reinterpretBufferToFloat, expandBufferToFloat } from "./buffers";
import { POINT_CLOUD_MESSAGE } from "./fixture/pointCloudData";

describe("<PointClouds />", () => {
  describe("data transformations", () => {
    it("reinterprets data buffer as a float array", () => {
      const { data } = POINT_CLOUD_MESSAGE;
      const buffer = reinterpretBufferToFloat(data);
      expect(buffer.length).toBe(6 * FLOAT_SIZE);
      expect(Math.floor(buffer[0]!)).toBe(-2239);
      expect(Math.floor(buffer[1]!)).toBe(-706);
      expect(Math.floor(buffer[2]!)).toBe(-3);
      expect(Math.floor(buffer[8]!)).toBe(-2239);
      expect(Math.floor(buffer[9]!)).toBe(-706);
      expect(Math.floor(buffer[10]!)).toBe(-3);
    });

    it("expands data buffer to make it float array", () => {
      const { data } = POINT_CLOUD_MESSAGE;
      const buffer = expandBufferToFloat(data);
      expect(buffer.length).toBe(data.length);
      expect(Math.floor(buffer[16]!)).toBe(255);
      expect(Math.floor(buffer[17]!)).toBe(225);
      expect(Math.floor(buffer[18]!)).toBe(127);
    });

    it("handles odd sizes", () => {
      const srcBuffer = new ArrayBuffer(11);
      const data = new Uint8Array(srcBuffer);
      const buffer = reinterpretBufferToFloat(data);
      expect(buffer).toHaveLength(2);
    });

    it("handles odd offsets", () => {
      const srcBuffer = new ArrayBuffer(15);
      const data = new Uint8Array(srcBuffer, 5, 8);
      const buffer = reinterpretBufferToFloat(data);
      expect(buffer).toHaveLength(2);
    });
  });
});
