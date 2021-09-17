// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { downsampleTimeseries, downsampleScatter } from "./downsample";

describe("downsampleTimeseries", () => {
  const bounds = { width: 100, height: 100, x: { min: 0, max: 100 }, y: { min: 0, max: 100 } };

  it("merges nearby points", () => {
    const result = downsampleTimeseries(
      {
        data: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 1 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
        ],
      },
      bounds,
    );
    expect(result).toEqual({
      data: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
      ],
    });
  });

  it("should keep the min/max values within an interval", () => {
    const result = downsampleTimeseries(
      {
        data: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
          { x: 0, y: -20 },
          { x: 0, y: 4 },
        ],
      },
      bounds,
    );
    expect(result).toEqual({
      data: [
        { x: 0, y: 0 },
        { x: 0, y: -20 },
        { x: 0, y: 100 },
        { x: 0, y: 4 },
      ],
    });
  });

  it("should keep entry/exit datum to an interval", () => {
    const result = downsampleTimeseries(
      {
        data: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 100 },
          { x: 1, y: 4 },
          { x: 2, y: 5 },
        ],
      },
      bounds,
    );
    expect(result).toEqual({
      data: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 100 },
        { x: 1, y: 4 },
        { x: 2, y: 5 },
      ],
    });
  });
});

describe("downsampleScatter", () => {
  const bounds = { width: 100, height: 100, x: { min: 0, max: 100 }, y: { min: 0, max: 100 } };

  it("ignores out of bounds points", () => {
    const result = downsampleScatter(
      {
        data: [
          { x: -1, y: 0 },
          { x: 0, y: -1 },
          { x: 200, y: 0 },
          { x: 0, y: 200 },
        ],
      },
      bounds,
    );
    expect(result).toEqual({
      data: [],
    });
  });

  it("merges nearby points", () => {
    const result = downsampleScatter(
      {
        data: [
          { x: 0, y: 0 },
          { x: 0, y: 0.4 },
          { x: 0, y: 0.8 },
          { x: 0, y: 1 },
        ],
      },
      bounds,
    );
    expect(result).toEqual({
      data: [
        { x: 0, y: 0 },
        { x: 0, y: 0.8 },
      ],
    });
  });
});
