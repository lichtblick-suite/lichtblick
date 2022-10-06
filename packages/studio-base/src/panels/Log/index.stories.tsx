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

import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { range } from "lodash";
import TestUtils from "react-dom/test-utils";

import Log from "@foxglove/studio-base/panels/Log";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

const fixture: Fixture = {
  topics: [{ name: "/rosout", datatype: "rosgraph_msgs/Log" }],
  frame: {
    "/rosout": [
      {
        topic: "/rosout",
        receiveTime: { sec: 123, nsec: 456 },
        message: {
          file: "some_topic_utils/src/foo.cpp",
          function: "vector<int> some_topic::findInt",
          header: { stamp: { sec: 123, nsec: 0 } },
          level: 1,
          line: 242,
          msg: "Couldn't find int 83757.",
          name: "/some_topic",
        },
        schemaName: "rosgraph_msgs/Log",
        sizeInBytes: 0,
      },
      {
        topic: "/rosout",
        receiveTime: { sec: 123, nsec: 456 },
        message: {
          file: "other_topic_utils/src/foo.cpp",
          function: "vector<int> other_node::findInt",
          header: { stamp: { sec: 123, nsec: 0 } },
          level: 2,
          line: 242,
          msg: "Couldn't find int 2121.",
          name: "/other_node",
        },
        schemaName: "rosgraph_msgs/Log",
        sizeInBytes: 0,
      },
      {
        topic: "/rosout",
        receiveTime: { sec: 123, nsec: 456 },
        message: {
          file: "other_topic_utils/src/foo.cpp",
          function: "vector<int> other_node::findInt",
          header: { stamp: { sec: 123, nsec: 0 } },
          level: 4,
          line: 242,
          msg: "Lorem ipsum blah blah. This message should\nshow up as multiple lines",
          name: "/other_node",
        },
        schemaName: "rosgraph_msgs/Log",
        sizeInBytes: 0,
      },
      {
        topic: "/rosout",
        receiveTime: { sec: 0, nsec: 0 },
        message: {
          header: { seq: 335, stamp: { sec: 1529678605, nsec: 521518001 }, frame_id: "" },
          level: 8,
          name: "/some_node",
          msg: "26826:\nheader: \n  seq: 0\n  stamp: 1529678605.349576000\n  Adipisicing minim veniam sint occaecat anim laborum irure velit ut non do labore.\n",
          file: "somefile.cpp",
          function: "SomeFunction:SomeContext",
          line: 491,
          topics: [],
        },
        schemaName: "rosgraph_msgs/Log",
        sizeInBytes: 0,
      },
      {
        topic: "/rosout",
        receiveTime: { sec: 0, nsec: 0 },
        message: {
          header: { seq: 335, stamp: { sec: 1529678605, nsec: 521518001 }, frame_id: "" },
          level: 16,
          name: "/some_node",
          msg: "fatal message",
          file: "somefile.cpp",
          function: "SomeFunction:SomeContext",
          line: 491,
          topics: [],
        },
        schemaName: "rosgraph_msgs/Log",
        sizeInBytes: 0,
      },
    ],
  },
};

function makeLongFixture(): Fixture {
  const levels = [1, 2, 4, 8, 16];

  return {
    topics: [{ name: "/rosout", datatype: "rosgraph_msgs/Log" }],
    frame: {
      "/rosout": range(200).map((idx) => ({
        topic: "/rosout",
        receiveTime: { sec: 10 * idx, nsec: 0 },
        message: {
          file: "some_topic_utils/src/foo.cpp",
          function: "vector<int> some_topic::findInt",
          header: { stamp: { sec: 123, nsec: 0 } },
          level: levels[idx % levels.length],
          line: 242,
          msg: `Couldn't find int ${idx + 1}.`,
          name: "/some_topic",
        },
        schemaName: "rosgraph_msgs/Log",
        sizeInBytes: 0,
      })),
    },
  };
}

export default {
  title: "panels/Log",
  component: Log,
};

export const Simple = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <Log />
    </PanelSetup>
  );
};

export const Scrolled = (): JSX.Element => {
  return (
    <PanelSetup fixture={makeLongFixture()}>
      <Log />
    </PanelSetup>
  );
};

export const WithSettings = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture} includeSettings>
      <Log />
    </PanelSetup>
  );
};

