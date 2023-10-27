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

import { StoryObj } from "@storybook/react";

import RawMessages from "@foxglove/studio-base/panels/RawMessages";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import {
  enumAdvancedFixture,
  enumFixture,
  fixture,
  multipleMessagesFilter,
  multipleNumberMessagesFixture,
  topicsToDiffFixture,
  topicsWithIdsToDiffFixture,
  withMissingData,
} from "./fixture";
import type { RawMessagesPanelConfig } from "./types";
import { Constants, NodeState } from "./types";

const noDiffConfig = {
  diffMethod: "custom",
  diffTopicPath: "",
  diffEnabled: false,
  showFullMessageForDiff: false,
} as RawMessagesPanelConfig;

const diffConfig = {
  topicPath: "/baz/enum_advanced",
  diffMethod: "custom",
  diffTopicPath: "/another/baz/enum_advanced",
  diffEnabled: true,
} as RawMessagesPanelConfig;

const scrollToBottom: StoryObj["play"] = async ({ canvasElement }) => {
  const scrollContainers = canvasElement.querySelectorAll("[data-testid=panel-scroll-container]");

  scrollContainers.forEach((scrollContainer) => {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  });
};

export default {
  title: "panels/RawMessages",
};

export const Default: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/msgs/big_topic" }} />
    </PanelSetup>
  ),
};

export const Schemaless: StoryObj = {
  render: () => (
    <PanelSetup
      fixture={{
        topics: [{ name: "foo", schemaName: undefined }],
        datatypes: new Map(),
        frame: {
          ["foo"]: [
            {
              topic: "foo",
              schemaName: "",
              message: { bar: 1 },
              receiveTime: { sec: 0, nsec: 0 },
              sizeInBytes: 0,
            },
          ],
        },
      }}
    >
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "foo" }} />
    </PanelSetup>
  ),
};

export const Collapsed: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{ ...noDiffConfig, topicPath: "/msgs/big_topic", expansion: "none" }}
      />
    </PanelSetup>
  ),
};

export const Expanded: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{ ...noDiffConfig, topicPath: "/msgs/big_topic", expansion: "all" }}
      />
    </PanelSetup>
  ),
};

export const Overridden: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture} includeSettings>
      <RawMessages
        overrideConfig={{
          ...noDiffConfig,
          topicPath: "/msgs/big_topic",
          expansion: { LotsOfStuff: NodeState.Collapsed, timestamp_array: NodeState.Expanded },
        }}
      />
    </PanelSetup>
  ),
};

export const WithReceivetime: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/foo" }} />
    </PanelSetup>
  ),
  name: "With receiveTime",
};

export const DisplayBigValueNum: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/num.value" }} />
    </PanelSetup>
  ),
  name: "Display big value - num",
};

export const DisplayMessageWithBigintValue: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/bigint" }} />
    </PanelSetup>
  ),
};

export const DisplayBigintValue: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/bigint.value" }} />
    </PanelSetup>
  ),
};

export const DisplayBigValueText: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/text.value" }} />
    </PanelSetup>
  ),
  name: "Display big value - text",
};

export const DisplayBigValueTextTruncated: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/text.value_long" }} />
    </PanelSetup>
  ),
  name: "Display big value - text truncated",
  play: scrollToBottom,
};

export const DisplayBigValueTextWithNewlines: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{ ...noDiffConfig, topicPath: "/baz/text.value_with_newlines" }}
      />
    </PanelSetup>
  ),
  name: "Display big value - text with newlines",
  play: scrollToBottom,
};

export const DisplayBigValueSingleElementArray: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/array.value" }} />
    </PanelSetup>
  ),
  name: "Display big value - single element array",
};

export const DisplaySingleObjectArray: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/array/obj.value" }} />
    </PanelSetup>
  ),
};

export const DisplayBasicEnum: StoryObj = {
  render: () => (
    <PanelSetup fixture={enumFixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/enum" }} />
    </PanelSetup>
  ),
};

export const DisplayAdvancedEnumUsage: StoryObj = {
  render: () => (
    <PanelSetup fixture={enumAdvancedFixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/enum_advanced" }} />
    </PanelSetup>
  ),
};

export const WithMissingData: StoryObj = {
  render: () => (
    <PanelSetup fixture={withMissingData}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/missing_data" }} />
    </PanelSetup>
  ),
};

export const WithATruncatedLongString: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz/text" }} />
    </PanelSetup>
  ),
};

export const DisplayGeometryTypesLength: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/geometry/types" }} />
    </PanelSetup>
  ),
  name: "Display geometry types - length",
};

export const DisplayDiff: StoryObj = {
  render: () => (
    <PanelSetup fixture={topicsToDiffFixture}>
      <RawMessages
        overrideConfig={{ ...diffConfig, expansion: "all", showFullMessageForDiff: false }}
      />
    </PanelSetup>
  ),
};

