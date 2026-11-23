// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { DeserializingIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/DeserializingIterableSource";
import { McapIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIterableSource";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";
import { PlayerMetricsCollectorInterface } from "@lichtblick/suite-base/players/types";

import { McapRealPipelineBenchmarkDataSourceFactory } from "./McapRealPipelineBenchmarkDataSourceFactory";

jest.mock("@lichtblick/suite-base/players/IterablePlayer", () => ({
  IterablePlayer: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/players/IterablePlayer/DeserializingIterableSource", () => ({
  DeserializingIterableSource: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIterableSource", () => ({
  McapIterableSource: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource", () => ({
  WorkerSerializedIterableSource: jest.fn(),
}));

const URL_A = "https://example.com/a.mcap";
const URL_B = "https://example.com/b.mcap";

function setupArgs(params?: Record<string, string | undefined>): DataSourceFactoryInitializeArgs {
  return {
    params,
    metricsCollector: jest.fn() as unknown as PlayerMetricsCollectorInterface,
  };
}

describe("McapRealPipelineBenchmarkDataSourceFactory", () => {
  let factory: McapRealPipelineBenchmarkDataSourceFactory;

  const mockMcapSource = { mock: "mcapSource" };
  const mockDeserializingSource = { mock: "deserializingSource" };
  const mockPlayer = { mock: "playerInstance" };
  const mockWorkerSource = { mock: "workerSource" };

  beforeEach(() => {
    jest.clearAllMocks();
    (McapIterableSource as jest.Mock).mockImplementation(() => mockMcapSource);
    (DeserializingIterableSource as jest.Mock).mockImplementation(() => mockDeserializingSource);
    (IterablePlayer as jest.Mock).mockImplementation(() => mockPlayer);
    (WorkerSerializedIterableSource as jest.Mock).mockImplementation(() => mockWorkerSource);
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

  it("should build a real IterablePlayer over McapIterableSource/DeserializingIterableSource for a url", () => {
    // Given
    const args = setupArgs({ url: "https://example.com/test.mcap" });

    // When
    const result = factory.initialize(args);

    // Then
    expect(McapIterableSource).toHaveBeenCalledWith({
      type: "url",
      url: "https://example.com/test.mcap",
    });
    expect(DeserializingIterableSource).toHaveBeenCalledWith(mockMcapSource);
    expect(IterablePlayer).toHaveBeenCalledWith({
      source: mockDeserializingSource,
      name: "https://example.com/test.mcap",
      sourceId: "mcap-real-pipeline",
      metricsCollector: args.metricsCollector,
      urlParams: { url: "https://example.com/test.mcap" },
    });
    expect(result).toBe(mockPlayer);
  });
  it("should return undefined when the url param only contains blanks", () => {
    // Given
    const args = setupArgs({ url: " , " });

    // When
    const result = factory.initialize(args);

    // Then
    expect(result).toBeUndefined();
    expect(IterablePlayer).not.toHaveBeenCalled();
  });

  it("should keep the direct single-source path when the url list has one entry", () => {
    // Given
    const args = setupArgs({ url: ` ${URL_A} ,`, maxHydratedSources: "1" });

    // When
    factory.initialize(args);

    // Then
    expect(McapIterableSource).toHaveBeenCalledWith({ type: "url", url: URL_A });
    expect(WorkerSerializedIterableSource).not.toHaveBeenCalled();
  });

  describe("with several comma-separated urls", () => {
    function workerSourceArgs(): { initWorker: () => Worker; initArgs: Record<string, unknown> } {
      return (WorkerSerializedIterableSource as jest.Mock).mock.calls[0]![0] as {
        initWorker: () => Worker;
        initArgs: Record<string, unknown>;
      };
    }

    it("should build an IterablePlayer over a WorkerSerializedIterableSource without deserializing on the main thread", () => {
      // Given
      const args = setupArgs({ url: `${URL_A},${URL_B}` });

      // When
      const result = factory.initialize(args);

      // Then
      expect(McapIterableSource).not.toHaveBeenCalled();
      expect(DeserializingIterableSource).not.toHaveBeenCalled();
      expect(WorkerSerializedIterableSource).toHaveBeenCalledWith({
        initWorker: expect.any(Function),
        initArgs: { urls: [URL_A, URL_B] },
      });
      expect(IterablePlayer).toHaveBeenCalledWith({
        source: mockWorkerSource,
        name: `${URL_A},${URL_B}`,
        sourceId: "mcap-real-pipeline",
        metricsCollector: args.metricsCollector,
        urlParams: { urls: [URL_A, URL_B] },
      });
      expect(result).toBe(mockPlayer);
    });

    it("should pass valid hydration overrides parsed from string params", () => {
      // Given
      const args = setupArgs({
        url: `${URL_A},${URL_B}`,
        maxHydratedSources: "1",
        maxHydratedBytes: "1048576",
      });

      // When
      factory.initialize(args);

      // Then
      expect(workerSourceArgs().initArgs).toEqual({
        urls: [URL_A, URL_B],
        maxHydratedSources: 1,
        maxHydratedBytes: 1_048_576,
      });
    });

    it.each([
      "",
      "abc",
      "0",
      "-2",
      "1.5",
      "Infinity",
    ])("should ignore the invalid hydration override value %p", (invalid) => {
      // Given
      const args = setupArgs({
        url: `${URL_A},${URL_B}`,
        maxHydratedSources: invalid,
        maxHydratedBytes: invalid,
      });

      // When
      factory.initialize(args);

      // Then
      expect(workerSourceArgs().initArgs).toEqual({ urls: [URL_A, URL_B] });
    });

    it("should launch the MCAP iterable source worker when the source initializes its worker", () => {
      // Given
      const workerCtor = jest.fn();
      const originalWorker = (globalThis as { Worker?: unknown }).Worker;
      (globalThis as { Worker?: unknown }).Worker = workerCtor;
      factory.initialize(setupArgs({ url: `${URL_A},${URL_B}` }));

      try {
        // When
        workerSourceArgs().initWorker();

        // Then
        expect(workerCtor).toHaveBeenCalledTimes(1);
        const workerUrl = workerCtor.mock.calls[0]![0] as URL;
        expect(String(workerUrl)).toContain("McapIterableSourceWorker.worker");
      } finally {
        (globalThis as { Worker?: unknown }).Worker = originalWorker;
      }
    });
  });
});
