// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getTypedLength } from "@foxglove/studio-base/components/Chart/datasets";
import { Bounds1D, PlotViewport } from "@foxglove/studio-base/components/TimeBasedChart/types";

import {
  shouldResetViewport,
  updateSource,
  initSource,
  updatePath,
  initPath,
  updateDownsample,
  initDownsampled,
} from "./downsample";
import { createPath, createDataset, createData, createDataMany, FAKE_PATH } from "./testing";
import { EmptyPlotData } from "../plotData";

const createBounds = (min: number, max: number): Bounds1D => ({
  min,
  max,
});

const createViewport = (width: number, height: number, min: number, max: number): PlotViewport => ({
  width,
  height,
  bounds: {
    x: { min, max },
    y: { min, max },
  },
});

const FAKE_BOUNDS = createBounds(0, 100);
const FAKE_VIEWPORT = createViewport(800, 600, 0, 100);
const MAX_POINTS = 1024;

const FAKE_DATASET = createDataset(10);
const EMPTY_DATASET = createDataset(0);

describe("updateSource", () => {
  it("ignores missing raw data", () => {
    const result = updateSource(
      createPath(FAKE_PATH),
      {
        raw: undefined,
        view: FAKE_VIEWPORT,
        viewBounds: FAKE_BOUNDS,
        maxPoints: MAX_POINTS,
      },
      // we want to ensure it returns a new, initialized source
      {
        ...initSource(),
        cursor: 999,
      },
    );

    expect(result).toEqual(initSource());
  });

  it("ignores an unchanged cursor", () => {
    const before = {
      ...initSource(),
      cursor: 10,
    };
    const after = updateSource(
      createPath(FAKE_PATH),
      {
        raw: createDataset(10),
        view: FAKE_VIEWPORT,
        viewBounds: FAKE_BOUNDS,
        maxPoints: MAX_POINTS,
      },
      before,
    );

    expect(after).toEqual(before);
  });

  it("resets when the dataset becomes empty", () => {
    const before = {
      ...initSource(),
      cursor: 10,
    };
    const after = updateSource(
      createPath(FAKE_PATH),
      {
        raw: EMPTY_DATASET,
        view: FAKE_VIEWPORT,
        viewBounds: FAKE_BOUNDS,
        maxPoints: MAX_POINTS,
      },
      before,
    );

    expect(after).toEqual(initSource());
  });

  it("resets and recalculates when the dataset shrinks", () => {
    const before = {
      ...initSource(),
      cursor: 20,
    };
    const after = updateSource(
      createPath(FAKE_PATH),
      {
        raw: FAKE_DATASET,
        view: FAKE_VIEWPORT,
        viewBounds: FAKE_BOUNDS,
        maxPoints: MAX_POINTS,
      },
      before,
    );
    expect(after.cursor).toEqual(10);
  });

  it("uses scatter plot algorithm on scatter dataset", () => {
    const before = initSource();
    const after = updateSource(
      {
        ...createPath(FAKE_PATH),
        showLine: false,
      },
      {
        raw: createDataset(50),
        view: FAKE_VIEWPORT,
        viewBounds: FAKE_BOUNDS,
        maxPoints: MAX_POINTS,
      },
      before,
    );

    const { dataset } = after;
    if (dataset == undefined) {
      throw new Error("can't happen");
    }
    expect(dataset.pointRadius).toEqual(undefined);
    expect(getTypedLength(dataset.data)).toEqual(50);
  });
});

