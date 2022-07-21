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

import { renderHook } from "@testing-library/react-hooks/dom";
import { mount } from "enzyme";
import { PropsWithChildren, useState } from "react";
import { act } from "react-dom/test-utils";

import { MessagePipelineProvider } from "@foxglove/studio-base/components/MessagePipeline";
import FakePlayer from "@foxglove/studio-base/components/MessagePipeline/FakePlayer";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import { MessageEvent, Player } from "@foxglove/studio-base/players/types";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

import * as PanelAPI from ".";

describe("useMessageReducer", () => {
  // Create a helper component that exposes restore, addMessage, and the results of the hook for mocking
  function createTest({
    useAddMessage = true,
    useAddMessages = false,
  }: { useAddMessage?: boolean; useAddMessages?: boolean } = {}) {
    function Test({
      topics,
      addMessagesOverride,
    }: {
      topics: string[];
      addMessagesOverride?: (value: unknown, messages: readonly MessageEvent<unknown>[]) => unknown;
    }) {
      try {
        const result = PanelAPI.useMessageReducer({
          topics,
          addMessage: useAddMessage ? Test.addMessage : undefined,
          addMessages: useAddMessages ? addMessagesOverride ?? Test.addMessages : undefined,
          restore: Test.restore,
        });
        Test.result(result);
      } catch (e) {
        Test.error(e);
      }
      return ReactNull;
    }
    Test.result = jest.fn();
    Test.error = jest.fn();
    Test.restore = jest.fn();
    Test.addMessage = jest.fn();
    Test.addMessages = jest.fn();
    return Test;
  }

  it("calls restore to initialize without messages", async () => {
    const Test = createTest();
    Test.restore.mockReturnValue(1);

    const root = mount(
      <MockMessagePipelineProvider>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    await Promise.resolve();
    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([]);
    expect(Test.result.mock.calls).toEqual([[1]]);

    root.unmount();
  });

  it.each([
    [{ useAddMessage: false, useAddMessages: false, shouldThrow: true }],
    [{ useAddMessage: false, useAddMessages: true, shouldThrow: false }],
    [{ useAddMessage: true, useAddMessages: false, shouldThrow: false }],
    [{ useAddMessage: true, useAddMessages: true, shouldThrow: true }],
  ])(
    "requires exactly one 'add' callback (%p)",
    async ({ useAddMessage, useAddMessages, shouldThrow }) => {
      const Test = createTest({ useAddMessage, useAddMessages });
      mount(
        <MockMessagePipelineProvider>
          <Test topics={["/foo"]} />
        </MockMessagePipelineProvider>,
      );
      expect(Test.result.mock.calls).toHaveLength(shouldThrow ? 0 : 1);
      expect(Test.error.mock.calls).toHaveLength(shouldThrow ? 1 : 0);
    },
  );

  it("calls restore to initialize and addMessage for initial messages", async () => {
    const Test = createTest();

    Test.restore.mockReturnValue(1);
    Test.addMessage.mockImplementation((_, msg) => msg.message.value);

    const message = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[message]}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([[1, message]]);
    expect(Test.addMessages.mock.calls).toEqual([]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);

    root.unmount();
  });

  it("calls restore to initialize and addMessages for initial messages", async () => {
    const Test = createTest({ useAddMessage: false, useAddMessages: true });

    Test.restore.mockReturnValue(1);
    Test.addMessages.mockImplementation((_, msgs) => msgs[msgs.length - 1].message.value);

    const message = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[message]}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([]);
    expect(Test.addMessages.mock.calls).toEqual([[1, [message]]]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);

    root.unmount();
  });

  it("calls addMessage for messages added later", async () => {
    const Test = createTest();

    Test.restore.mockReturnValue(1);
    Test.addMessage.mockImplementation((_, msg) => msg.message.value);

    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };
    const message2 = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 3 },
      sizeInBytes: 0,
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[]}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    root.setProps({ messages: [message1] });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([[1, message1]]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);

    // Subscribe to a new topic, then receive a message on that topic
    root.setProps({ children: <Test topics={["/foo", "/bar"]} /> });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([[1, message1]]);
    expect(Test.result.mock.calls).toEqual([[1], [2], [2]]);

    root.setProps({ messages: [message2] });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([
      [1, message1],
      [2, message2],
    ]);
    expect(Test.result.mock.calls).toEqual([[1], [2], [2], [3]]);

    root.unmount();
  });

  it("calls addMessages for messages added later", async () => {
    const Test = createTest({ useAddMessage: false, useAddMessages: true });

    Test.restore.mockReturnValue(1);
    Test.addMessages.mockImplementation((_prevValue, msgs) => msgs[msgs.length - 1].message.value);

    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };
    const message2 = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 3 },
      sizeInBytes: 0,
    };
    const message3 = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 4 },
      sizeInBytes: 0,
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[]}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    root.setProps({ messages: [message1] });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([]);
    expect(Test.addMessages.mock.calls).toEqual([[1, [message1]]]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);

    // Subscribe to a new topic, then receive a message on that topic
    root.setProps({ children: <Test topics={["/foo", "/bar"]} /> });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([]);
    expect(Test.addMessages.mock.calls).toEqual([[1, [message1]]]);
    expect(Test.result.mock.calls).toEqual([[1], [2], [2]]);

    root.setProps({ messages: [message2, message3] });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([]);
    expect(Test.addMessages.mock.calls).toEqual([
      [1, [message1]],
      [2, [message2, message3]],
    ]);
    expect(Test.result.mock.calls).toEqual([[1], [2], [2], [4]]);

    root.unmount();
  });

  it("does not filter out non-existing topics", () => {
    const Test = createTest();

    // Initial mount. Note that we haven't received any topics yet.
    const setSubscriptions = jest.fn();
    const root = mount(
      <MockMessagePipelineProvider setSubscriptions={setSubscriptions}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    // Updating to change topics.
    root.setProps({ children: <Test topics={["/foo", "/bar"]} /> });

    // And unsubscribes properly, too.
    act(() => {
      root.unmount();
    });
    expect(setSubscriptions.mock.calls).toEqual([
      [expect.any(String), [{ topic: "/foo", preloadType: "partial", requestor: undefined }]],
      [
        expect.any(String),
        [
          { topic: "/foo", preloadType: "partial", requestor: undefined },
          { topic: "/bar", preloadType: "partial", requestor: undefined },
        ],
      ],
      [expect.any(String), []],
    ]);
  });

  it("clears everything on seek", () => {
    const Test = createTest();

    Test.restore.mockReturnValue(1);
    Test.addMessage.mockImplementation((_, msg) => msg.message.value);

    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[]}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    root.setProps({ messages: [message1] });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([[1, message1]]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);

    root.setProps({ messages: [], activeData: { lastSeekTime: 1 } });

    expect(Test.restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([[1, message1]]);
    expect(Test.result.mock.calls).toEqual([[1], [2], [1]]);

    root.unmount();
  });

  type WrapperProps = {
    player?: Player;
    topics: string[];
  };

  function Wrapper({ children, player }: PropsWithChildren<WrapperProps>) {
    const [config] = useState(() => makeMockAppConfiguration());
    return (
      <AppConfigurationContext.Provider value={config}>
        <MessagePipelineProvider player={player} globalVariables={{}}>
          {children}
        </MessagePipelineProvider>
      </AppConfigurationContext.Provider>
    );
  }

  it("doesn't call addMessage when requested topics change player", async () => {
    const restore = jest.fn();
    const addMessage = jest.fn();

    restore.mockReturnValue(0);
    addMessage.mockImplementation((_, msg) => msg.message.value);

    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 1 },
      sizeInBytes: 0,
    };
    const message2 = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    const player = new FakePlayer();
    const { result, rerender } = renderHook<WrapperProps, number>(
      (props) => {
        return PanelAPI.useMessageReducer<number>({
          topics: props.topics,
          restore,
          addMessage,
        });
      },
      {
        wrapper: Wrapper,
        initialProps: { player, topics: [] },
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([]);
    expect(result.all).toEqual([0]);

    rerender({ player, topics: ["/bar"] });

    // Subscribing does not invoke restore or add message
    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([]);
    expect(result.all).toEqual([0, 0]);

    await act(
      async () =>
        await player.emit({
          activeData: {
            messages: [message1, message2],
            currentTime: { sec: 0, nsec: 0 },
            startTime: { sec: 0, nsec: 0 },
            endTime: { sec: 1, nsec: 0 },
            isPlaying: true,
            speed: 0.2,
            lastSeekTime: 1234,
            topics: [
              { name: "/foo", datatype: "foo" },
              { name: "/bar", datatype: "foo" },
            ],
            topicStats: new Map(),
            datatypes: new Map(
              Object.entries({ foo: { definitions: [] }, bar: { definitions: [] } }),
            ),
            totalBytesReceived: 1234,
          },
        }),
    );

    // restore call with undefined, then add message called with our subscribed message
    expect(restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(addMessage.mock.calls).toEqual([[0, message2]]);
    expect(result.all).toEqual([0, 0, 2]);

    rerender({ player, topics: ["/bar", "/foo"] });

    // no additional calls
    expect(restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(addMessage.mock.calls).toEqual([[0, message2]]);
    // the same result is repeated
    expect(result.all).toEqual([0, 0, 2, 2]);

    await act(
      async () =>
        await player.emit({
          activeData: {
            messages: [message1, message2],
            currentTime: { sec: 0, nsec: 0 },
            startTime: { sec: 0, nsec: 0 },
            endTime: { sec: 1, nsec: 0 },
            isPlaying: true,
            speed: 0.2,
            lastSeekTime: 1234,
            topics: [
              { name: "/foo", datatype: "foo" },
              { name: "/bar", datatype: "foo" },
            ],
            topicStats: new Map(),
            datatypes: new Map(
              Object.entries({ foo: { definitions: [] }, bar: { definitions: [] } }),
            ),
            totalBytesReceived: 1234,
          },
        }),
    );

    expect(restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(addMessage.mock.calls).toEqual([
      [0, message2],
      [2, message1],
      [1, message2],
    ]);
    // the same result is repeated
    expect(result.all).toEqual([0, 0, 2, 2]);
  });

  it("doesn't re-render when player topics or other playerState changes", async () => {
    const Test = createTest();

    Test.restore.mockReturnValue(1);
    Test.addMessage.mockImplementation((_, msg) => msg.message.value);

    const message = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[message]}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([[1, message]]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);

    root.setProps({ topics: ["/foo", "/bar"] });
    root.setProps({ capabilities: ["some_capability"] });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([[1, message]]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);

    root.unmount();
  });

  it("doesn't re-render when activeData is empty", async () => {
    const Test = createTest();

    Test.restore.mockReturnValue(1);
    Test.addMessage.mockImplementation((_, msg) => msg.message.value);

    const root = mount(
      <MockMessagePipelineProvider noActiveData>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([]);
    expect(Test.result.mock.calls).toEqual([[1]]);

    root.setProps({ capabilities: ["some_capability"] });

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.addMessage.mock.calls).toEqual([]);
    expect(Test.result.mock.calls).toEqual([[1]]);

    root.unmount();
  });

  it("calls requestBackfill when topics change", async () => {
    const Test = createTest();
    const requestBackfill = jest.fn();

    // Calls `requestBackfill` initially.
    const root = mount(
      <MockMessagePipelineProvider requestBackfill={requestBackfill}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );
    expect(requestBackfill.mock.calls.length).toEqual(1);
    requestBackfill.mockClear();

    // Rendering again with the same topics should NOT result in any calls.
    root.setProps({ children: <Test topics={["/foo"]} /> });
    expect(requestBackfill.mock.calls.length).toEqual(0);
    requestBackfill.mockClear();

    // However, changing the topics results in another `requestBackfill` call.
    root.setProps({ children: <Test topics={["/foo", "/bar"]} /> });
    expect(requestBackfill.mock.calls.length).toEqual(1);
    requestBackfill.mockClear();

    // Passing in a different `addMessage` function should NOT result in any calls.
    Test.addMessage = jest.fn();
    root.setProps({ children: <Test topics={["/foo", "/bar"]} /> });
    expect(requestBackfill.mock.calls.length).toEqual(0);
    requestBackfill.mockClear();

    // Passing in a different `restore` function should NOT result in any calls.
    Test.restore = jest.fn();
    root.setProps({ children: <Test topics={["/foo", "/bar"]} /> });
    expect(requestBackfill.mock.calls.length).toEqual(0);
    requestBackfill.mockClear();

    root.unmount();
  });

  it("restore called when addMessages changes", async () => {
    const Test = createTest({ useAddMessage: false, useAddMessages: true });

    Test.restore.mockReturnValue(1);
    Test.addMessages.mockImplementation((_, msgs) => msgs[msgs.length - 1].message.value);

    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[message1]}>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    expect(Test.restore.mock.calls).toEqual([[undefined]]);
    expect(Test.result.mock.calls).toEqual([[1], [2]]);
    root.setProps({ children: <Test topics={["/foo"]} addMessagesOverride={jest.fn()} /> });
    expect(Test.restore.mock.calls).toEqual([[undefined], [2]]);

    root.unmount();
  });
});
