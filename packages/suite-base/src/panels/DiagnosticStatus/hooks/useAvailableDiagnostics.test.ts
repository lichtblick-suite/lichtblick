/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import {
  DiagnosticStatusArrayMsg,
  UseAvailableDiagnosticResult,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { MessageEvent } from "@lichtblick/suite-base/players/types";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import useAvailableDiagnostics, { addMessages } from "./useAvailableDiagnostics";

jest.mock("@lichtblick/suite-base/PanelAPI");

describe("addMessages", () => {
  it("should add a new hardware ID and diagnostic name", () => {
    // Given
    const hardwareId = BasicBuilder.string();
    const diagnosticName = BasicBuilder.string();
    const statusMessage = DiagnosticsBuilder.statusMessage({
      hardware_id: hardwareId,
      name: diagnosticName,
    });

    const previousAvailableDiagnostics: UseAvailableDiagnosticResult = new Map();
    const messages = [
      MessageEventBuilder.messageEvent<DiagnosticStatusArrayMsg>({
        message: DiagnosticsBuilder.statusArrayMsg({
          status: [statusMessage],
        }),
      }),
    ];

    // When
    const result = addMessages(previousAvailableDiagnostics, messages);

    // Then
    expect(result).toEqual(new Map([[hardwareId, new Set([diagnosticName])]]));
  });

  it("should add a new diagnostic name to an existing hardware ID", () => {
    // Given
    const hardwareId = BasicBuilder.string();
    const existingName = BasicBuilder.string();
    const newName = BasicBuilder.string();
    const initialDiagnostics = new Map([[hardwareId, new Set([existingName])]]);
    const statusMessage = DiagnosticsBuilder.statusMessage({
      hardware_id: hardwareId,
      name: newName,
    });
    const messages = [
      MessageEventBuilder.messageEvent<DiagnosticStatusArrayMsg>({
        message: DiagnosticsBuilder.statusArrayMsg({
          status: [statusMessage],
        }),
      }),
    ];

    // When
    const result = addMessages(initialDiagnostics, messages);

    // Then
    expect(result).toEqual(new Map([[hardwareId, new Set([existingName, newName])]]));
  });

  it("should return the same map reference if no modifications are made", () => {
    // Given
    const hardwareId = BasicBuilder.string();
    const diagnosticName = BasicBuilder.string();
    const initialDiagnostics = new Map([[hardwareId, new Set([diagnosticName])]]);
    const messages: MessageEvent[] = [];

    // When
    const result = addMessages(initialDiagnostics, messages);

    // Then
    expect(result).toBe(initialDiagnostics);
  });
});

describe("useAvailableDiagnostics", () => {
  const useMessageReducerMock = PanelAPI.useMessageReducer as jest.Mock;

  beforeEach(() => {
    useMessageReducerMock.mockReset();
  });

  it("should call useMessageReducer with correct params when topic is provided", () => {
    // Given
    const topic = BasicBuilder.string();
    const mockResult = new Map();
    useMessageReducerMock.mockReturnValue(mockResult);

    // When
    const { result } = renderHook(() => useAvailableDiagnostics(topic));

    // Then
    expect(useMessageReducerMock).toHaveBeenCalledWith({
      topics: [topic],
      restore: expect.any(Function),
      addMessages,
    });
    expect(result.current).toBe(mockResult);
  });

  it("should call useMessageReducer with empty topics when no topic is provided", () => {
    // Given
    const mockResult = new Map();
    useMessageReducerMock.mockReturnValue(mockResult);

    // When
    const { result } = renderHook(() => useAvailableDiagnostics());

    // Then
    expect(useMessageReducerMock).toHaveBeenCalledWith({
      topics: [],
      restore: expect.any(Function),
      addMessages,
    });
    expect(result.current).toBe(mockResult);
  });

  it("should return an empty map from restore", () => {
    // Given
    let restoreFn: () => Map<string, Set<string>> = () => new Map();

    useMessageReducerMock.mockImplementation(({ restore }) => {
      restoreFn = restore;
      return restore();
    });

    // When
    const { result } = renderHook(() => useAvailableDiagnostics());

    // Then
    expect(result.current).toEqual(new Map());
    expect(restoreFn()).toEqual(new Map());
  });
});
