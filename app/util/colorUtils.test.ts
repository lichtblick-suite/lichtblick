// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { rgbStrToReglRGB, hexToRgbString } from "@foxglove/studio-base/util/colorUtils";

describe("colorUtils", () => {
  it("hexToRgbString", () => {
    expect(hexToRgbString("#ffffff", 0.5)).toEqual("rgba(255, 255, 255, 0.5)");
  });
  it("rgbStrToReglRGB", () => {
    expect(rgbStrToReglRGB("rgb(255,255,255)")).toEqual([1, 1, 1, 1]);
    expect(rgbStrToReglRGB("rgb(255,0,255)", 0)).toEqual([1, 0, 1, 0]);
    expect(rgbStrToReglRGB("rgba(0,255,0, 0.5)")).toEqual([0, 1, 0, 0.5]);
  });
});
