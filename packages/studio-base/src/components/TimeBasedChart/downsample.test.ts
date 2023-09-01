// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { iterateObjects } from "@foxglove/studio-base/components/Chart/datasets";

import { downsampleTimeseries, downsampleScatter } from "./downsample";

describe("downsampleTimeseries", () => {
  const bounds = {
    width: 100,
    height: 100,
    bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
  };

  it("merges nearby points", () => {
    const result = downsampleTimeseries(
      iterateObjects([
        { x: 0, y: 0, value: 0 },
        { x: 10, y: 0, value: 0 },
        { x: 20, y: 0, value: 0 },
        { x: 20, y: 1, value: 1 },
        { x: 20, y: 10, value: 10 },
        { x: 20, y: 20, value: 20 },
      ]),
      bounds,
    );
    expect(result).toEqual([0, 1, 2, 5]);
  });

  it("preserves distinctly labeled segments", () => {
    const result = downsampleTimeseries(
      iterateObjects([
        { x: 0, y: 0, value: 0, label: "1" },
        { x: 10, y: 0, value: 0, label: "2" },
        { x: 20, y: 0, value: 0 },
        { x: 20, y: 1, value: 1 },
        { x: 20, y: 10, value: 10 },
        { x: 20, y: 20, value: 20 },
      ]),
      bounds,
    );
    expect(result).toEqual([0, 1, 2, 5]);
  });

  it("should keep the min/max values within an interval", () => {
    const result = downsampleTimeseries(
      iterateObjects([
        { x: 0, y: 0, value: 0 },
        { x: 0, y: 100, value: 100 },
        { x: 0, y: -20, value: -20 },
        { x: 0, y: 4, value: 4 },
      ]),
      bounds,
    );
    expect(result).toEqual([0, 2, 1, 3]);
  });

  it("should keep entry/exit datum to an interval", () => {
    const result = downsampleTimeseries(
      iterateObjects([
        { x: 0, y: 0, value: 0 },
        { x: 1, y: 0, value: 0 },
        { x: 1, y: 100, value: 100 },
        { x: 1, y: 4, value: 4 },
        { x: 2, y: 5, value: 5 },
      ]),
      bounds,
    );
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("downsampleScatter", () => {
  const bounds = {
    width: 100,
    height: 100,
    bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
  };

  it("ignores out of bounds points", () => {
    const result = downsampleScatter(
      iterateObjects([
        { x: -1, y: 0, value: 0 },
        { x: 0, y: -1, value: -1 },
        { x: 200, y: 0, value: 0 },
        { x: 0, y: 200, value: 200 },
      ]),
      bounds,
    );
    expect(result).toEqual([1, 3]);
  });

  it("merges nearby points", () => {
    const result = downsampleScatter(
      iterateObjects([
        { x: 0, y: 0, value: 0 },
        { x: 0, y: 0.4, value: 0.4 },
        { x: 0, y: 0.8, value: 0.8 },
        { x: 0, y: 1, value: 1 },
      ]),
      bounds,
    );
    expect(result).toEqual([0, 2]);
  });
});
