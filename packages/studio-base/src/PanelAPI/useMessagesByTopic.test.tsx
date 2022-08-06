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

import * as PanelAPI from ".";

describe("useMessagesByTopic", () => {
  it("initializes with an empty array per topic", async () => {
    const { result } = renderHook(
      ({ topics, historySize }) => PanelAPI.useMessagesByTopic({ topics, historySize }),
      {
        initialProps: { topics: ["/foo"], historySize: 1 },
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    expect(result.current).toEqual({ "/foo": [] });
  });

  it("add messages to their respective arrays", () => {
    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 1 },
      sizeInBytes: 0,
    };

    const message2 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    let messages = [message1];
    const { result, rerender } = renderHook(
      ({ topics, historySize }) => PanelAPI.useMessagesByTopic({ topics, historySize }),
      {
        initialProps: { topics: ["/foo"], historySize: Infinity },
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={messages}>{children}</MockMessagePipelineProvider>
        ),
      },
    );
    expect(result.current).toEqual({ "/foo": [message1] });
    messages = [message2];
    rerender({ topics: ["/foo"], historySize: Infinity });
    expect(result.current).toEqual({ "/foo": [message1, message2] });
  });

  it("remembers messages when changing props (both topics and historySize)", () => {
    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 1 },
      sizeInBytes: 0,
    };

    const message2 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
      sizeInBytes: 0,
    };

    let messages = [message1, message2];
    const { result, rerender } = renderHook(
      ({ topics, historySize }) => PanelAPI.useMessagesByTopic({ topics, historySize }),
      {
        initialProps: { topics: ["/foo"], historySize: Infinity },
        wrapper: ({ children }) => (
          <MockMessagePipelineProvider messages={messages}>{children}</MockMessagePipelineProvider>
        ),
      },
    );

    expect(result.current).toEqual({ "/foo": [message1, message2] });

    messages = [];
    rerender({ topics: ["/foo", "/bar"], historySize: 1 });

    expect(result.current).toEqual({ "/foo": [message2], "/bar": [] });
  });
});
