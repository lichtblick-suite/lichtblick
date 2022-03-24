// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ColorRGBA } from "../../ros";

export enum PointCloudColorMode {
  Flat,
  Gradient,
  Rainbow,
  Rgb,
  Rgba,
  Turbo,
}

export type PointCloudSettings = {
  pointSize: number;
  pointShape: "circle" | "square";
  decayTime: number;
  colorMode: PointCloudColorMode;
  rgbByteOrder: "rgba" | "bgra" | "abgr";
  flatColor: ColorRGBA;
  colorField?: string;
  minColor: ColorRGBA;
  maxColor: ColorRGBA;
  minValue?: number;
  maxValue?: number;
};

// ts-prune-ignore-next
export type StoredPointCloudSettings = Partial<PointCloudSettings>;
