// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

describe("TransformPlayer", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should construct without throwing when basicDatatypes resolves foxglove.FrameTransform", async () => {
    // Given
    const { TransformPlayer } = await import("./TransformPlayer");
    // When / Then
    expect(() => new TransformPlayer()).not.toThrow();
  });

  it("should throw when basicDatatypes is missing foxglove.FrameTransform", async () => {
    // Given
    jest.resetModules();
    jest.doMock("@lichtblick/suite-base/util/basicDatatypes", () => ({
      basicDatatypes: new Map(),
    }));

    try {
      const { TransformPlayer } = await import("./TransformPlayer");
      // When / Then
      expect(() => new TransformPlayer()).toThrow(
        "Invariant: basicDatatypes is missing 'foxglove.FrameTransform'",
      );
    } finally {
      jest.dontMock("@lichtblick/suite-base/util/basicDatatypes");
    }
  });

  it("should not throw when calling setGlobalVariables", async () => {
    // Given
    const { TransformPlayer } = await import("./TransformPlayer");
    const player = new TransformPlayer();
    // When / Then
    expect(() => {
      player.setGlobalVariables({});
    }).not.toThrow();
  });
});
