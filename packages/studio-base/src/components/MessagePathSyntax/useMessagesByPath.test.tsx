/** @jest-environment jsdom */
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

import { act, renderHook } from "@testing-library/react-hooks";
import React, { PropsWithChildren } from "react";

import { MessageDataItemsByPath } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import useMessagesByPath from "@foxglove/studio-base/components/MessagePathSyntax/useMessagesByPath";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import CurrentLayoutContext from "@foxglove/studio-base/context/CurrentLayoutContext";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import * as fixture from "./fixture";

const singleTopic = [{ name: "/some/topic", datatype: "some/datatype" }];

function queriedMessage(index: 0 | 1 | 2) {
  return {
    message: fixture.messages[index],
    queriedData: [{ value: fixture.messages[index].message, path: "/some/topic" }],
  };
}

type TestProps = {
  paths: string[];
  historySize?: number;
} & Partial<
  Pick<
    React.ComponentProps<typeof MockMessagePipelineProvider>,
    "topics" | "datatypes" | "messages" | "activeData"
  >
>;

function makeMessagePipelineWrapper(initialGlobalVariables?: GlobalVariables) {
  const setSubscriptions = jest.fn();

  const currentLayout = new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS);
  if (initialGlobalVariables != undefined) {
    currentLayout.actions.setGlobalVariables(initialGlobalVariables);
  }

  const wrapper = ({
    children,
    topics = [],
    datatypes = new Map(),
    messages = [],
    activeData,
  }: PropsWithChildren<TestProps>) => (
    <CurrentLayoutContext.Provider value={currentLayout}>
      <MockMessagePipelineProvider
        topics={topics}
        datatypes={datatypes}
        messages={messages}
        setSubscriptions={setSubscriptions}
        activeData={activeData}
      >
        {children}
      </MockMessagePipelineProvider>
    </CurrentLayoutContext.Provider>
  );
  return { setSubscriptions, wrapper };
}

const Hooks = ({ paths, historySize }: TestProps) => ({
  messagesByPath: useMessagesByPath(paths, historySize),
  setGlobalVariables: useGlobalVariables().setGlobalVariables,
});

