// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { DeserializingIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/DeserializingIterableSource";
import { McapIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIterableSource";
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

  beforeEach(() => {
    jest.clearAllMocks();
    (McapIterableSource as jest.Mock).mockImplementation(() => mockMcapSource);
    (DeserializingIterableSource as jest.Mock).mockImplementation(() => mockDeserializingSource);
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
});
