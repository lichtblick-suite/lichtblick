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

import { decodeMarker } from "./decodeMarker";
import { POINT_CLOUD_MESSAGE } from "./fixture/pointCloudData";

describe("<PointClouds />", () => {
  describe("hitmap", () => {
    it("builds empty color buffer if hitmap colors are provided", () => {
      const result = decodeMarker({
        ...POINT_CLOUD_MESSAGE,
        // Three colors per point
        hitmapColors: [255, 255, 255, 255, 255, 255, 255, 255, 255],
      } as any);
      const { colorBuffer } = result;
      expect(colorBuffer).toBeNullOrUndefined();
    });
  });
});