describe("useMessagesByPath", () => {
  it("(un)subscribes based on `topics`", () => {
    const { setSubscriptions, wrapper } = makeMessagePipelineWrapper();
    const { unmount, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps: {
        paths: ["/some/topic", "/some/other/topic"],
        topics: [
          { name: "/some/topic", datatype: "dummy" },
          { name: "/some/other/topic", datatype: "dummy" },
        ],
      },
    });

    rerender({ paths: ["/some/topic"] });
    unmount();

    expect(setSubscriptions.mock.calls).toEqual([
      [
        expect.any(String),
        [
          { topic: "/some/topic", preloadingFallback: false },
          { topic: "/some/other/topic", preloadingFallback: false },
        ],
      ],
      [expect.any(String), [{ topic: "/some/topic", preloadingFallback: false }]],
      [expect.any(String), []],
    ]);
  });

  it("does not filter out non-existing topics", () => {
    // Initial mount. Note that we haven't received any topics yet.
    const { setSubscriptions, wrapper } = makeMessagePipelineWrapper();
    const { unmount, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps: {
        paths: ["/some/topic"],
      },
    });

    // Updating to change topics
    rerender({ paths: ["/some/topic", "/some/other/topic"] });

    // And unsubscribes properly, too.
    unmount();

    expect(setSubscriptions.mock.calls).toEqual([
      [expect.any(String), [{ topic: "/some/topic", preloadingFallback: false }]],
      [
        expect.any(String),
        [
          { topic: "/some/topic", preloadingFallback: false },
          { topic: "/some/other/topic", preloadingFallback: false },
        ],
      ],
      [expect.any(String), []],
    ]);
  });

  it("allows changing historySize", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      paths: ["/some/topic"],
      topics: singleTopic,
      historySize: 1,
    };
    const { result, rerender, unmount } = renderHook(Hooks, {
      wrapper,
      initialProps,
    });
    rerender({ ...initialProps, historySize: 2 });
    rerender({ ...initialProps, historySize: 2, messages: [...fixture.messages] });
    unmount();

    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([
      { "/some/topic": [] },
      { "/some/topic": [] },
      {
        "/some/topic": [
          { message: fixture.messages[1], queriedData: [] },
          { message: fixture.messages[2], queriedData: [] },
        ],
      },
    ]);
  });

  it("buffers messages (with historySize=2)", () => {
    // Start with just the first two messages.
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      paths: ["/some/topic"],
      topics: singleTopic,
      historySize: 2,
      datatypes: fixture.datatypes,
      messages: [fixture.messages[0], fixture.messages[1]],
    };
    const { result, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps,
    });
    expect(result.all.length).toEqual(1);

    // Then let's send in the last message too, and it should discard the older message
    // (since bufferSize=2).
    rerender({ ...initialProps, messages: [fixture.messages[2]] });

    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([
      { "/some/topic": [queriedMessage(0), queriedMessage(1)] },
      { "/some/topic": [queriedMessage(1), queriedMessage(2)] },
    ]);
  });

  it("clears everything on seek", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      paths: ["/some/topic"],
      topics: singleTopic,
      datatypes: fixture.datatypes,
      messages: [fixture.messages[0]],
    };
    const { result, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps,
    });
    expect(result.all.length).toEqual(1);

    // Do the seek, and make sure we clear things out.
    rerender({ ...initialProps, messages: [], activeData: { lastSeekTime: 1 } });

    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([{ "/some/topic": [queriedMessage(0)] }, { "/some/topic": [] }]);
  });

  it("returns the same when passing in a topic twice", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      topics: singleTopic,
      datatypes: fixture.datatypes,
      messages: [fixture.messages[0], fixture.messages[1]],
    };
    const { result: result1 } = renderHook(Hooks, {
      wrapper,
      initialProps: { ...initialProps, paths: ["/some/topic"] },
    });
    const { result: result2 } = renderHook(Hooks, {
      wrapper,
      initialProps: { ...initialProps, paths: ["/some/topic", "/some/topic"] },
    });

    expect(
      result1.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual(result2.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)));
  });

  it("lets you drill down in a path", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      paths: ["/some/topic.index"],
      topics: singleTopic,
      datatypes: fixture.datatypes,
      messages: [fixture.messages[0], fixture.messages[1]],
    };
    const { result } = renderHook(Hooks, {
      wrapper,
      initialProps,
    });
    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([
      {
        "/some/topic.index": [
          {
            message: fixture.messages[0],
            queriedData: [{ path: "/some/topic.index", value: 0 }],
          },
          {
            message: fixture.messages[1],
            queriedData: [{ path: "/some/topic.index", value: 1 }],
          },
        ],
      },
    ]);
  });

  it("remembers data when changing topics", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      paths: ["/some/topic"],
      topics: [
        { name: "/some/topic", datatype: "some/datatype" },
        { name: "/some/other/topic", datatype: "dummy" },
      ],
      datatypes: fixture.datatypes,
      messages: [fixture.messages[0]],
    };
    const { result, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps,
    });

    // Add a new path, and we should get another call with the same data
    rerender({ ...initialProps, paths: ["/some/topic", "/some/other/topic"] });

    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([
      { "/some/topic": [queriedMessage(0)] },
      { "/some/topic": [queriedMessage(0)], "/some/other/topic": [] },
    ]);
  });

  it("remembers data when changing paths on an existing topic", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      paths: ["/some/topic"],
      topics: [
        { name: "/some/topic", datatype: "some/datatype" },
        { name: "/some/other/topic", datatype: "dummy" },
      ],
      datatypes: fixture.datatypes,
      messages: [fixture.messages[0]],
    };
    const { result, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps,
    });

    // Change an existing path, and we should restore the data from the previous path on the same topic
    rerender({ ...initialProps, paths: ["/some/topic.index"] });

    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([
      { "/some/topic": [queriedMessage(0)] },
      {
        "/some/topic.index": [
          {
            message: fixture.messages[0],
            queriedData: [{ path: "/some/topic.index", value: 0 }],
          },
        ],
      },
    ]);
  });

  describe("global variables in paths", () => {
    const exampleDatatypes: RosDatatypes = new Map(
      Object.entries({
        "dtype/Foo": {
          definitions: [{ name: "bars", type: "dtype/Bar", isArray: true, isComplex: true }],
        },
        "dtype/Bar": {
          definitions: [
            { name: "index", type: "int32" },
            { name: "baz", type: "int32" },
          ],
        },
      }),
    );

    const message = {
      topic: "/some/topic",
      receiveTime: { sec: 100, nsec: 0 },
      message: {
        bars: [
          { index: 0, baz: 10 },
          { index: 1, baz: 11 },
          { index: 2, baz: 12 },
        ],
      },
    };
    it("updates queriedData when a global variable changes", () => {
      const { wrapper } = makeMessagePipelineWrapper({ foo: 0 });
      const initialProps = {
        paths: ["/some/topic.bars[:]{index==$foo}.baz"],
        topics: [{ name: "/some/topic", datatype: "dtype/Foo" }],
        datatypes: exampleDatatypes,
        messages: [message],
      };
      const { result, unmount } = renderHook(Hooks, {
        wrapper,
        initialProps,
      });

      // when $foo changes to 1, queriedData.value should change to 11
      act(() => {
        result.current.setGlobalVariables({ foo: 1 });
      });

      expect(
        result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
      ).toEqual([
        {
          "/some/topic.bars[:]{index==$foo}.baz": [
            {
              message,
              queriedData: [{ path: "/some/topic.bars[:]{index==$foo}.baz", value: 10 }],
            },
          ],
        },
        {
          "/some/topic.bars[:]{index==$foo}.baz": [
            {
              message,
              queriedData: [{ path: "/some/topic.bars[:]{index==$foo}.baz", value: 11 }],
            },
          ],
        },
      ]);

      unmount();
    });
  });

  it("supports changing a path for a previously-existing topic that no longer exists", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const { result, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps: {
        paths: ["/some/topic"],
        topics: singleTopic,
        datatypes: fixture.datatypes,
        messages: [fixture.messages[0]],
      },
    });

    rerender({ topics: [], datatypes: new Map(), messages: [], paths: ["/some/topic.index"] });

    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([{ "/some/topic": [queriedMessage(0)] }, { "/some/topic.index": [] }]);
  });

  it("ignores messages from non-subscribed topics", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const initialProps = {
      paths: ["/some/other/topic"],
      topics: [
        { name: "/some/topic", datatype: "dummy" },
        { name: "/some/other/topic", datatype: "dummy" },
      ],
      datatypes: fixture.datatypes,
      messages: [fixture.messages[0]],
    };
    const { result, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps,
    });
    rerender({ ...initialProps, messages: [fixture.messages[1], fixture.messages[2]] });

    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([{ "/some/other/topic": [] }, { "/some/other/topic": [] }]);
  });

  it("return the same itemsByPath (identity) if the MessageHistory props did not change but children changed", () => {
    const { wrapper } = makeMessagePipelineWrapper();
    const { result, rerender } = renderHook(Hooks, {
      wrapper,
      initialProps: {
        paths: ["/some/topic"],
        topics: singleTopic,
        datatypes: fixture.datatypes,
        messages: [fixture.messages[0]],
      },
    });
    rerender();
    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.messagesByPath)),
    ).toEqual([{ "/some/topic": [queriedMessage(0)] }, { "/some/topic": [queriedMessage(0)] }]);
    expect((result.all[0] as { messagesByPath: MessageDataItemsByPath }).messagesByPath).toBe(
      (result.all[1] as { messagesByPath: MessageDataItemsByPath }).messagesByPath,
    );
  });
});
