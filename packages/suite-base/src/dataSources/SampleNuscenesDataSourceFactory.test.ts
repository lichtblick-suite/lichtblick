// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import SampleNuscenesDataSourceFactory from "@lichtblick/suite-base/dataSources/SampleNuscenesDataSourceFactory";
import {
  SAMPLE_NUSCENES_DATA_SOURCE_DISPLAY_NAME,
  SAMPLE_NUSCENES_DATA_SOURCE_ICON_NAME,
  SAMPLE_NUSCENES_DATA_SOURCE_ID,
  SAMPLE_NUSCENES_DATA_SOURCE_NAME,
  SAMPLE_NUSCENES_DATA_SOURCE_READ_AHEAD_DURATION,
  SAMPLE_NUSCENES_DATA_SOURCE_TYPE,
  SAMPLE_NUSCENES_DATA_SOURCE_URL,
} from "@lichtblick/suite-base/dataSources/constants";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";

jest.mock("@lichtblick/suite-base/players/IterablePlayer", () => ({
  IterablePlayer: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource", () => ({
  WorkerSerializedIterableSource: jest.fn(),
}));

describe("SampleNuscenesDataSourceFactory", () => {
  let factory: SampleNuscenesDataSourceFactory;

  beforeEach(() => {
    factory = new SampleNuscenesDataSourceFactory();
    jest.clearAllMocks();
  });

  function setup() {
    const args: DataSourceFactoryInitializeArgs = {
      metricsCollector: jest.fn(),
    } as unknown as DataSourceFactoryInitializeArgs;

    return { args };
  }

  it("should create a IterablePlayer with the sample nuscenes data source", () => {
    // Given
    const { args } = setup();

    // When
    const player = factory.initialize(args);

    // Then
    expect(WorkerSerializedIterableSource).toHaveBeenCalledWith({
      initWorker: expect.any(Function),
      initArgs: { url: expect.any(String) },
    });

    expect(IterablePlayer).toHaveBeenCalledWith({
      source: expect.any(Object),
      isSampleDataSource: true,
      name: SAMPLE_NUSCENES_DATA_SOURCE_NAME,
      metricsCollector: args.metricsCollector,
      urlParams: {},
      sourceId: SAMPLE_NUSCENES_DATA_SOURCE_ID,
      readAheadDuration: SAMPLE_NUSCENES_DATA_SOURCE_READ_AHEAD_DURATION,
    });
    expect(player).toBeInstanceOf(IterablePlayer);
  });

  it("should use the correct sample nuscenes data source URL", () => {
    // Given
    const { args } = setup();

    // When
    factory.initialize(args);

    // Then
    expect(WorkerSerializedIterableSource).toHaveBeenCalledWith(
      expect.objectContaining({
        initArgs: {
          url: SAMPLE_NUSCENES_DATA_SOURCE_URL,
        },
      }),
    );
  });

  it("should have correct factory properties", () => {
    //Given / When / Then
    expect(factory.id).toBe(SAMPLE_NUSCENES_DATA_SOURCE_ID);
    expect(factory.type).toBe(SAMPLE_NUSCENES_DATA_SOURCE_TYPE);
    expect(factory.displayName).toBe(SAMPLE_NUSCENES_DATA_SOURCE_DISPLAY_NAME);
    expect(factory.iconName).toBe(SAMPLE_NUSCENES_DATA_SOURCE_ICON_NAME);
    expect(factory.hidden).toBe(true);
    expect(factory.sampleLayout).toBeDefined();
  });
});
