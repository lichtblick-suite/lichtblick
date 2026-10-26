/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import useAppendOnlyKey from "./useAppendOnlyKey";

describe("useAppendOnlyKey", () => {
  const setup = (segments: string[]) =>
    renderHook(({ segments: props }) => useAppendOnlyKey(props), {
      initialProps: { segments },
    });

  it("should join the initial segments with a revision suffix", () => {
    // Given / When
    const { result } = setup(["a", "b"]);

    // Then
    expect(result.current).toEqual("a|b|1");
  });

  it("should not change when a new segment is appended", () => {
    // Given
    const { result, rerender } = setup(["a", "b"]);
    const initialKey = result.current;

    // When
    rerender({ segments: ["a", "b", "c"] });

    // Then
    expect(result.current).toEqual(initialKey);
  });

  it("should change when an existing segment is edited", () => {
    // Given
    const { result, rerender } = setup(["a", "b"]);

    // When
    rerender({ segments: ["a", "z"] });

    // Then
    expect(result.current).toEqual("a|z|2");
  });

  it("should change when a segment is removed", () => {
    // Given
    const { result, rerender } = setup(["a", "b", "c"]);

    // When
    rerender({ segments: ["a", "b"] });

    // Then
    expect(result.current).toEqual("a|b|2");
  });

  it("should change when segments are reordered", () => {
    // Given
    const { result, rerender } = setup(["a", "b"]);

    // When
    rerender({ segments: ["b", "a"] });

    // Then
    expect(result.current).toEqual("b|a|2");
  });

  it("should keep the stable key fixed across multiple consecutive appends", () => {
    // Given
    const { result, rerender } = setup(["a"]);

    // When
    rerender({ segments: ["a", "b"] });
    rerender({ segments: ["a", "b", "c"] });

    // Then
    expect(result.current).toEqual("a|1");
  });

  it("should treat restoration of a previously appended segment as a non-append update", () => {
    // Given
    const { result, rerender } = setup(["a"]);

    // When
    rerender({ segments: ["a", "b"] });
    const appendedKey = result.current;
    rerender({ segments: ["a"] });

    // Then
    expect(appendedKey).toEqual("a|1");
    expect(result.current).toEqual("a|2");
  });

  it("should not change when a newly appended segment is modified", () => {
    // Given (e.g. user clicks + Add Series which starts empty, then types the topic name)
    const { result, rerender } = setup(["a"]);

    // When
    rerender({ segments: ["a", ""] });
    rerender({ segments: ["a", "b"] });
    rerender({ segments: ["a", "c"] });

    // Then
    expect(result.current).toEqual("a|1");
  });

  it("should detect removal of a segment that was only ever appended", () => {
    // Given
    const { result, rerender } = setup(["a"]);
    rerender({ segments: ["a", "b"] });
    rerender({ segments: ["a", "b", "c"] });

    // When
    rerender({ segments: ["a", "c"] });

    // Then
    expect(result.current).toEqual("a|c|2");
  });
});