export const DisplayFullDiff: StoryObj = {
  render: () => (
    <PanelSetup fixture={topicsToDiffFixture}>
      <RawMessages
        overrideConfig={{ ...diffConfig, expansion: "all", showFullMessageForDiff: true }}
      />
    </PanelSetup>
  ),
};

export const DisplayDiffWithIDFields: StoryObj = {
  render: () => (
    <PanelSetup fixture={topicsWithIdsToDiffFixture}>
      <RawMessages
        overrideConfig={
          {
            ...diffConfig,
            topicPath: "/baz/enum_advanced_array.value",
            diffTopicPath: "/another/baz/enum_advanced_array.value",
            showFullMessageForDiff: false,
            expansion: "all",
          } as RawMessagesPanelConfig
        }
      />
    </PanelSetup>
  ),
};

export const EmptyDiffMessage: StoryObj = {
  render: () => (
    <PanelSetup fixture={{ topics: [], frame: {} }}>
      <RawMessages
        overrideConfig={{ ...diffConfig, showFullMessageForDiff: false } as RawMessagesPanelConfig}
      />
    </PanelSetup>
  ),
};

export const DiffSameMessages: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{
          topicPath: "/foo",
          diffMethod: "custom",
          diffTopicPath: "/foo",
          diffEnabled: true,
          showFullMessageForDiff: false,
          fontSize: undefined,
        }}
      />
    </PanelSetup>
  ),
};

export const DiffConsecutiveMessages: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{
          topicPath: "/foo",
          diffMethod: Constants.PREV_MSG_METHOD,
          diffTopicPath: "",
          diffEnabled: true,
          showFullMessageForDiff: true,
          expansion: "all",
          fontSize: undefined,
        }}
      />
    </PanelSetup>
  ),
};

export const DiffConsecutiveMessagesWithFilter: StoryObj = {
  render: () => (
    <PanelSetup fixture={multipleMessagesFilter}>
      <RawMessages
        overrideConfig={{
          topicPath: "/foo{type==2}",
          diffMethod: Constants.PREV_MSG_METHOD,
          diffTopicPath: "",
          diffEnabled: true,
          showFullMessageForDiff: true,
          expansion: "all",
          fontSize: undefined,
        }}
      />
    </PanelSetup>
  ),
};

export const DiffConsecutiveMessagesWithBigint: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{
          topicPath: "/baz/bigint",
          diffMethod: Constants.PREV_MSG_METHOD,
          diffTopicPath: "",
          diffEnabled: true,
          showFullMessageForDiff: true,
          expansion: "all",
          fontSize: undefined,
        }}
      />
    </PanelSetup>
  ),
};

export const DisplayCorrectMessageWhenDiffIsDisabledEvenWithDiffMethodTopicSet: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{
          topicPath: "/foo",
          diffMethod: Constants.PREV_MSG_METHOD,
          diffTopicPath: "/another/baz/enum_advanced",
          diffEnabled: false,
          showFullMessageForDiff: true,
          expansion: "all",
          fontSize: undefined,
        }}
      />
    </PanelSetup>
  ),
  name: "Display correct message when diff is disabled, even with diff method & topic set",
};

export const MultipleMessagesWithTopLevelFilter: StoryObj = {
  render: () => (
    <PanelSetup fixture={multipleNumberMessagesFixture}>
      <RawMessages
        overrideConfig={
          {
            ...noDiffConfig,
            topicPath: "/multiple_number_messages{value==2}",
          } as any
        }
      />
    </PanelSetup>
  ),
  name: "Multiple messages with top-level filter",
};

export const KeyValueObjects: StoryObj = {
  render: () => {
    const namesFixture = {
      datatypes: new Map(
        Object.entries({
          baz: {
            definitions: [
              { name: "obj", type: "obj", isComplex: true },
              { name: "kv", type: "kv", isComplex: true },
              { name: "kv_arr", type: "kv", isArray: true, isComplex: true },
            ],
          },
          obj: {
            definitions: [
              { name: "key", type: "int32" },
              { name: "field", type: "string" },
            ],
          },
          kv: {
            definitions: [
              { name: "key", type: "string" },
              { name: "value", type: "string" },
            ],
          },
        }),
      ),
      topics: [{ name: "/baz", schemaName: "baz" }],
      frame: {
        "/baz": [
          {
            topic: "/baz",
            receiveTime: { sec: 123, nsec: 456789012 },
            message: {
              obj: { key: 1, field: "foo" },
              kv: { key: "foo", value: "bar" },
              kv_arr: [
                { key: "foo", value: "bar" },
                { key: "baz", value: "qux" },
              ],
            },
            schemaName: "baz",
            sizeInBytes: 0,
          },
        ],
      },
    };

    return (
      <PanelSetup fixture={namesFixture}>
        <RawMessages overrideConfig={{ ...noDiffConfig, topicPath: "/baz" }} />
      </PanelSetup>
    );
  },
  name: "Display key/value objects",
};
