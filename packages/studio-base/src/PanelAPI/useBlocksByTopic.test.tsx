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
import { cloneDeep } from "lodash";

import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";

import * as PanelAPI from ".";

describe("useBlocksByTopic", () => {
  // Create a helper component that exposes the results of the hook for mocking.
  function createTest() {
    function Test({ topics }: { topics: string[] }) {
      Test.result(PanelAPI.useBlocksByTopic(topics));
      return ReactNull;
    }
    Test.result = jest.fn();
    return Test;
  }

  it("returns an empty structure when there are no blocks", async () => {
    const Test = createTest();

    const root = mount(
      <MockMessagePipelineProvider>
        <Test topics={["/foo"]} />
      </MockMessagePipelineProvider>,
    );

    expect(Test.result.mock.calls).toEqual([[{ blocks: [], messageReadersByTopic: {} }]]);

    root.unmount();
  });

  it("returns no messagesByTopic when the player does not provide blocks", async () => {
    const activeData = {
      parsedMessageDefinitionsByTopic: { "/topic": parseMessageDefinition("uint32 id") },
    };
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider activeData={activeData}>
        <Test topics={["/topic1"]} />
      </MockMessagePipelineProvider>,
    );
    // Consumers just need to check in one place to see whether they need a fallback for a topic:
    // in messageReadersByTopic. (They don't also need to check the presence of blocks.)
    expect(Test.result.mock.calls).toEqual([[{ blocks: [], messageReadersByTopic: {} }]]);
    root.unmount();
  });

  it("handles uninitialized block states", async () => {
    // messagesByTopic will not exist.
    const activeData = undefined;
    // Note: progress.blocks.map() does not iterate over the blocks.
    const progress = {
      messageCache: {
        blocks: new Array(2),
        startTime: { sec: 0, nsec: 0 },
      },
    };
    const Test = createTest();
    const root = mount(
      <MockMessagePipelineProvider activeData={activeData} progress={progress}>
        <Test topics={["/topic1"]} />
      </MockMessagePipelineProvider>,
    );
    // No message readers, even though we have a definition and we try to subscribe to the topic.
    // This means the data will never be provided.
    expect(Test.result.mock.calls).toEqual([
      [{ blocks: [undefined, undefined], messageReadersByTopic: {} }],
    ]);
    root.unmount();
  });

  it("maintains block identity across repeated renders", async () => {
    const activeData = {
      parsedMessageDefinitionsByTopic: { "/topic": parseMessageDefinition("uint32 id") },
    };
    const progress = {
      messageCache: {
        blocks: [{ sizeInBytes: 0, messagesByTopic: { "/topic": [] } }],
        startTime: { sec: 0, nsec: 0 },
      },
    };
    const Test = createTest();

    const root = mount(
      <MockMessagePipelineProvider activeData={activeData} progress={progress}>
        <Test topics={["/topic"]} />
      </MockMessagePipelineProvider>,
    );

    // Make sure the calls are actual rerenders caused
    const expectedCall = [
      {
        blocks: [{ "/topic": [] }],
        messageReadersByTopic: {},
      },
    ];
    expect(Test.result.mock.calls).toEqual([expectedCall]);

    // Same identity on everything. useBlocksByTopic does not run again.
    root.setProps({ activeData, progress: { messageCache: { ...progress.messageCache } } });

    // Block identity is the same, but blocks array identity changes.
    root.setProps({
      activeData,
      progress: {
        messageCache: { ...progress.messageCache, blocks: progress.messageCache.blocks.slice() },
      },
    });

    // Both identities change.
    root.setProps({ activeData, progress: { messageCache: cloneDeep(progress.messageCache) } });

    expect(Test.result.mock.calls).toEqual([expectedCall, expectedCall, expectedCall]);
    const [[c1], [c3], [c4]] = Test.result.mock.calls;
    expect(c1.blocks).not.toBe(c3.blocks);
    expect(c1.blocks[0]).toBe(c3.blocks[0]);

    expect(c3.blocks).not.toBe(c4.blocks);
    expect(c3.blocks[0]).not.toBe(c4.blocks[0]);
    root.unmount();
  });
});
