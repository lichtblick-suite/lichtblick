/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";

import Logger from "@lichtblick/log";

import { default as useValueChangedDebugLog } from "./useValueChangedDebugLog";

describe("useValueChangeDebugLog", () => {
  it("should log an error when value changes", () => {
    const debugMock = jest.fn();
    Logger.channels().forEach((channel) => {
      if (channel.name().endsWith("useValueChangedDebugLog.ts")) {
        channel.debug = debugMock;
      }
    });

    const { rerender } = renderHook(
      (val) => {
        useValueChangedDebugLog(val, "msg");
      },
      {
        initialProps: 1,
      },
    );
    rerender(2);

    expect(debugMock).toHaveBeenCalled();
  });
});
