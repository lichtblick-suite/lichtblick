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
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import * as PanelAPI from ".";

describe("useDataSourceInfo", () => {
  const topics = [{ name: "/foo", datatype: "Foo" }];
  const messages = [
    {
      topic: "/foo",
      receiveTime: { sec: 1, nsec: 2 },
      message: {},
    },
    {
      topic: "/foo",
      receiveTime: { sec: 5, nsec: 6 },
      message: {},
    },
  ];
  const datatypes: RosDatatypes = new Map(
    Object.entries({
      Foo: { definitions: [] },
    }),
  );

  // Create a helper component that exposes the results of the hook in a Jest mock function
  function createTest() {
    function Test() {
      Test.renderFn(PanelAPI.useDataSourceInfo());
      return ReactNull;
    }
    Test.renderFn = jest.fn();
    return Test;
  }

  it("returns data from MessagePipelineContext", () => {
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider
        topics={topics}
        datatypes={datatypes}
        capabilities={["hello"]}
        messages={messages.slice(0, 1)}
        startTime={{ sec: 0, nsec: 1 }}
      >
        <Test />
      </MockMessagePipelineProvider>,
    );
    expect(Test.renderFn.mock.calls).toEqual([
      [
        {
          topics: [{ name: "/foo", datatype: "Foo" }],
          datatypes: new Map(Object.entries({ Foo: { definitions: [] } })),
          capabilities: ["hello"],
          startTime: { sec: 0, nsec: 1 },
          playerId: "1",
        },
      ],
    ]);
    root.unmount();
  });

  it("doesn't change when messages change", () => {
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider
        topics={topics}
        datatypes={datatypes}
        capabilities={["hello"]}
        messages={messages.slice(0, 1)}
        startTime={{ sec: 0, nsec: 1 }}
      >
        <Test />
      </MockMessagePipelineProvider>,
    );
    expect(Test.renderFn.mock.calls).toEqual([
      [
        {
          topics: [{ name: "/foo", datatype: "Foo" }],
          datatypes: new Map(Object.entries({ Foo: { definitions: [] } })),
          capabilities: ["hello"],
          startTime: { sec: 0, nsec: 1 },
          playerId: "1",
        },
      ],
    ]);
    Test.renderFn.mockClear();

    root.setProps({ messages: [messages[1]] });
    expect(Test.renderFn).toHaveBeenCalledTimes(0);

    root.setProps({ topics: [...topics, { name: "/bar", datatype: "Bar" }] });
    expect(Test.renderFn.mock.calls).toEqual([
      [
        {
          topics: [
            { name: "/bar", datatype: "Bar" },
            { name: "/foo", datatype: "Foo" },
          ],
          datatypes: new Map(Object.entries({ Foo: { definitions: [] } })),
          capabilities: ["hello"],
          startTime: { sec: 0, nsec: 1 },
          playerId: "1",
        },
      ],
    ]);

    root.unmount();
  });
});
