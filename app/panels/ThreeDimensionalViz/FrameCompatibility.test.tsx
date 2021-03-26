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
import { last } from "lodash";
import { act } from "react-dom/test-utils";

import MockMessagePipelineProvider from "@foxglove-studio/app/components/MessagePipeline/MockMessagePipelineProvider";
import { deepParse } from "@foxglove-studio/app/util/binaryObjects";

import { FrameCompatibilityDEPRECATED } from "./FrameCompatibility";
import { datatypes, messages } from "./FrameCompatibilityFixture";

const unBobjectifyMessage = ({ message, receiveTime, topic }: any) => ({
  message: deepParse(message),
  receiveTime,
  topic,
});

describe("FrameCompatibilityDEPRECATED", () => {
  it("passes in messages per frame", () => {
    const fooMsg1 = {
      topic: "/foo",
      receiveTime: { sec: 100, nsec: 0 },
      message: { index: 0 },
    };
    const fooMsg2 = {
      topic: "/foo",
      receiveTime: { sec: 101, nsec: 0 },
      message: { index: 0 },
    };

    const childFn = jest.fn().mockReturnValue(undefined);
    class MyComponent extends React.Component<any> {
      render() {
        childFn(this.props);
        return ReactNull;
      }

      setSubscriptions(topics: string[]) {
        this.props.setSubscriptions(topics);
      }
    }
    const MyComponentWithFrame = FrameCompatibilityDEPRECATED(MyComponent, ["/some/topic"]);
    const topics = [
      { name: "/some/topic", datatype: "some/topic" },
      { name: "/foo", datatype: "foo_msgs/Foo" },
    ];
    const ref = React.createRef<any>();
    const provider = mount(
      <MockMessagePipelineProvider messages={[messages[0]]} datatypes={datatypes} topics={topics}>
        <MyComponentWithFrame ref={ref} topics={topics} />
      </MockMessagePipelineProvider>,
    );
    const frame1 = last(childFn.mock.calls)[0].frame;
    expect(Object.keys(frame1)).toEqual(["/some/topic"]);
    let frameMessages = frame1["/some/topic"];
    expect(frameMessages).toHaveLength(1);
    expect(frameMessages.map(unBobjectifyMessage)).toEqual([messages[0]]);

    // Make sure that we don't send `messages[0]` when receiving a new frame.
    provider.setProps({ messages: [messages[1], fooMsg1] });
    const frame2 = last(childFn.mock.calls)[0].frame;
    expect(Object.keys(frame2)).toEqual(["/some/topic"]);
    frameMessages = frame2["/some/topic"];
    expect(frameMessages.map(unBobjectifyMessage)).toEqual([messages[1]]);

    // setSubscriptions should add new topics while remaining subscribed to old topics
    if (!ref.current) {
      throw new Error("missing ref");
    }
    act(() => ref.current.setSubscriptions(["/foo"]));
    provider.setProps({ messages: [messages[2], fooMsg2] });
    const frame3 = last(childFn.mock.calls)[0].frame;
    expect(Object.keys(frame3).sort()).toEqual(["/foo", "/some/topic"]);
    const fooMessages = frame3["/foo"];
    expect(fooMessages.map(unBobjectifyMessage)).toEqual([fooMsg2]);
    const someTopicMessages = frame3["/some/topic"];
    expect(someTopicMessages.map(unBobjectifyMessage)).toEqual([messages[2]]);
  });
});
