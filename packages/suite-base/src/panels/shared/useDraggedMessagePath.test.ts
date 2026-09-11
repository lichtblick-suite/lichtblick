/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { Topic } from "@lichtblick/suite-base/players/types";

import { useDraggedMessagePath } from "./useDraggedMessagePath";

jest.mock("@lichtblick/suite-base/components/MessagePipeline");

const mockUseMessagePipeline = useMessagePipeline as jest.Mock;

describe("useDraggedMessagePath", () => {
  const topics: Topic[] = [{ name: "/foo", schemaName: "pkg/Foo" }];

  beforeEach(() => {
    mockUseMessagePipeline.mockImplementation(
      (selector: (ctx: MessagePipelineContext) => unknown) =>
        selector({ sortedTopics: topics } as unknown as MessagePipelineContext),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a leaf DraggedMessagePath for a valid path with a known topic", () => {
    const { result } = renderHook(() => useDraggedMessagePath("/foo.bar"));
    expect(result.current).toEqual({
      path: "/foo.bar",
      rootSchemaName: "pkg/Foo",
      isTopic: false,
      isLeaf: true,
      topicName: "/foo",
    });
  });

  it("resolves the topic even for paths with a slice and filter", () => {
    const { result } = renderHook(() => useDraggedMessagePath("/foo.bar[0]{id==1}.baz"));
    expect(result.current?.topicName).toBe("/foo");
    expect(result.current?.rootSchemaName).toBe("pkg/Foo");
  });

  it("leaves rootSchemaName undefined for an unknown topic", () => {
    const { result } = renderHook(() => useDraggedMessagePath("/unknown.bar"));
    expect(result.current).toEqual({
      path: "/unknown.bar",
      rootSchemaName: undefined,
      isTopic: false,
      isLeaf: true,
      topicName: "/unknown",
    });
  });

  it("returns undefined for an empty value", () => {
    const { result } = renderHook(() => useDraggedMessagePath(""));
    expect(result.current).toBeUndefined();
  });

  it("returns undefined for an undefined value", () => {
    const { result } = renderHook(() => useDraggedMessagePath(undefined));
    expect(result.current).toBeUndefined();
  });

  it("returns undefined for an unparseable value", () => {
    const { result } = renderHook(() => useDraggedMessagePath("{{{not a path"));
    expect(result.current).toBeUndefined();
  });
});
