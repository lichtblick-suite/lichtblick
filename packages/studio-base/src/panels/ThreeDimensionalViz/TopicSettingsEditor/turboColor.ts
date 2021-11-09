// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type Vec4 = [number, number, number, number];
type Vec3 = [number, number, number];
type Vec2 = [number, number];

function dot4(a: Vec4, b: Vec4): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

function dot2(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function turboColor(pct: number): Vec3 {
  const kRedVec4: Vec4 = [0.13572138, 4.6153926, -42.66032258, 132.13108234];
  const kGreenVec4: Vec4 = [0.09140261, 2.19418839, 4.84296658, -14.18503333];
  const kBlueVec4: Vec4 = [0.1066733, 12.64194608, -60.58204836, 110.36276771];
  const kRedVec2: Vec2 = [-152.94239396, 59.28637943];
  const kGreenVec2: Vec2 = [4.27729857, 2.82956604];
  const kBlueVec2: Vec2 = [-89.90310912, 27.34824973];

  const x = pct;
  const v4: Vec4 = [1.0, x, x * x, x * x * x];
  const v2: Vec2 = [v4[2] * v4[2], v4[3] * v4[2]];
  return [
    255.0 * (dot4(v4, kRedVec4) + dot2(v2, kRedVec2)),
    255.0 * (dot4(v4, kGreenVec4) + dot2(v2, kGreenVec2)),
    255.0 * (dot4(v4, kBlueVec4) + dot2(v2, kBlueVec2)),
  ];
}

export function turboColorString(pct: number): string {
  const rgb = turboColor(pct);
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}
