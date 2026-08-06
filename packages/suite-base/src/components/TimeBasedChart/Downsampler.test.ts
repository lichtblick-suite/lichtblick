// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Downsampler } from "./Downsampler";
import { ChartDatasets, PlotViewport } from "./types";

describe("Downsampler", () => {
  it("should keep a NaN gap marker when downsampling state transition data", () => {
    // Given
    const dataset: ChartDatasets = [
      {
        label: "cars",
        data: [
          { x: 0, y: 0, label: "cars (3)", value: 3 },
          { x: 10, y: Number.NaN, value: Number.NaN },
          { x: 20, y: 0, label: "cars (4)", value: 4 },
        ],
      },
    ];
    const viewport: PlotViewport = {
      width: 100,
      height: 40,
      bounds: {
        x: { min: 0, max: 20 },
        y: { min: -1, max: 1 },
      },
    };

    const downsampler = new Downsampler();
    downsampler.update({
      datasets: dataset,
      datasetBounds: viewport,
      scales: {
        x: { min: 0, max: 20, pixelMin: 0, pixelMax: 100 },
        y: { min: -1, max: 1, pixelMin: 0, pixelMax: 40 },
      },
    });

    // When
    const result = downsampler.downsample();

    // Then
    const points = result?.[0]?.data ?? [];
    const hasNaNGap = points.some((point) => point != undefined && Number.isNaN(point.y));
    const values = points
      .map((point) => (point == undefined ? undefined : point.value))
      .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

    expect(hasNaNGap).toBe(true);
    expect(values).toEqual(expect.arrayContaining([3, 4]));
  });

  it("should keep the gap ordered between the surrounding states after downsampling", () => {
    // Given
    const dataset: ChartDatasets = [
      {
        label: "cars",
        data: [
          { x: 0, y: 0, label: "cars (3)", value: 3 },
          { x: 10, y: Number.NaN, value: Number.NaN },
          { x: 20, y: 0, label: "cars (4)", value: 4 },
        ],
      },
    ];
    const viewport: PlotViewport = {
      width: 100,
      height: 40,
      bounds: {
        x: { min: 0, max: 20 },
        y: { min: -1, max: 1 },
      },
    };

    const downsampler = new Downsampler();
    downsampler.update({
      datasets: dataset,
      datasetBounds: viewport,
      scales: {
        x: { min: 0, max: 20, pixelMin: 0, pixelMax: 100 },
        y: { min: -1, max: 1, pixelMin: 0, pixelMax: 40 },
      },
    });

    // When
    const result = downsampler.downsample();

    // Then
    // The gap (NaN) must sit *between* the two valid states, otherwise the line
    // reconnects across the gap and no break is rendered.
    const points = result?.[0]?.data ?? [];
    const gapIndex = points.findIndex((point) => point != undefined && Number.isNaN(point.y));
    const firstValueIndex = points.findIndex((point) => point?.value === 3);
    const secondValueIndex = points.findIndex((point) => point?.value === 4);

    expect(firstValueIndex).toBeGreaterThanOrEqual(0);
    expect(gapIndex).toBeGreaterThan(firstValueIndex);
    expect(secondValueIndex).toBeGreaterThan(gapIndex);
  });
});
