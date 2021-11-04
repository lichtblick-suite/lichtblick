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

import TestUtils from "react-dom/test-utils";

import Rosout from "@foxglove/studio-base/panels/Rosout";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

const fixture = {
  topics: [{ name: "/rosout", datatype: "dummy" }],
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
      },
    ],
  },
};

export default {
  title: "panels/Rosout",
  component: Rosout,
};

export const Simple = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <Rosout />
    </PanelSetup>
  );
};

export const TopicToRender = (): JSX.Element => {
  function makeMessages(topic: any) {
    return fixture.frame["/rosout"].map((msg) => ({
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
          document.querySelectorAll("[data-test~=panel-mouseenter-container]")[0]!,
        );
        setTimeout(() => {
          TestUtils.Simulate.click(document.querySelectorAll("[data-test=topic-set]")[0]!);
        });
      }}
    >
      <Rosout overrideConfig={{ searchTerms: [], minLogLevel: 1, topicToRender: "/foo/rosout" }} />
    </PanelSetup>
  );
};
TopicToRender.parameters = { colorScheme: "dark" };

export const FilteredTerms = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <Rosout
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

export const CaseInsitiveFilter = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <Rosout
        overrideConfig={{
          searchTerms: ["could", "Ipsum"],
          minLogLevel: 1,
          topicToRender: "/rosout",
        }}
      />
    </PanelSetup>
  );
};

CaseInsitiveFilter.title = `case insensitive message filtering: "could", "Ipsum"`;
