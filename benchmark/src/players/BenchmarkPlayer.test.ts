// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IDeserializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

import { BenchmarkPlayer } from "./BenchmarkPlayer";

// run() is never triggered in these tests (setListener is not called), so the source is unused.
const fakeSource = {} as IDeserializedIterableSource;

describe("BenchmarkPlayer", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should not throw when overriding setSubscriptions", () => {
    // Given
    const player = new BenchmarkPlayer("benchmark", fakeSource);
    // When / Then
    expect(() => {
      player.setSubscriptions([{ topic: "tf" }]);
    }).not.toThrow();
  });

  it("should inherit getBatchIterator returning undefined from BenchmarkPlayerBase", () => {
    // Given
    const player = new BenchmarkPlayer("benchmark", fakeSource);
    // When
    const result = player.getBatchIterator("tf");
    // Then
    expect(result).toBeUndefined();
  });

  it("should inherit throwing Method not implemented for setParameter from BenchmarkPlayerBase", () => {
    // Given
    const player = new BenchmarkPlayer("benchmark", fakeSource);
    // When / Then
    expect(() => {
      player.setParameter("key", "value");
    }).toThrow("Method not implemented.");
  });

  it("should not throw when calling setGlobalVariables", () => {
    // Given
    const player = new BenchmarkPlayer("benchmark", fakeSource);
    // When / Then
    expect(() => {
      player.setGlobalVariables({});
    }).not.toThrow();
  });
});
