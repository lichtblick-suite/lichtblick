// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import downsample from "@foxglove/studio-base/components/TimeBasedChart/downsample";

describe("downsample", () => {
  const bounds = { width: 100, height: 100, x: { min: 0, max: 100 }, y: { min: 0, max: 100 } };

  it("merges nearby points", () => {
    const result = downsample(
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
        { x: 20, y: 10 },
        { x: 20, y: 20 },
      ],
    });
  });

  it("always keeps first and last point", () => {
    const result = downsample(
      {
        data: [
          { x: 0, y: 0 },
          { x: 0, y: 0.1 },
          { x: 0, y: 0.2 },
        ],
      },
      bounds,
    );
    expect(result).toEqual({
      data: [
        { x: 0, y: 0 },
        { x: 0, y: 0.2 },
      ],
    });
  });
});
