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
import { useCallback } from "react";

import { useMessagesByTopic } from "@foxglove/studio-base/PanelAPI";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { downloadTextFile } from "@foxglove/studio-base/util/download";

import Internals from "./index";

const mockDownloadTextFile: any = downloadTextFile;
jest.mock("@foxglove/studio-base/util/download");

function Subscriber({ topic }: { topic: string }) {
  useMessagesByTopic({ topics: [topic], historySize: 1 });
  return ReactNull;
}

describe("<Internals>", () => {
  it("displays panel subscribers", () => {
    function Consumer({ fn }: { fn: (ctx: MessagePipelineContext) => void }) {
      fn(useMessagePipeline(useCallback((ctx) => ctx, [])));
      return ReactNull;
    }
    const contextFn = jest.fn().mockReturnValue(ReactNull);
    const wrapper = mount(
      <ThemeProvider isDark>
        <PanelSetup
          fixture={{
            topics: [{ name: "/foo", datatype: "foo_msgs/Foo" }],
            frame: {},
          }}
        >
          <Internals />
          <Consumer fn={contextFn} />
        </PanelSetup>
      </ThemeProvider>,
    );
    expect(wrapper.find("[data-test='internals-subscriptions']").text()).not.toContain("/foo");
    expect(contextFn.mock.calls).toEqual([[expect.objectContaining({ subscriptions: [] })]]);
    wrapper.unmount();

    const anotherContextFn = jest.fn().mockReturnValue(ReactNull);
    const wrapperWithSubscriber = mount(
      <ThemeProvider isDark>
        <PanelSetup
          fixture={{
            topics: [{ name: "/foo", datatype: "foo_msgs/Foo" }],
            frame: {},
          }}
        >
          <Internals />
          <Consumer fn={anotherContextFn} />
          <Subscriber topic="/foo" />
        </PanelSetup>
      </ThemeProvider>,
    );
    expect(anotherContextFn.mock.calls).toEqual([
      [expect.objectContaining({ subscriptions: [] })],
      [expect.objectContaining({ subscriptions: [expect.objectContaining({ topic: "/foo" })] })],
    ]);
    expect(wrapperWithSubscriber.find("[data-test='internals-subscriptions']").text()).toContain(
      "/foo",
    );
    wrapperWithSubscriber.unmount();
  });

  it("records data and exports JSON fixture", async () => {
    const wrapper = mount(
      <PanelSetup
        fixture={{
          frame: {},
          topics: [{ name: "/foo", datatype: "foo_msgs/Foo" }],
        }}
      >
        <ThemeProvider isDark>
          <Internals />
          <Subscriber topic="/foo" />
        </ThemeProvider>
      </PanelSetup>,
    );

    await Promise.resolve();
    const recordButton = wrapper.find("[data-test='internals-record-button']").find("button");

    expect(wrapper.find("[data-test='internals-subscriptions']").text()).toContain("/foo");

    // start recording - default is all topics
    recordButton.simulate("click");
    expect(wrapper.text()).toContain("Recording 1 topics…");

    const downloadButton = wrapper.find("[data-test='internals-download-button']").find("button");

    downloadButton.simulate("click");
    expect(mockDownloadTextFile.mock.calls).toEqual([
      [
        JSON.stringify({
          topics: [{ name: "/foo", datatype: "foo_msgs/Foo" }],
          frame: { "/foo": [] },
        }),
        "fixture.json",
      ],
    ]);
    mockDownloadTextFile.mockClear();

    const message = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: {
        value: "hi",
      },
    };
    wrapper.setProps({
      fixture: {
        ...wrapper.props().fixture,
        frame: {
          "/foo": [message],
        },
      },
    });

    downloadButton.simulate("click");
    expect(mockDownloadTextFile.mock.calls).toEqual([
      [
        JSON.stringify({
          topics: [{ name: "/foo", datatype: "foo_msgs/Foo" }],
          frame: { "/foo": [message] },
        }),
        "fixture.json",
      ],
    ]);

    wrapper.unmount();
  });
});
