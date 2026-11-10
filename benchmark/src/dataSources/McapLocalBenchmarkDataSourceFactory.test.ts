// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { PlayerMetricsCollectorInterface } from "@lichtblick/suite-base/players/types";

import { McapLocalBenchmarkDataSourceFactory } from "./McapLocalBenchmarkDataSourceFactory";

function setupArgs(file?: File): DataSourceFactoryInitializeArgs {
  return {
    file,
    metricsCollector: jest.fn() as unknown as PlayerMetricsCollectorInterface,
  };
}

describe("McapLocalBenchmarkDataSourceFactory", () => {
  let factory: McapLocalBenchmarkDataSourceFactory;

  beforeEach(() => {
    factory = new McapLocalBenchmarkDataSourceFactory();
  });

  it("should mark itself as the legacy synthetic pipeline", () => {
    // Given / When
    const { pipeline } = factory;

    // Then
    expect(pipeline).toBe("synthetic");
  });

  it("should return undefined when no file is provided", () => {
    // Given
    const args = setupArgs(undefined);

    // When
    const result = factory.initialize(args);

    // Then
    expect(result).toBeUndefined();
  });
});
