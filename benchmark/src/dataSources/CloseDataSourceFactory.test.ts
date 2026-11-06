// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CloseDataSourceFactory } from "./CloseDataSourceFactory";
import { CLOSE_DATA_SOURCE_FACTORY_ID } from "./constants";

describe("CloseDataSourceFactory", () => {
  it("should be a hidden connection factory with the close id", () => {
    // Given / When
    const factory = new CloseDataSourceFactory();

    // Then
    expect(factory.id).toBe(CLOSE_DATA_SOURCE_FACTORY_ID);
    expect(factory.type).toBe("connection");
    expect(factory.hidden).toBe(true);
  });

  it("should never create a player", () => {
    // Given
    const factory = new CloseDataSourceFactory();

    // When
    const player = factory.initialize({
      metricsCollector: {} as never,
      params: { url: "http://example.com/a.mcap" },
    });

    // Then
    expect(player).toBeUndefined();
  });
});
