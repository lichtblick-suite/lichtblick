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

import { renderHook, act } from "@testing-library/react-hooks";
import { PropsWithChildren, useState } from "react";

import { MessagePipelineProvider } from "@foxglove/studio-base/components/MessagePipeline";
import FakePlayer from "@foxglove/studio-base/components/MessagePipeline/FakePlayer";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import {
  Player,
  PlayerStateActiveData,
  Topic,
  MessageEvent,
} from "@foxglove/studio-base/players/types";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

import * as PanelAPI from ".";

describe("useMessageReducer", () => {
  it("calls restore to initialize without messages", async () => {
    const addMessage = jest.fn();
    const restore = jest.fn().mockReturnValue(1);
    const { result } = renderHook(
      () =>
        PanelAPI.useMessageReducer({
          topics: ["/foo"],
          restore,
          addMessage,
        }),
      {
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([]);
    expect(result.current).toEqual(1);
  });

  it("requires exactly one 'add' callback", () => {
    const restore = jest.fn().mockReturnValue(1);
    const addMessage = jest.fn();
    const addMessages = jest.fn();
    const { result: result1 } = renderHook(() =>
      PanelAPI.useMessageReducer({ topics: ["/foo"], restore }),
    );
    expect(result1.error).toEqual(
      new Error("useMessageReducer must be provided with exactly one of addMessage or addMessages"),
    );
    const { result: result2 } = renderHook(() =>
      PanelAPI.useMessageReducer({ topics: ["/foo"], restore, addMessage, addMessages }),
    );
    expect(result2.error).toEqual(
      new Error("useMessageReducer must be provided with exactly one of addMessage or addMessages"),
    );
  });

  it("calls restore to initialize and addMessage for initial messages", async () => {
    const message: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "foo",
      sizeInBytes: 0,
    };

    const restore = jest.fn().mockReturnValue(1);
    const addMessage = jest.fn().mockImplementation((_, msg) => msg.message.value);
    const { result } = renderHook(
      () =>
        PanelAPI.useMessageReducer({
          topics: ["/foo"],
          restore,
          addMessage,
        }),
      {
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={[message]}>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([[1, message]]);
    expect(result.current).toEqual(2);
  });

  it("calls restore to initialize and addMessages for initial messages", async () => {
    const message: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "foo",
      sizeInBytes: 0,
    };

    const restore = jest.fn().mockReturnValue(1);
    const addMessages = jest
      .fn()
      .mockImplementation((_, msgs) => msgs[msgs.length - 1].message.value);
    const { result } = renderHook(
      () =>
        PanelAPI.useMessageReducer({
          topics: ["/foo"],
          restore,
          addMessages,
        }),
      {
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={[message]}>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessages.mock.calls).toEqual([[1, [message]]]);
    expect(result.current).toEqual(2);
  });

  it("calls addMessage for messages added later", async () => {
    const message1: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "foo",
      sizeInBytes: 0,
    };
    const message2: MessageEvent<unknown> = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 3 },
      schemaName: "bar",
      sizeInBytes: 0,
    };

    const restore = jest.fn().mockReturnValue(1);
    const addMessage = jest.fn().mockImplementation((_, msg) => msg.message.value);

    let messages: typeof message1[] = [];
    const { result, rerender } = renderHook(
      ({ topics }) =>
        PanelAPI.useMessageReducer({
          topics,
          restore,
          addMessage,
        }),
      {
        initialProps: { topics: ["/foo"] },
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={messages}>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    messages = [message1];
    rerender({ topics: ["/foo"] });

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([[1, message1]]);
    expect(result.current).toEqual(2);

    // Subscribe to a new topic, then receive a message on that topic
    rerender({ topics: ["/foo", "/bar"] });

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([[1, message1]]);
    expect(result.current).toEqual(2);

    messages = [message2];
    rerender({ topics: ["/foo", "/bar"] });

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([
      [1, message1],
      [2, message2],
    ]);
    expect(result.current).toEqual(3);
  });

  it("calls addMessages for messages added later", async () => {
    const message1: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "foo",
      sizeInBytes: 0,
    };
    const message2: MessageEvent<unknown> = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 3 },
      schemaName: "bar",
      sizeInBytes: 0,
    };
    const message3: MessageEvent<unknown> = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 4 },
      schemaName: "bar",
      sizeInBytes: 0,
    };

    const restore = jest.fn().mockReturnValue(1);
    const addMessages = jest
      .fn()
      .mockImplementation((_, msgs) => msgs[msgs.length - 1].message.value);

    let messages: typeof message1[] = [];
    const { result, rerender } = renderHook(
      ({ topics }) =>
        PanelAPI.useMessageReducer({
          topics,
          restore,
          addMessages,
        }),
      {
        initialProps: { topics: ["/foo"] },
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={messages}>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    messages = [message1];
    rerender({ topics: ["/foo"] });

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessages.mock.calls).toEqual([[1, [message1]]]);
    expect(result.current).toEqual(2);

    // Subscribe to a new topic, then receive a message on that topic
    rerender({ topics: ["/foo", "/bar"] });

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessages.mock.calls).toEqual([[1, [message1]]]);
    expect(result.current).toEqual(2);

    messages = [message2, message3];
    rerender({ topics: ["/foo", "/bar"] });

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessages.mock.calls).toEqual([
      [1, [message1]],
      [2, [message2, message3]],
    ]);
    expect(result.current).toEqual(4);
  });

  it("does not filter out non-existing topics", () => {
    // Initial mount. Note that we haven't received any topics yet.
    const setSubscriptions = jest.fn();

    const restore = jest.fn().mockReturnValue(1);
    const addMessage = jest.fn().mockImplementation((_, msg) => msg.message.value);

    const { rerender, unmount } = renderHook(
      ({ topics }) =>
        PanelAPI.useMessageReducer({
          topics,
          restore,
          addMessage,
        }),
      {
        initialProps: { topics: ["/foo"] },
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider setSubscriptions={setSubscriptions}>
            {children}
          </MockMessagePipelineProvider>
        ),
      },
    );

    // Updating to change topics.
    rerender({ topics: ["/foo", "/bar"] });

    // And unsubscribes properly, too.
    act(() => {
      unmount();
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
    const message1: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "foo",
      sizeInBytes: 0,
    };

    const restore = jest.fn().mockReturnValue(1);
    const addMessage = jest.fn().mockImplementation((_, msg) => msg.message.value);

    let messages: typeof message1[] = [];
    let activeData: Partial<PlayerStateActiveData> = {};
    const { result, rerender } = renderHook(
      () => PanelAPI.useMessageReducer({ topics: ["/foo"], restore, addMessage }),
      {
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={messages} activeData={activeData}>
            {children}
          </MockMessagePipelineProvider>
        ),
      },
    );

    messages = [message1];
    rerender();

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([[1, message1]]);
    expect(result.current).toEqual(2);

    messages = [];
    activeData = { lastSeekTime: 1 };
    rerender();

    expect(restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(addMessage.mock.calls).toEqual([[1, message1]]);
    expect(result.current).toEqual(1);
  });

  function makeWrapper(player: Player) {
    function Wrapper({ children }: PropsWithChildren<unknown>) {
      const [config] = useState(() => makeMockAppConfiguration());
      return (
        <AppConfigurationContext.Provider value={config}>
          <MessagePipelineProvider player={player} globalVariables={{}}>
            {children}
          </MessagePipelineProvider>
        </AppConfigurationContext.Provider>
      );
    }
    return Wrapper;
  }

  it("doesn't call addMessage when requested topics change player", async () => {
    const restore = jest.fn();
    const addMessage = jest.fn();

    restore.mockReturnValue(0);
    addMessage.mockImplementation((_, msg) => msg.message.value);

    const message1: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 1 },
      schemaName: "foo",
      sizeInBytes: 0,
    };
    const message2: MessageEvent<unknown> = {
      topic: "/bar",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "bar",
      sizeInBytes: 0,
    };

    const player = new FakePlayer();
    const { result, rerender } = renderHook(
      ({ topics }: { topics: string[] }) => {
        return PanelAPI.useMessageReducer<number>({ topics, restore, addMessage });
      },
      {
        wrapper: makeWrapper(player),
        initialProps: { topics: [] as string[] },
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([]);
    expect(result.current).toEqual(0);

    rerender({ topics: ["/bar"] });

    // Subscribing does not invoke restore or add message
    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([]);
    expect(result.current).toEqual(0);

    let promise: Promise<void>;
    act(
      () =>
        void (promise = player.emit({
          activeData: {
            messages: [message1, message2],
            currentTime: { sec: 0, nsec: 0 },
            startTime: { sec: 0, nsec: 0 },
            endTime: { sec: 1, nsec: 0 },
            isPlaying: true,
            speed: 0.2,
            lastSeekTime: 1234,
            topics: [
              { name: "/foo", schemaName: "foo" },
              { name: "/bar", schemaName: "foo" },
            ],
            topicStats: new Map(),
            datatypes: new Map(
              Object.entries({ foo: { definitions: [] }, bar: { definitions: [] } }),
            ),
            totalBytesReceived: 1234,
          },
        })),
    );
    await act(async () => await promise);

    // restore call with undefined, then add message called with our subscribed message
    expect(restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(addMessage.mock.calls).toEqual([[0, message2]]);
    expect(result.current).toEqual(2);

    rerender({ topics: ["/bar", "/foo"] });

    // no additional calls
    expect(restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(addMessage.mock.calls).toEqual([[0, message2]]);
    // the same result is repeated
    expect(result.current).toEqual(2);

    let promise2: Promise<void>;
    act(
      () =>
        void (promise2 = player.emit({
          activeData: {
            messages: [message1, message2],
            currentTime: { sec: 0, nsec: 0 },
            startTime: { sec: 0, nsec: 0 },
            endTime: { sec: 1, nsec: 0 },
            isPlaying: true,
            speed: 0.2,
            lastSeekTime: 1234,
            topics: [
              { name: "/foo", schemaName: "foo" },
              { name: "/bar", schemaName: "foo" },
            ],
            topicStats: new Map(),
            datatypes: new Map(
              Object.entries({ foo: { definitions: [] }, bar: { definitions: [] } }),
            ),
            totalBytesReceived: 1234,
          },
        })),
    );
    await act(async () => await promise2);

    expect(restore.mock.calls).toEqual([[undefined], [undefined]]);
    expect(addMessage.mock.calls).toEqual([
      [0, message2],
      [2, message1],
      [1, message2],
    ]);
    // the same result is repeated
    expect(result.current).toEqual(2);
  });

  it("doesn't re-render when player topics or other playerState changes", async () => {
    const message: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "foo",
      sizeInBytes: 0,
    };

    const restore = jest.fn().mockReturnValue(1);
    const addMessage = jest.fn().mockImplementation((_, msg) => msg.message.value);

    const messages = [message];
    let topics: Topic[] = [];
    let capabilities: string[] = [];
    const { result, rerender } = renderHook(
      () => PanelAPI.useMessageReducer({ topics: ["/foo"], restore, addMessage }),
      {
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider
            messages={messages}
            topics={topics}
            capabilities={capabilities}
          >
            {children}
          </MockMessagePipelineProvider>
        ),
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([[1, message]]);
    expect(result.current).toEqual(2);

    topics = [{ name: "/bar", schemaName: "Bar" }];
    rerender();
    capabilities = ["some_capability"];
    rerender();

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([[1, message]]);
    expect(result.current).toEqual(2);
  });

  it("doesn't re-render when activeData is empty", async () => {
    const restore = jest.fn().mockReturnValue(1);
    const addMessage = jest.fn().mockImplementation((_, msg) => msg.message.value);

    let capabilities: string[] | undefined = undefined;
    const { result, rerender } = renderHook(
      () => PanelAPI.useMessageReducer({ topics: ["/foo"], restore, addMessage }),
      {
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider noActiveData capabilities={capabilities}>
            {children}
          </MockMessagePipelineProvider>
        ),
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([]);
    expect(result.current).toEqual(1);

    capabilities = ["some_capability"];
    rerender();

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(addMessage.mock.calls).toEqual([]);
    expect(result.current).toEqual(1);
  });

  it("restore called when addMessages changes", async () => {
    const message1: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      schemaName: "foo",
      sizeInBytes: 0,
    };

    const restore = jest.fn().mockReturnValue(1);
    const initialAddMessages = jest
      .fn()
      .mockImplementation((_, msgs) => msgs[msgs.length - 1].message.value);

    const messages = [message1];
    const { result, rerender } = renderHook(
      ({ addMessages }) => PanelAPI.useMessageReducer({ topics: ["/foo"], restore, addMessages }),
      {
        initialProps: { addMessages: initialAddMessages },
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={messages}>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    expect(restore.mock.calls).toEqual([[undefined]]);
    expect(result.current).toEqual(2);
    rerender({ addMessages: jest.fn() });
    expect(restore.mock.calls).toEqual([[undefined], [2]]);
  });
});
