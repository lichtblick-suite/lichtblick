/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";
import { expandVideoSeekBackfill } from "@lichtblick/suite-base/players/IterablePlayer/videoSeekBackfill";
import { PlayerMetricsCollectorInterface } from "@lichtblick/suite-base/players/types";

import RemoteDataSourceFactory from "./RemoteDataSourceFactory";

jest.mock("@lichtblick/suite-base/players/IterablePlayer", () => ({
  IterablePlayer: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource", () => ({
  WorkerSerializedIterableSource: jest.fn(),
}));

function setupArgs(params?: Record<string, string | undefined>): DataSourceFactoryInitializeArgs {
  const mockArgs: DataSourceFactoryInitializeArgs = {
    params,
    metricsCollector: jest.fn() as unknown as PlayerMetricsCollectorInterface,
  };
  return mockArgs;
}

describe("checkExtensionMatch", () => {
  let factory: RemoteDataSourceFactory;

  beforeEach(() => {
    factory = new RemoteDataSourceFactory();
  });

  it("should return the extension if the comparing extension is undefined", () => {
    const result = (factory as any).checkExtensionMatch(".mcap");

    expect(result).toBe(".mcap");
  });

  it("should return the extension when the comparator and comparing extensions are equal", () => {
    const result = (factory as any).checkExtensionMatch(".mcap", ".mcap");

    expect(result).toBe(".mcap");
  });

  it("should throw an error if the comparator and comparing extensions are different", () => {
    expect(() => (factory as any).checkExtensionMatch(".mcap", ".bag")).toThrow(
      "All sources need to be from the same type",
    );
  });
});

describe("RemoteDataSourceFactory", () => {
  let factory: RemoteDataSourceFactory;

  const mockSource = { mock: "workerSource" };
  (WorkerSerializedIterableSource as jest.Mock).mockImplementation(() => mockSource);

  const mockPlayer = { mock: "playerInstance" };
  (IterablePlayer as jest.Mock).mockImplementation(() => mockPlayer);

  beforeEach(() => {
    jest.clearAllMocks();
    factory = new RemoteDataSourceFactory();
  });
  it("should initialize and return a player with a single remote .mcap file", () => {
    const mockArgs = setupArgs({
      url: "https://example.com/test.mcap",
    });

    const result = factory.initialize(mockArgs);

    expect(WorkerSerializedIterableSource).toHaveBeenCalledWith({
      initWorker: expect.any(Function),
      initArgs: { url: "https://example.com/test.mcap" },
    });

    expect(IterablePlayer).toHaveBeenCalledWith({
      source: mockSource,
      name: "https://example.com/test.mcap",
      metricsCollector: mockArgs.metricsCollector,
      urlParams: { urls: ["https://example.com/test.mcap"] },
      sourceId: "remote-file",
      readAheadDuration: { sec: 10, nsec: 0 },
      expandBackfill: expandVideoSeekBackfill,
    });

    expect(result).toBe(mockPlayer);
  });

  it("should initialize and return a player with a single remote .bag file", () => {
    const mockArgs = setupArgs({
      url: "https://example.com/test.bag",
    });

    const result = factory.initialize(mockArgs);

    expect(WorkerSerializedIterableSource).toHaveBeenCalledWith({
      initWorker: expect.any(Function),
      initArgs: { url: "https://example.com/test.bag" },
    });

    expect(IterablePlayer).toHaveBeenCalledWith({
      source: mockSource,
      name: "https://example.com/test.bag",
      metricsCollector: mockArgs.metricsCollector,
      urlParams: { urls: ["https://example.com/test.bag"] },
      sourceId: "remote-file",
      readAheadDuration: { sec: 10, nsec: 0 },
      expandBackfill: expandVideoSeekBackfill,
    });

    expect(result).toBe(mockPlayer);
  });

  it("should initialize and return a player with multiple files", () => {
    const mockArgs = setupArgs({
      url: "https://example.com/test1.mcap,https://example.com/test2.mcap",
    });

    const result = factory.initialize(mockArgs);

    expect(IterablePlayer).toHaveBeenCalledWith({
      source: mockSource,
      name: mockArgs.params?.url,
      metricsCollector: mockArgs.metricsCollector,
      urlParams: { urls: ["https://example.com/test1.mcap", "https://example.com/test2.mcap"] },
      sourceId: "remote-file",
      readAheadDuration: { sec: 10, nsec: 0 },
      expandBackfill: expandVideoSeekBackfill,
    });

    expect(result).toBe(mockPlayer);
  });

  it("should pass configured hydration overrides into multi-url initArgs", () => {
    factory = new RemoteDataSourceFactory({
      maxHydratedSources: 4,
      maxHydratedBytes: 5678,
      initConcurrency: 3,
    });
    const mockArgs = setupArgs({
      url: "https://example.com/test1.mcap,https://example.com/test2.mcap",
    });

    factory.initialize(mockArgs);

    expect(WorkerSerializedIterableSource).toHaveBeenCalledWith({
      initWorker: expect.any(Function),
      initArgs: {
        urls: ["https://example.com/test1.mcap", "https://example.com/test2.mcap"],
        maxHydratedSources: 4,
        maxHydratedBytes: 5678,
        initConcurrency: 3,
      },
    });
  });

  it("should return undefined if args.params.url is undefined", () => {
    const mockArgs = setupArgs();

    const result = factory.initialize(mockArgs);

    expect(result).toBeUndefined();
  });

  it("should throw an error if the multiple sources don't have the same file extension", () => {
    const mockArgs = setupArgs({
      url: "https://example.com/test.mcap,https://example.com/test.bag",
    });

    expect(() => factory.initialize(mockArgs)).toThrow("All sources need to be from the same type");
  });
});
