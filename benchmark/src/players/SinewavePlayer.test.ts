// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BasicBuilder } from "@lichtblick/test-builders";

import { SinewavePlayer } from "./SinewavePlayer";

describe("SinewavePlayer", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should construct without throwing", () => {
    // Given / When / Then
    expect(() => new SinewavePlayer()).not.toThrow();
  });

  it("should inherit getBatchIterator returning undefined from BenchmarkPlayerBase", () => {
    // Given
    const player = new SinewavePlayer();
    const topic = BasicBuilder.string();
    // When
    const result = player.getBatchIterator(topic);
    // Then
    expect(result).toBeUndefined();
  });

  it("should not throw when calling setGlobalVariables", () => {
    // Given
    const player = new SinewavePlayer();
    // When / Then
    expect(() => {
      player.setGlobalVariables({});
    }).not.toThrow();
  });
});
