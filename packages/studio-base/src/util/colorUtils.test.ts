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
import {
  colorObjToRGBA,
  defaultedRGBStringFromColorObj,
} from "@foxglove/studio-base/util/colorUtils";

describe("colorUtils", () => {
  it("colorObjToRGBA", () => {
    expect(colorObjToRGBA({ r: 1, g: 1, b: 1, a: 1 })).toEqual({ r: 255, g: 255, b: 255, a: 100 });
    expect(colorObjToRGBA({ r: 0, g: 1, b: 1, a: 0.5 })).toEqual({
      r: 0,
      g: 255,
      b: 255,
      a: 50,
    });
    expect(colorObjToRGBA({ r: 0, g: 0, b: 0, a: 0 })).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    });
  });
  it("defaultedRGBStringFromColorObj", () => {
    expect(defaultedRGBStringFromColorObj(undefined)).toEqual("rgba(255, 255, 255, 1)");
    expect(defaultedRGBStringFromColorObj({ r: 0.5, b: 0.5, g: 0.5, a: 0.7 })).toEqual(
      "rgba(128, 128, 128, 0.7)",
    );
  });
});
