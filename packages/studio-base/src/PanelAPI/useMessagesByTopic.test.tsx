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

import { mount } from "enzyme";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";

import * as PanelAPI from ".";

describe("useMessagesByTopic", () => {
  // Create a helper component that exposes the results of the hook for mocking.
  function createTest() {
    function Test({ topics, historySize }: { topics: string[]; historySize: number }) {
      Test.result(PanelAPI.useMessagesByTopic({ topics, historySize }));
      return ReactNull;
    }
    Test.result = jest.fn();
    return Test;
  }

  it("initializes with an empty array per topic", async () => {
    const Test = createTest();

    const root = mount(
      <MockMessagePipelineProvider>
        <Test topics={["/foo"]} historySize={1} />
      </MockMessagePipelineProvider>,
    );

    await Promise.resolve();
    expect(Test.result.mock.calls).toEqual([[{ "/foo": [] }]]);

    root.unmount();
  });

  it("add messages to their respective arrays", () => {
    const Test = createTest();

    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 1 },
    };

    const message2 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[message1]}>
        <Test topics={["/foo"]} historySize={Infinity} />
      </MockMessagePipelineProvider>,
    );
    root.setProps({ messages: [message2] });

    expect(Test.result.mock.calls).toEqual([
      [{ "/foo": [message1] }],
      [{ "/foo": [message1, message2] }],
    ]);

    // Make sure that the identities are also the same, not just deep-equal.
    expect(Test.result.mock.calls[0][0]["/foo"][0]).toBe(message1);

    root.unmount();
  });

  it("remembers messages when changing props (both topics and historySize)", () => {
    const Test = createTest();

    const message1 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 1 },
    };

    const message2 = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 2 },
    };

    const root = mount(
      <MockMessagePipelineProvider messages={[message1, message2]}>
        <Test topics={["/foo"]} historySize={Infinity} />
      </MockMessagePipelineProvider>,
    );

    expect(Test.result.mock.calls).toEqual([[{ "/foo": [message1, message2] }]]);

    root.setProps({ messages: [], children: <Test topics={["/foo", "/bar"]} historySize={1} /> });

    expect(Test.result.mock.calls).toEqual([
      [{ "/foo": [message1, message2] }],
      [{ "/foo": [message2], "/bar": [] }],
    ]);

    // Make sure that the identities are also the same, not just deep-equal.
    expect(Test.result.mock.calls[1][0]["/foo"][0]).toBe(message2);

    root.unmount();
  });
});
