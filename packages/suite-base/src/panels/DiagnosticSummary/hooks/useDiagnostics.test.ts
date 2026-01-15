/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { renderHook } from "@testing-library/react";

import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import { DiagnosticStatusArrayMsg } from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { LEVELS } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import useDiagnostics, { addMessages, UseDiagnosticsResult } from "./useDiagnostics";
import { computeDiagnosticInfo } from "../utils/util";

jest.mock("../utils/util", () => ({
  ...jest.requireActual("../utils/util"),
  computeDiagnosticInfo: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/PanelAPI");

describe("addMessages", () => {
  const computeDiagnosticInfoMock = computeDiagnosticInfo as jest.Mock;

  beforeEach(() => {
    computeDiagnosticInfoMock.mockReset();
  });

  it("should add a message at the right level", () => {
    const level = BasicBuilder.sample(LEVELS);
    const hardwareId = BasicBuilder.string();
    const statusMessage = DiagnosticsBuilder.statusMessage({
      hardware_id: hardwareId,
      level,
    });
    const message = MessageEventBuilder.messageEvent<DiagnosticStatusArrayMsg>({
      message: DiagnosticsBuilder.statusArrayMsg({
        status: [statusMessage],
      }),
    });
    const info = DiagnosticsBuilder.info({
      status: statusMessage,
    });
    computeDiagnosticInfoMock.mockReturnValue(info);

    const result = addMessages(new Map(), [message]);

    expect(result).toEqual(new Map([[hardwareId, new Map([[info.status.name, info]])]]));
  });

  it("should move a message from one level to another", () => {
    const hardwareId = BasicBuilder.string();
    // OK LEVEL
    const okLevel = LEVELS.OK;
    const statusMessage1 = DiagnosticsBuilder.statusMessage({
      hardware_id: hardwareId,
      level: okLevel,
    });
    const messageEvent1 = MessageEventBuilder.messageEvent<DiagnosticStatusArrayMsg>({
      message: DiagnosticsBuilder.statusArrayMsg({
        status: [statusMessage1],
      }),
    });
    // ERROR LEVEL
    const errorLevel = LEVELS.ERROR;
    const statusMessage2 = DiagnosticsBuilder.statusMessage({
      ...statusMessage1,
      level: errorLevel,
    });
    const messageEvent2 = MessageEventBuilder.messageEvent<DiagnosticStatusArrayMsg>({
      message: DiagnosticsBuilder.statusArrayMsg({
        status: [statusMessage2],
      }),
    });

    const info1 = DiagnosticsBuilder.info({
      status: statusMessage1,
    });
    const info2 = DiagnosticsBuilder.info({
      status: statusMessage2,
    });
    computeDiagnosticInfoMock.mockReturnValueOnce(info1).mockReturnValueOnce(info2);

    const result = addMessages(new Map(), [messageEvent1, messageEvent2]);

    expect(result).toEqual(new Map([[hardwareId, new Map([[info2.status.name, info2]])]]));
  });

  it("should return the same map reference if nothing was modified", () => {
    const hardwareId = BasicBuilder.string();
    const statusName = BasicBuilder.string();
    const diagnosticsResult: UseDiagnosticsResult = new Map([
      [hardwareId, new Map([[statusName, DiagnosticsBuilder.info()]])],
    ]);

    const result = addMessages(diagnosticsResult, []);

    expect(result).toBe(diagnosticsResult);
  });
});

describe("useDiagnostics", () => {
  const useMessageReducerMock = PanelAPI.useMessageReducer as jest.Mock;

  beforeEach(() => {
    useMessageReducerMock.mockReset();
  });

  it("should call useMessageReducer with correct params when topic is provided", () => {
    const topic = BasicBuilder.string();
    const mockResult = new Map();
    useMessageReducerMock.mockReturnValue(mockResult);

    const { result } = renderHook(() => useDiagnostics(topic));

    expect(useMessageReducerMock).toHaveBeenCalledWith({
      topics: [topic],
      restore: expect.any(Function),
      addMessages,
    });
    expect(result.current).toBe(mockResult);
  });

  it("should call useMessageReducer with empty topics when no topic is provided", () => {
    const mockResult = new Map();
    useMessageReducerMock.mockReturnValue(mockResult);

    const { result } = renderHook(() => useDiagnostics());

    expect(useMessageReducerMock).toHaveBeenCalledWith({
      topics: [],
      restore: expect.any(Function),
      addMessages,
    });
    expect(result.current).toBe(mockResult);
  });

  it("should return empty map from restore", () => {
    let restoreFn: () => Map<string, Map<string, unknown>> = () => new Map();

    useMessageReducerMock.mockImplementation(({ restore }) => {
      restoreFn = restore;
      return restore();
    });

    const { result } = renderHook(() => useDiagnostics());

    expect(result.current).toEqual(new Map());
    expect(restoreFn()).toEqual(new Map());
  });
});
