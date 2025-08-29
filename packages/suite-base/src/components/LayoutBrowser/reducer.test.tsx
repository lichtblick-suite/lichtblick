/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import { useLayoutBrowserReducer } from "./reducer";

// Mock lodash-es functions
jest.mock("lodash-es", () => ({
  ...jest.requireActual("lodash-es"),
  xor: jest.fn((arr1, arr2) =>
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    arr1.filter((x: any) => !arr2.includes(x)).concat(arr2.filter((x: any) => !arr1.includes(x))),
  ),
  compact: jest.fn((arr) => arr.filter(Boolean)),
}));

describe("LayoutBrowser reducer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * GIVEN a state with multiAction set
   * WHEN the clear-multi-action is dispatched
   * THEN the multiAction should be cleared
   */
  it("clear-multi-action clears multiAction", () => {
    // Given
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // Set up multiAction first
    const testId = BasicBuilder.string();
    act(() => {
      result.current[1]({ type: "select-id", id: testId });
      result.current[1]({ type: "queue-multi-action", action: "save" });
    });

    expect(result.current[0].multiAction).toBeDefined();

    // When
    act(() => {
      result.current[1]({ type: "clear-multi-action" });
    });

    // Then
    expect(result.current[0].multiAction).toBeUndefined();
  });

  /**
   * GIVEN a state with selected IDs
   * WHEN the queue-multi-action is dispatched
   * THEN the multiAction should be set with the provided action and selectedIds
   */
  it("queue-multi-action sets multiAction", () => {
    // Given
    const action = "save";
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // First select some IDs
    const testId = BasicBuilder.string();
    act(() => {
      result.current[1]({ type: "select-id", id: testId });
    });

    expect(result.current[0].selectedIds).toEqual([testId]);

    // When
    act(() => {
      result.current[1]({ type: "queue-multi-action", action });
    });

    // Then
    expect(result.current[0].multiAction).toEqual({
      action,
      ids: [testId],
    });
  });

  /**
   * GIVEN a state with some selected IDs
   * WHEN select-id is dispatched with modKey=true
   * THEN the selection should be toggled
   */
  it("select-id with modKey toggles selection", () => {
    // Given
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // First select an ID
    const testId1 = BasicBuilder.string();
    const testId2 = BasicBuilder.string();
    act(() => {
      result.current[1]({ type: "select-id", id: testId1 });
    });

    expect(result.current[0].selectedIds).toEqual([testId1]);

    // When selecting another ID with modKey
    act(() => {
      result.current[1]({ type: "select-id", id: testId2, modKey: true });
    });

    // Then - should have both ids selected
    expect(result.current[0].selectedIds).toEqual([testId1, testId2]);
    expect(result.current[0].lastSelectedId).toBe(testId2);

    // When toggling existing ID with modKey
    act(() => {
      result.current[1]({ type: "select-id", id: testId1, modKey: true });
    });

    // Then - id1 should be removed
    expect(result.current[0].selectedIds).toEqual([testId2]);
  });

  /**
   * GIVEN a state with multiAction
   * WHEN select-id is dispatched with shiftKey=true
   * THEN multiAction should be cleared
   */
  it("select-id with shiftKey clears multiAction", () => {
    // Given
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // Setup multiAction
    const testId1 = BasicBuilder.string();
    const testId2 = BasicBuilder.string();
    act(() => {
      result.current[1]({ type: "select-id", id: testId1 });
      result.current[1]({ type: "queue-multi-action", action: "save" });
    });

    expect(result.current[0].multiAction).toBeDefined();

    // When
    act(() => {
      result.current[1]({ type: "select-id", id: testId2, shiftKey: true });
    });

    // Then
    expect(result.current[0].multiAction).toBeUndefined();
    expect(result.current[0].lastSelectedId).toBe(testId2);
    // Note: selectedIds remains unchanged with shift key in this implementation
    expect(result.current[0].selectedIds).toEqual([testId1]);
  });

  /**
   * GIVEN any state
   * WHEN select-id is dispatched with normal click
   * THEN it should perform single selection
   */
  it("select-id with normal click performs single selection", () => {
    // Given
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // Select multiple IDs first
    const testId1 = BasicBuilder.string();
    const testId2 = BasicBuilder.string();
    const testId3 = BasicBuilder.string();
    act(() => {
      result.current[1]({ type: "select-id", id: testId1 });
      result.current[1]({ type: "select-id", id: testId2, modKey: true });
    });

    expect(result.current[0].selectedIds.length).toBeGreaterThan(1);

    // When - normal click on a new ID
    act(() => {
      result.current[1]({ type: "select-id", id: testId3 });
    });

    // Then
    expect(result.current[0].selectedIds).toEqual([testId3]);
    expect(result.current[0].multiAction).toBeUndefined();
    expect(result.current[0].lastSelectedId).toBe(testId3);
  });

  /**
   * GIVEN any state
   * WHEN set-busy is dispatched
   * THEN busy state should be updated
   */
  it("set-busy updates busy state", () => {
    // Given
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // When
    act(() => {
      result.current[1]({ type: "set-busy", value: true });
    });

    // Then
    expect(result.current[0].busy).toBe(true);
  });

  /**
   * GIVEN any state
   * WHEN set-error is dispatched
   * THEN error state should be updated
   */
  it("set-error updates error state", () => {
    // Given
    const error = new Error("Test error");
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // When
    act(() => {
      result.current[1]({ type: "set-error", value: error });
    });

    // Then
    expect(result.current[0].error).toBe(error);
  });

  /**
   * GIVEN any state
   * WHEN set-online is dispatched
   * THEN online state should be updated
   */
  it("set-online updates online state", () => {
    // Given
    const { result } = renderHook(() =>
      useLayoutBrowserReducer({
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
      }),
    );

    // When
    act(() => {
      result.current[1]({ type: "set-online", value: false });
    });

    // Then
    expect(result.current[0].online).toBe(false);
  });

  /**
   * GIVEN props for the hook
   * WHEN the hook is initialized
   * THEN it should return the initial state with default values
   */
  it("useLayoutBrowserReducer initializes with correct defaults", () => {
    // Given
    const props = {
      busy: true,
      error: new Error("Test"),
      online: false,
      lastSelectedId: BasicBuilder.string(),
    };

    // When
    const { result } = renderHook(() => useLayoutBrowserReducer(props));

    // Then
    expect(result.current[0]).toEqual({
      ...props,
      selectedIds: [],
      multiAction: undefined,
    });
  });
});