export const TopicToRender = (): JSX.Element => {
  function makeMessages(topic: any) {
    return fixture.frame!["/rosout"]!.map((msg: any) => ({
      ...msg,
      topic,
      message: { ...msg.message, name: `${topic}${msg.message.name}` },
    }));
  }
  return (
    <PanelSetup
      fixture={{
        topics: [
          { name: "/rosout", datatype: "rosgraph_msgs/Log" },
          { name: "/foo/rosout", datatype: "rosgraph_msgs/Log" },
          { name: "/studio_source_2/rosout", datatype: "rosgraph_msgs/Log" },
        ],
        frame: {
          "/rosout": makeMessages("/rosout"),
          "/foo/rosout": makeMessages("/foo/rosout"),
          "/studio_source_2/rosout": makeMessages("/studio_source_2/rosout"),
        },
      }}
      onMount={() => {
        TestUtils.Simulate.mouseEnter(
          document.querySelectorAll("[data-testid~=panel-mouseenter-container]")[0]!,
        );
        setTimeout(() => {
          TestUtils.Simulate.click(document.querySelectorAll("[data-testid=topic-set]")[0]!);
        });
      }}
    >
      <Log overrideConfig={{ searchTerms: [], minLogLevel: 1, topicToRender: "/foo/rosout" }} />
    </PanelSetup>
  );
};
TopicToRender.parameters = { colorScheme: "dark" };

export const FilteredTerms = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <Log
        overrideConfig={{
          searchTerms: ["multiple", "/some_topic"],
          minLogLevel: 1,
          topicToRender: "/rosout",
        }}
      />
    </PanelSetup>
  );
};

FilteredTerms.title = `filtered terms: "multiple", "/some_topic"`;

export const CaseInsensitiveFilter = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <Log
        overrideConfig={{
          searchTerms: ["could", "Ipsum"],
          minLogLevel: 1,
          topicToRender: "/rosout",
        }}
      />
    </PanelSetup>
  );
};

CaseInsensitiveFilter.title = `case insensitive message filtering: "could", "Ipsum"`;

export const AutoCompleteItems = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <Log
        overrideConfig={{
          searchTerms: ["could", "Ipsum"],
          minLogLevel: 1,
          topicToRender: "/rosout",
        }}
      />
    </PanelSetup>
  );
};
AutoCompleteItems.play = async () => {
  const user = userEvent.setup();
  const input = (await screen.findAllByPlaceholderText("Search filter"))[0]!;
  await user.click(input);
};

export const FoxgloveLog = (): JSX.Element => {
  const foxgloveLogFixture: Fixture = {
    topics: [{ name: "/log", datatype: "foxglove.Log" }],
    frame: {
      "/log": [
        {
          topic: "/log",
          receiveTime: { sec: 123, nsec: 456 },
          message: {
            file: "some_topic_utils/src/foo.cpp",
            timestamp: 123000000000n,
            level: 1,
            line: 242,
            message: "Couldn't find int 83757.",
          },
          schemaName: "foxglove.Log",
          sizeInBytes: 0,
        },
        {
          topic: "/log",
          receiveTime: { sec: 123, nsec: 456 },
          message: {
            file: "other_topic_utils/src/foo.cpp",
            function: "vector<int> other_node::findInt",
            timestamp: 123000000000n,
            level: 2,
            line: 242,
            message: "Couldn't find int 2121.",
          },
          schemaName: "foxglove.Log",
          sizeInBytes: 0,
        },
        {
          topic: "/log",
          receiveTime: { sec: 123, nsec: 456 },
          message: {
            file: "other_topic_utils/src/foo.cpp",
            function: "vector<int> other_node::findInt",
            timestamp: 123000000000n,
            level: 3,
            line: 242,
            message: "Lorem ipsum blah blah. This message should\nshow up as multiple lines",
          },
          schemaName: "foxglove.Log",
          sizeInBytes: 0,
        },
        {
          topic: "/log",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            timestamp: 1529678605521518001n,
            level: 4,
            message:
              "26826:\nheader: \n  seq: 0\n  stamp: 1529678605.349576000\n  Adipisicing minim veniam sint occaecat anim laborum irure velit ut non do labore.\n",
            file: "somefile.cpp",
            line: 491,
          },
          schemaName: "foxglove.Log",
          sizeInBytes: 0,
        },
        {
          topic: "/log",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            timestamp: 1529678605521518001n,
            level: 5,
            message: "fatal message",
            file: "somefile.cpp",
            line: 491,
          },
          schemaName: "foxglove.Log",
          sizeInBytes: 0,
        },
      ],
    },
  };

  return (
    <PanelSetup fixture={foxgloveLogFixture}>
      <Log />
    </PanelSetup>
  );
};