describe("updatePath", () => {
  it("returns a partial view", () => {
    const before = initPath();
    const after = updatePath(
      createPath(FAKE_PATH),
      {
        blockData: createDataset(100),
        currentData: undefined,
        view: createViewport(800, 600, 0, 50),
        viewBounds: createBounds(0, 50),
        maxPoints: MAX_POINTS,
      },
      before,
    );
    expect(after.isPartial).toEqual(true);
  });

  it("returns a non-partial view when viewport is zero", () => {
    const before = initPath();
    const after = updatePath(
      createPath(FAKE_PATH),
      {
        blockData: createDataset(100),
        currentData: undefined,
        view: createViewport(800, 600, 0, 0),
        viewBounds: createBounds(0, 0),
        maxPoints: MAX_POINTS,
      },
      before,
    );
    expect(after.isPartial).toEqual(false);
  });

  it("goes back to non-partial when viewport expands", () => {
    const before = updatePath(
      createPath(FAKE_PATH),
      {
        blockData: createDataset(100),
        currentData: undefined,
        view: createViewport(800, 600, 0, 50),
        viewBounds: createBounds(0, 50),
        maxPoints: MAX_POINTS,
      },
      initPath(),
    );
    const after = updatePath(
      createPath(FAKE_PATH),
      {
        blockData: createDataset(100),
        currentData: undefined,
        view: createViewport(800, 600, 0, 110),
        viewBounds: createBounds(0, 110),
        maxPoints: MAX_POINTS,
      },
      before,
    );
    expect(after.isPartial).toEqual(false);
  });

  it("ignores current data when block data exceeds it", () => {
    const before = initPath();
    const after = updatePath(
      createPath(FAKE_PATH),
      {
        blockData: FAKE_DATASET,
        currentData: createDataset(2),
        view: createViewport(800, 600, 0, 15),
        viewBounds: createBounds(0, 15),
        maxPoints: MAX_POINTS,
      },
      before,
    );
    expect(after.current).toEqual(initSource());
  });

  it("updates both data sources", () => {
    const before = initPath();
    const after = updatePath(
      createPath(FAKE_PATH),
      {
        blockData: FAKE_DATASET,
        currentData: createDataset(15),
        view: createViewport(800, 600, 0, 15),
        viewBounds: createBounds(0, 15),
        maxPoints: MAX_POINTS,
      },
      before,
    );
    expect(after.current.cursor).toEqual(15);
    expect(after.blocks.cursor).toEqual(10);
  });
});

describe("shouldResetViewport", () => {
  it("do nothing if missing old viewport", () => {
    expect(
      shouldResetViewport([], undefined, createViewport(800, 600, 0, 120), createBounds(0, 100)),
    ).toEqual(false);
  });

  it("ignore partial paths that have no data", () => {
    expect(
      shouldResetViewport(
        [
          {
            ...initPath(),
            isPartial: true,
          },
        ],
        createViewport(800, 600, 0, 120),
        createViewport(800, 600, 0, 120),
        createBounds(0, 100),
      ),
    ).toEqual(false);
  });

  it("should reset if partial viewport changed", () => {
    expect(
      shouldResetViewport(
        [
          {
            ...initPath(),
            dataset: createDataset(20),
            isPartial: true,
          },
        ],
        createViewport(800, 600, 0, 20),
        createViewport(800, 600, 20, 40),
        createBounds(0, 100),
      ),
    ).toEqual(true);
  });

  it("should reset if zoomed", () => {
    expect(
      shouldResetViewport(
        [],
        createViewport(800, 600, 0, 20),
        createViewport(800, 600, 0, 40),
        createBounds(0, 100),
      ),
    ).toEqual(true);
  });

  it("should reset if y-bounds change", () => {
    const viewport = createViewport(800, 600, 0, 20);
    expect(
      shouldResetViewport(
        [],
        viewport,
        {
          ...viewport,
          bounds: {
            ...viewport.bounds,
            y: { min: 0, max: 100 },
          },
        },
        createBounds(0, 100),
      ),
    ).toEqual(true);
  });

  it("should reset when moving from before dataset", () => {
    expect(
      shouldResetViewport(
        [
          {
            ...initPath(),
            dataset: createDataset(0),
            isPartial: true,
          },
        ],
        createViewport(800, 600, -10, -5),
        createViewport(800, 600, 0, 20),
        undefined,
      ),
    ).toEqual(true);
  });
});

describe("updateDownsample", () => {
  it("resets if no data", () => {
    const before = {
      ...initDownsampled(),
      data: createData(createPath(FAKE_PATH), 5000),
    };
    const after = updateDownsample(FAKE_VIEWPORT, EmptyPlotData, EmptyPlotData, before);
    expect(after).toEqual({
      ...initDownsampled(),
      isValid: true,
    });
  });

  it("resets if too many points", () => {
    const path = createPath(FAKE_PATH);
    const before = {
      ...initDownsampled(),
      data: createData(path, 5000),
    };
    const after = updateDownsample(
      createViewport(800, 600, 0, 2500),
      createData(path, 2500),
      createData(path, 2500),
      before,
    );
    expect(after.data.datasets.get(path)).not.toEqual(before.data.datasets.get(path));
  });

  it("ignores disabled path", () => {
    const exists = createPath(FAKE_PATH);
    const missing = {
      ...createPath(FAKE_PATH),
      enabled: false,
    };
    const data = createDataMany(100, exists, missing);
    const before = initDownsampled();
    const after = updateDownsample(createViewport(800, 600, 0, 2500), data, data, before);
    expect(after.data.datasets.get(missing)).toEqual(undefined);
  });
});
