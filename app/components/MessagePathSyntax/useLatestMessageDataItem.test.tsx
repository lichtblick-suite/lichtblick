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
import { mount } from "enzyme";

import { MockMessagePipelineProvider } from "@foxglove-studio/app/components/MessagePipeline";
import { Message, MessageFormat } from "@foxglove-studio/app/players/types";
import { deepParse } from "@foxglove-studio/app/util/binaryObjects";

import { useLatestMessageDataItem } from "./useLatestMessageDataItem";

const topics = [{ name: "/topic", datatype: "datatype" }];
const datatypes = {
  datatype: { fields: [{ name: "value", type: "uint32", isArray: false, isComplex: false }] },
};
const messages: Message[] = [
  {
    topic: "/topic",
    receiveTime: { sec: 0, nsec: 0 },
    message: { value: 0 },
  },
  {
    topic: "/topic",
    receiveTime: { sec: 1, nsec: 0 },
    message: { value: 1 },
  },
  {
    topic: "/topic",
    receiveTime: { sec: 2, nsec: 0 },
    message: { value: 2 },
  },
];

describe("useLatestMessageDataItem", () => {
  // Create a helper component that exposes the results of the hook for mocking.
  function createTest(format: MessageFormat = "parsedMessages") {
    function Test({ path }: { path: string }) {
      Test.result(useLatestMessageDataItem(path, format));
      return ReactNull;
    }
    Test.result = jest.fn();
    return Test;
  }

  it("returns undefined by default", async () => {
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider topics={topics} datatypes={datatypes}>
        <Test path="/topic.value" />
      </MockMessagePipelineProvider>,
    );
    expect(Test.result.mock.calls).toEqual([[undefined]]);
    root.unmount();
  });

  it("uses the latest message", async () => {
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider messages={[messages[0]!]} topics={topics} datatypes={datatypes}>
        <Test path="/topic.value" />
      </MockMessagePipelineProvider>,
    );
    expect(Test.result.mock.calls).toEqual([
      [{ message: messages[0], queriedData: [{ path: "/topic.value", value: 0 }] }],
    ]);

    root.setProps({ messages: [messages[1], messages[2]] });
    expect(Test.result.mock.calls).toEqual([
      [{ message: messages[0], queriedData: [{ path: "/topic.value", value: 0 }] }],
      [{ message: messages[2], queriedData: [{ path: "/topic.value", value: 2 }] }],
    ]);

    root.unmount();
  });

  it("only keeps messages that match the path", async () => {
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider messages={messages} topics={topics} datatypes={datatypes}>
        <Test path="/topic{value==1}.value" />
      </MockMessagePipelineProvider>,
    );
    expect(Test.result.mock.calls).toEqual([
      [{ message: messages[1], queriedData: [{ path: "/topic{value==1}.value", value: 1 }] }],
    ]);
    root.unmount();
  });

  it("changing the path gives the new queriedData from the message", async () => {
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider messages={messages} topics={topics} datatypes={datatypes}>
        <Test path="/topic{value==1}.value" />
      </MockMessagePipelineProvider>,
    );

    root.setProps({ children: <Test path="/topic{value==1}" /> });
    expect(Test.result.mock.calls).toEqual([
      [{ message: messages[1], queriedData: [{ path: "/topic{value==1}.value", value: 1 }] }],
      [
        {
          message: messages[1],
          queriedData: [{ path: "/topic{value==1}", value: messages[1]?.message }],
        },
      ],
    ]);

    root.unmount();
  });

  it("returns bobjects when told to", async () => {
    const Test = createTest("bobjects");
    const root = mount(
      <MockMessagePipelineProvider messages={[messages[0]!]} topics={topics} datatypes={datatypes}>
        <Test path="/topic" />
      </MockMessagePipelineProvider>,
    );
    expect(Test.result.mock.calls).toHaveLength(1);
    const {
      message,
      queriedData: [data],
    } = Test.result.mock.calls[0][0] ?? {};
    expect(deepParse(message.message)).toEqual(messages[0]?.message);
    expect(deepParse(data.value)).toEqual(messages[0]?.message);

    root.unmount();
  });
});
