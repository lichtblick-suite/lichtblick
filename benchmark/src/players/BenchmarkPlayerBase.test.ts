// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BasicBuilder } from "@lichtblick/test-builders";

import { BenchmarkPlayerBase } from "./BenchmarkPlayerBase";

class TestPlayer extends BenchmarkPlayerBase {
  public run = jest.fn(async (): Promise<void> => {});
}

describe("BenchmarkPlayerBase", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should invoke run() when a listener is registered", async () => {
    // Given
    const player = new TestPlayer();
    // When
    player.setListener(async () => {});
    await Promise.resolve();
    // Then
    expect(player.run).toHaveBeenCalledTimes(1);
  });

  it("should return undefined from getBatchIterator", () => {
    // Given
    const player = new TestPlayer();
    const topic = BasicBuilder.string();
    // When
    const result = player.getBatchIterator(topic);
    // Then
    expect(result).toBeUndefined();
  });

  it("should not throw when calling close, setSubscriptions, setPublishers or setGlobalVariables", () => {
    // Given
    const player = new TestPlayer();
    // When / Then
    expect(() => {
      player.close();
    }).not.toThrow();
    expect(() => {
      player.setSubscriptions([{ topic: "tf" }]);
    }).not.toThrow();
    expect(() => {
      player.setPublishers([]);
    }).not.toThrow();
    expect(() => {
      player.setGlobalVariables({});
    }).not.toThrow();
  });

  it("should throw Method not implemented for setParameter", () => {
    // Given
    const player = new TestPlayer();
    // When / Then
    expect(() => {
      player.setParameter("key", "value");
    }).toThrow("Method not implemented.");
  });

  it("should throw Method not implemented for publish", () => {
    // Given
    const player = new TestPlayer();
    // When / Then
    expect(() => {
      player.publish({ topic: "tf", msg: {} });
    }).toThrow("Method not implemented.");
  });

  it("should reject with Method not implemented for callService", async () => {
    // Given
    const player = new TestPlayer();
    // When / Then
    await expect(player.callService("service", {})).rejects.toThrow("Method not implemented.");
  });
});
