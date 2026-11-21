/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { Topic } from "@lichtblick/suite-base/players/types";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

import { useDraggedMessagePath } from "./useDraggedMessagePath";

jest.mock("@lichtblick/suite-base/components/MessagePipeline");

const mockUseMessagePipeline = useMessagePipeline as jest.Mock;

describe("useDraggedMessagePath", () => {
  const topics: Topic[] = [PlayerBuilder.topic({ name: "/foo", schemaName: "pkg/Foo" })];

  // Schema where `bar` is a primitive (a plottable leaf) and `header` is a complex sub-message.
  const datatypes: RosDatatypes = new Map([
    [
      "pkg/Foo",
      {
        definitions: [
          { name: "bar", type: "float64", isArray: false, isComplex: false },
          { name: "header", type: "pkg/Header", isArray: false, isComplex: true },
        ],
      },
    ],
    [
      "pkg/Header",
      { definitions: [{ name: "seq", type: "uint32", isArray: false, isComplex: false }] },
    ],
  ]);

  beforeEach(() => {
    mockUseMessagePipeline.mockImplementation(
      (selector: (ctx: MessagePipelineContext) => unknown) =>
        selector({ sortedTopics: topics, datatypes } as unknown as MessagePipelineContext),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a leaf DraggedMessagePath for a valid path with a known topic", () => {
    // Given a field path on a known topic
    const value = "/foo.bar";

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then it is a leaf with the resolved schema
    expect(result.current).toEqual({
      path: "/foo.bar",
      rootSchemaName: "pkg/Foo",
      isTopic: false,
      isLeaf: true,
      topicName: "/foo",
    });
  });

  it("resolves the topic even for paths with a slice and filter", () => {
    // Given a path with a slice and a filter
    const value = "/foo.bar[0]{id==1}.baz";

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then the topic and schema are still resolved
    expect(result.current?.topicName).toBe("/foo");
    expect(result.current?.rootSchemaName).toBe("pkg/Foo");
  });

  it("leaves rootSchemaName undefined for an unknown topic", () => {
    // Given a field path on a topic that is not in the pipeline
    const value = "/unknown.bar";

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then the schema is undefined but the path is still classified as a leaf
    expect(result.current).toEqual({
      path: "/unknown.bar",
      rootSchemaName: undefined,
      isTopic: false,
      isLeaf: true,
      topicName: "/unknown",
    });
  });

  it("classifies a non-primitive sub-message field as a non-leaf", () => {
    // Given a path selecting a complex sub-message field (not a plottable primitive)
    const value = "/foo.header";

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then it is not classified as a leaf (schema says `header` is a complex message)
    expect(result.current).toEqual({
      path: "/foo.header",
      rootSchemaName: "pkg/Foo",
      isTopic: false,
      isLeaf: false,
      topicName: "/foo",
    });
  });

  it("classifies a bare topic path as a non-leaf topic", () => {
    // Given a bare topic path with no field selector
    const value = "/foo";

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then it is classified as a topic and not a leaf
    expect(result.current).toEqual({
      path: "/foo",
      rootSchemaName: "pkg/Foo",
      isTopic: true,
      isLeaf: false,
      topicName: "/foo",
    });
  });

  it("returns undefined for an empty value", () => {
    // Given an empty path value
    const value = "";

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then nothing is returned (not draggable)
    expect(result.current).toBeUndefined();
  });

  it("returns undefined for an undefined value", () => {
    // Given no path value
    const value = undefined;

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then nothing is returned (not draggable)
    expect(result.current).toBeUndefined();
  });

  it("returns undefined for an unparseable value", () => {
    // Given a value that cannot be parsed as a message path
    const value = "{{{not a path";

    // When building the dragged message path
    const { result } = renderHook(() => useDraggedMessagePath(value));

    // Then nothing is returned (not draggable)
    expect(result.current).toBeUndefined();
  });

  it("falls back to the field-selector heuristic when datatype resolution throws", () => {
    // Given a schema that references an unresolvable datatype (makes messagePathStructures throw)
    const brokenDatatypes: RosDatatypes = new Map([
      [
        "pkg/Broken",
        { definitions: [{ name: "child", type: "pkg/Missing", isArray: false, isComplex: true }] },
      ],
    ]);
    const brokenTopics: Topic[] = [
      PlayerBuilder.topic({ name: "/broken", schemaName: "pkg/Broken" }),
    ];
    mockUseMessagePipeline.mockImplementation(
      (selector: (ctx: MessagePipelineContext) => unknown) =>
        selector({
          sortedTopics: brokenTopics,
          datatypes: brokenDatatypes,
        } as unknown as MessagePipelineContext),
    );

    // When building the dragged message path for a field on that schema
    const { result } = renderHook(() => useDraggedMessagePath("/broken.child"));

    // Then it does not throw and falls back to the field-selector heuristic (isLeaf = true)
    expect(result.current).toEqual({
      path: "/broken.child",
      rootSchemaName: "pkg/Broken",
      isTopic: false,
      isLeaf: true,
      topicName: "/broken",
    });
  });
});
