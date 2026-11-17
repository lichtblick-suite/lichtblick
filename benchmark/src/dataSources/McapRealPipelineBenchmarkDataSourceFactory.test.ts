// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";
import { PlayerMetricsCollectorInterface } from "@lichtblick/suite-base/players/types";

import { McapRealPipelineBenchmarkDataSourceFactory } from "./McapRealPipelineBenchmarkDataSourceFactory";

jest.mock("@lichtblick/suite-base/players/IterablePlayer", () => ({
  IterablePlayer: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource", () => ({
  WorkerSerializedIterableSource: jest.fn(),
}));

function setupArgs(params?: Record<string, string | undefined>): DataSourceFactoryInitializeArgs {
  return {
    params,
    metricsCollector: jest.fn() as unknown as PlayerMetricsCollectorInterface,
  };
}

describe("McapRealPipelineBenchmarkDataSourceFactory", () => {
  let factory: McapRealPipelineBenchmarkDataSourceFactory;

  const mockWorkerSource = { mock: "workerSource" };
  const mockPlayer = { mock: "playerInstance" };

  beforeEach(() => {
    jest.clearAllMocks();
    (WorkerSerializedIterableSource as jest.Mock).mockImplementation(() => mockWorkerSource);
    (IterablePlayer as jest.Mock).mockImplementation(() => mockPlayer);
    factory = new McapRealPipelineBenchmarkDataSourceFactory();
  });

  it("should mark itself as the real pipeline", () => {
    // Given / When
    const { pipeline } = factory;

    // Then
    expect(pipeline).toBe("real");
  });

  it("should return undefined when no url is provided", () => {
    // Given
    const args = setupArgs(undefined);

    // When
    const result = factory.initialize(args);

    // Then
    expect(result).toBeUndefined();
    expect(IterablePlayer).not.toHaveBeenCalled();
  });

  it("should build a real IterablePlayer over the MCAP worker source for a url", () => {
    // Given
    const args = setupArgs({ url: "https://example.com/test.mcap" });

    // When
    const result = factory.initialize(args);

    // Then
    expect(WorkerSerializedIterableSource).toHaveBeenCalledWith({
      initWorker: expect.any(Function),
      initArgs: { url: "https://example.com/test.mcap" },
    });
    expect(IterablePlayer).toHaveBeenCalledWith({
      source: mockWorkerSource,
      name: "https://example.com/test.mcap",
      sourceId: "mcap-real-pipeline",
      metricsCollector: args.metricsCollector,
      urlParams: { url: "https://example.com/test.mcap" },
    });
    expect(result).toBe(mockPlayer);
  });
});
