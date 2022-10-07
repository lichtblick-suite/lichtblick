/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { renderHook } from "@testing-library/react-hooks";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import * as PanelAPI from ".";

describe("useDataSourceInfo", () => {
  const topics: Topic[] = [{ name: "/foo", schemaName: "Foo" }];
  const messages: MessageEvent<unknown>[] = [
    {
      topic: "/foo",
      receiveTime: { sec: 1, nsec: 2 },
      message: {},
      schemaName: "foo",
      sizeInBytes: 0,
    },
    {
      topic: "/foo",
      receiveTime: { sec: 5, nsec: 6 },
      message: {},
      schemaName: "foo",
      sizeInBytes: 0,
    },
  ];
  const datatypes: RosDatatypes = new Map(
    Object.entries({
      Foo: { definitions: [] },
    }),
  );

  it("returns data from MessagePipelineContext", () => {
    const { result } = renderHook(() => PanelAPI.useDataSourceInfo(), {
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider
          topics={topics}
          datatypes={datatypes}
          capabilities={["hello"]}
          messages={messages.slice(0, 1)}
          startTime={{ sec: 0, nsec: 1 }}
        >
          {children}
        </MockMessagePipelineProvider>
      ),
    });
    expect(result.current).toEqual<typeof result.current>({
      topics: [{ name: "/foo", schemaName: "Foo" }],
      datatypes: new Map(Object.entries({ Foo: { definitions: [] } })),
      capabilities: ["hello"],
      startTime: { sec: 0, nsec: 1 },
      playerId: "1",
    });
  });

  it("doesn't change when messages change", () => {
    let currentMessages = messages.slice(0, 1);
    let currentTopics = topics;
    const capabilities = ["hello"];
    const startTime = { sec: 0, nsec: 1 };
    const { result, rerender } = renderHook(() => PanelAPI.useDataSourceInfo(), {
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider
          topics={currentTopics}
          datatypes={datatypes}
          capabilities={capabilities}
          messages={currentMessages}
          startTime={startTime}
        >
          {children}
        </MockMessagePipelineProvider>
      ),
    });
    expect(result.current).toEqual<typeof result.current>({
      topics: [{ name: "/foo", schemaName: "Foo" }],
      datatypes: new Map(Object.entries({ Foo: { definitions: [] } })),
      capabilities: ["hello"],
      startTime: { sec: 0, nsec: 1 },
      playerId: "1",
    });
    const firstResult = result.current;
    currentMessages = [messages[1]!];
    rerender();
    expect(result.current).toBe(firstResult);

    currentTopics = [...topics, { name: "/bar", schemaName: "Bar" }];
    rerender();
    expect(result.current).toEqual<typeof result.current>({
      topics: [
        { name: "/bar", schemaName: "Bar" },
        { name: "/foo", schemaName: "Foo" },
      ],
      datatypes: new Map(Object.entries({ Foo: { definitions: [] } })),
      capabilities: ["hello"],
      startTime: { sec: 0, nsec: 1 },
      playerId: "1",
    });
  });
});
