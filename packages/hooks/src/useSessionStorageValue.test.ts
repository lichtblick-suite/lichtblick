/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";

import { useSessionStorageValue } from "./useSessionStorageValue";

describe("useSessionStorageValue", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it("should remove value from session storage when setting undefined", () => {
    // Given
    const testKey = "remove-test-key";
    const testValue = "initial-value";
    sessionStorage.setItem(testKey, testValue);
    const storageEventSpy = jest.fn();
    window.addEventListener("storage", storageEventSpy);

    // When
    const { result } = renderHook(() => useSessionStorageValue(testKey));

    act(() => {
      result.current[1](undefined);
    });

    // Then
    expect(sessionStorage.getItem(testKey)).toBeNull();
    expect(result.current[0]).toBeUndefined();
    expect(storageEventSpy).toHaveBeenCalled();

    window.removeEventListener("storage", storageEventSpy);
  });

  it("should return undefined when no value exists in session storage", () => {
    // Given
    const testKey = "existing-key";

    // When
    const { result } = renderHook(() => useSessionStorageValue(testKey));

    // Then
    expect(result.current[0]).toBeUndefined();
  });

  it("should return existing value from session storage", () => {
    // Given
    const testKey = "existing-key";
    const testValue = "existing-value";
    sessionStorage.setItem(testKey, testValue);

    // When
    const { result } = renderHook(() => useSessionStorageValue(testKey));

    // Then
    expect(result.current[0]).toBe(testValue);
  });

  it("should use workspace prefix when DEV_WORKSPACE is set", () => {
    // Given
    const originalEnv = process.env.DEV_WORKSPACE;
    process.env.DEV_WORKSPACE = "dev-workspace";
    const testKey = "prefixed-key";
    const testValue = "prefixed-value";
    const prefixedKey = `dev-workspace.${testKey}`;
    sessionStorage.setItem(prefixedKey, testValue);

    // When
    const { result } = renderHook(() => useSessionStorageValue(testKey));

    // Then
    expect(result.current[0]).toBe(testValue);
    expect(sessionStorage.getItem(testKey)).toBeNull();
    expect(sessionStorage.getItem(prefixedKey)).toBe(testValue);

    // Cleanup
    process.env.DEV_WORKSPACE = originalEnv;
  });

  it("should update hook state to undefined when storage event indicates removal", () => {
    // Given
    const testKey = "removal-test-key";
    const initialValue = "initial-value";
    sessionStorage.setItem(testKey, initialValue);
    const { result } = renderHook(() => useSessionStorageValue(testKey));

    // When
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: testKey,
          newValue: undefined,
          storageArea: sessionStorage,
        }),
      );
    });

    // Then
    expect(result.current[0]).toBeUndefined();
  });

  it("should remove event listener when component unmounts", () => {
    // Given
    const testKey = "unmount-test-key";
    const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useSessionStorageValue(testKey));

    // When
    unmount();

    // Then
    expect(removeEventListenerSpy).toHaveBeenCalledWith("storage", expect.any(Function));
  });

  it("should synchronize state between multiple hook instances with same key", () => {
    // Given
    const testKey = "sync-test-key";
    const testValue = "sync-test-value";
    const { result: result1 } = renderHook(() => useSessionStorageValue(testKey));
    const { result: result2 } = renderHook(() => useSessionStorageValue(testKey));

    // When
    act(() => {
      result1.current[1](testValue);
    });

    // Then
    expect(result1.current[0]).toBe(testValue);
    expect(result2.current[0]).toBe(testValue);
  });
});
