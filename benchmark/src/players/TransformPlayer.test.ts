// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as basicDatatypes from "@lichtblick/suite-base/util/basicDatatypes";

import { TransformPlayer } from "./TransformPlayer";

describe("TransformPlayer", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should throw when basicDatatypes is missing foxglove.FrameTransform", () => {
    // Given
    jest.replaceProperty(basicDatatypes, "basicDatatypes", new Map());

    // When / Then
    expect(() => new TransformPlayer()).toThrow(
      "Invariant: basicDatatypes is missing 'foxglove.FrameTransform'",
    );
  });

  it("should not throw when calling setGlobalVariables", async () => {
    // Given
    const player = new TransformPlayer();
    // When / Then
    expect(() => {
      player.setGlobalVariables({});
    }).not.toThrow();
  });
});
